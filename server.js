import express from 'express';
import axios from 'axios';
import fs from 'fs';
import csv from 'csv-parser';
import cron from 'node-cron';
import pkg from 'pg';
import stream from 'stream';
import cors from 'cors';
import Papa from 'papaparse';
import { promisify } from 'util';

const { Pool } = pkg;
const app = express();

app.get('/', (req, res) => {
    res.send('Hello World!');
});

let portnr = 5730
app.listen(portnr, () => {
    console.log('Server is running on port ' + portnr);
});

// TODO: remove cors
app.use(cors());


const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));


const pool = new Pool({
    user: config.db.user,
    host: config.db.host,
    database: config.db.database,
    password: config.db.password,
    port: config.db.port,
});

// test connection
pool.query('SELECT NOW()', (error, results) => {
    if (error) {
        throw error;
    }
    console.log(results.rows);
});

// cron job to update satcat data every day at midnight
cron.schedule('0 0 * * *', async () => {
    try {
        const response = await axios.get('https://celestrak.com/pub/satcat.csv');
        const csvData = response.data;
        const results = [];

        const pipeline = promisify(stream.pipeline);
        const readableStream = stream.Readable.from(csvData);

        await pipeline(
            readableStream,
            csv(),
            new stream.Writable({
                objectMode: true,
                write(obj, _, callback) {
                    results.push(obj);
                    callback();
                },
            })
        );
        
        await pool.query('BEGIN');
        await pool.query('TRUNCATE TABLE satcatdata');
        for (let row of results) {
            let values = Object.values(row).map(value => value === '' ? null : value);
            await pool.query(
                `INSERT INTO satcatdata (
                    OBJECT_NAME,OBJECT_ID,NORAD_CAT_ID,OBJECT_TYPE,OPS_STATUS_CODE,OWNER,LAUNCH_DATE,LAUNCH_SITE,DECAY_DATE,PERIOD,
                    INCLINATION,APOGEE,PERIGEE,RCS,DATA_STATUS_CODE,ORBIT_CENTER,ORBIT_TYPE
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
                values
            );
        }
        await pool.query('COMMIT');
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
    }
});

// endpoints
app.get('/api/active', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM active');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});


app.get('/api/search', async (req, res) => {
    try {
        // const sqlQuery = req.query.q;
        const sqlQuery = "select * from satcatdata_viable where object_type != 'PAY' and launch_date < '01-01-1979'";
        const result = await pool.query(sqlQuery);
        const norad_ids = result.rows.map(row => row.norad_cat_id);

        const orbitDataQuery = 'SELECT * FROM orbitdata WHERE norad_cat_id = ANY($1)';
        const orbitDataResult = await pool.query(orbitDataQuery, [norad_ids]);
        const orbitDataNoradIds = orbitDataResult.rows.map(row => row.norad_cat_id);

        const missingNoradIds = norad_ids.filter(id => !orbitDataNoradIds.includes(id));

        if (missingNoradIds.length > 0) {
            console.log(`Missing orbit data for ${missingNoradIds.length} objects. Fetching data from celestrak...`);
            for (const id of missingNoradIds) {
                const response = await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${id}&FORMAT=csv`);
                const text = await response.text();
                if (text.trim() === "No GP data found") {
                    console.error(`No data found for object with NORAD CAT ID: ${id}`);
                    // insert norad_cat_id, false into the table no_gp
                    const query = `INSERT INTO no_gp (norad_cat_id, gp_data_available) VALUES ($1, $2)`;
                    const values = [id, false];
                    await pool.query(query, values);
                    // throw new Error(`No data found for object with NORAD CAT ID: ${id}`);
                    continue;
                }
                const csvData = Papa.parse(text, { header: true }).data[0];

                const query = `INSERT INTO orbitdata ( OBJECT_NAME, OBJECT_ID, EPOCH, MEAN_MOTION, ECCENTRICITY, INCLINATION, RA_OF_ASC_NODE, 
                        ARG_OF_PERICENTER, MEAN_ANOMALY, EPHEMERIS_TYPE, CLASSIFICATION_TYPE, NORAD_CAT_ID, ELEMENT_SET_NO, REV_AT_EPOCH, 
                        BSTAR, MEAN_MOTION_DOT, MEAN_MOTION_DDOT) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`;
                const values = Object.values(csvData);
                await pool.query(query, values);
            }
        }

        const finalOrbitDataResult = await pool.query(orbitDataQuery, [norad_ids]);
        res.json(finalOrbitDataResult.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

