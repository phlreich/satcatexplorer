import express from 'express';
import fs from 'fs';
import Papa from 'papaparse';
import cron from 'node-cron';
import pg from 'pg';
import cors from 'cors';
import nsp from 'node-sql-parser';
const { Parser } = nsp;

import { fetchDataForNoradId, fetchGPTResponse } from './helpers.js';

const { Pool } = pg;
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
    console.log('attempting to update satcatdata', new Date());
    try {
        const response = await fetch('https://celestrak.com/pub/satcat.csv');
        const csvData = await response.text();
        const parsedData = Papa.parse(csvData, { header: true }).data.slice(0, -1);

        await pool.query('TRUNCATE TABLE satcatdata');
        for (let row of parsedData) {
            let values = Object.values(row).map(value => value === '' ? null : value);
            await pool.query(
                `INSERT INTO satcatdata (
                    OBJECT_NAME,OBJECT_ID,NORAD_CAT_ID,OBJECT_TYPE,OPS_STATUS_CODE,OWNER,LAUNCH_DATE,LAUNCH_SITE,DECAY_DATE,PERIOD,
                    INCLINATION,APOGEE,PERIGEE,RCS,DATA_STATUS_CODE,ORBIT_CENTER,ORBIT_TYPE
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
                values
            );
        }
        console.log('satcatdata updated', new Date());
    } catch (err) {
        console.error(err);
    }
});


cron.schedule('0 0 * * *', async () => {
    // keep the orbitdata table up to date
    try {
        const sqlQuery = "SELECT * FROM satcatdata_viable \
        WHERE norad_cat_id NOT IN \
        (SELECT norad_cat_id FROM orbitdata) \
        AND norad_cat_id NOT IN \
        (SELECT norad_cat_id FROM no_gp) \
        LIMIT 1000";
        const result = await pool.query(sqlQuery);
        const norad_ids = result.rows.map(row => row.norad_cat_id);
        await fetchDataForNoradId(norad_ids, pool);
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
    }
});

const parser = new Parser();
app.get('/api/search', async (req, res) => {
    try {
        const answer = await fetchGPTResponse(req.query.q);
        // const answer = "SELECT * FROM satcatdata_viable ORDER BY launch_date ASC LIMIT 10";
        console.log(answer);
        let result;
        try {
            parser.parse(answer);
            result = await pool.query(answer);
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
            console.log(err);
        }
    
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

