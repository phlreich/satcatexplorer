import express from 'express';
import axios from 'axios';
import fs from 'fs';
import csv from 'csv-parser';
import cron from 'node-cron';
import pkg from 'pg';
import stream from 'stream';
import cors from 'cors';
import { Configuration, OpenAIApi } from "openai";
import { promisify } from 'util';

import { fetchDataForNoradId } from './helpers.js';

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


const configuration = new Configuration({
    organization: "org-3tbowCdIMm2qTGyOmB0BSLze",
    apiKey: config.GPT_API.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

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
        console.log('satcatdata updated');
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
    }
});

cron.schedule('0 0 * * *', async () => {
    try {
        const sqlQuery = "select * from satcatdata_viable where norad_cat_id not in (select norad_cat_id from orbitdata) and norad_cat_id not in (select norad_cat_id from no_gp) limit 1000";
        const result = await pool.query(sqlQuery);
        const norad_ids = result.rows.map(row => row.norad_cat_id);
        await fetchDataForNoradId(norad_ids, pool);
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
    }
});


app.get('/api/search', async (req, res) => {
    try {
        // const sqlQuery = req.query.q;
        const sqlQuery = "SELECT * FROM satcatdata_viable ORDER BY launch_date ASC LIMIT 10;";
        const result = await pool.query(sqlQuery);
        const norad_ids = result.rows.map(row => row.norad_cat_id);

        const orbitDataQuery = 'SELECT * FROM orbitdata WHERE norad_cat_id = ANY($1)';
        const orbitDataResult = await pool.query(orbitDataQuery, [norad_ids]);
        const orbitDataNoradIds = orbitDataResult.rows.map(row => row.norad_cat_id);

        const missingNoradIds = norad_ids.filter(id => !orbitDataNoradIds.includes(id));

        // TODO the missing data is fetched but the orbits will not be drawn
        if (missingNoradIds.length > 0) {
            console.log(`Missing orbit data for ${missingNoradIds.length} objects. Fetching data from celestrak...`);
            await fetchDataForNoradId(missingNoradIds, pool);
        }

        const finalOrbitDataResult = await pool.query(orbitDataQuery, [norad_ids]);
        res.json(finalOrbitDataResult.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

