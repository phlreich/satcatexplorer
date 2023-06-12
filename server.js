import dotenv from 'dotenv';
dotenv.config({ path: './config.env' });

import express from 'express';
import Papa from 'papaparse';
import cron from 'node-cron';
import pg from 'pg';
import nsp from 'node-sql-parser';
import path from 'path';
import cors from 'cors';

const { Parser } = nsp;

import { fetchDataForNoradId, fetchGPTResponse } from './helpers.js';

const { Pool } = pg;

let __filename;
if (process.platform === "linux") {
    __filename = import.meta.url.substring(7);
} else {
    __filename = import.meta.url.substring(8);
}
const __dirname = path.dirname(__filename);

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});


// test connection
pool.query('SELECT NOW()', (error, results) => {
    if (error) {
        throw error;
    }
    console.log(results.rows[0].now);
});

// get system version
pool.query('SELECT version()', (error, results) => {
    if (error) {
        throw error;
    }
    console.log(results.rows[0].version);
});

const app = express();
let portnr = 5173;

if (process.env.NODE_ENV === 'development') {
    app.use(cors());
    portnr = 5730;
} else {
    app.use(express.static(path.join(__dirname, 'dist')));
}


app.listen(portnr, '0.0.0.0', () => {
    console.log('Server is running on port ' + portnr);
});

app.get(['/', '/defaultsite'], (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// check if table gptswitch contains a true value and set the gptswitch variable accordingly
let gptswitch = false;
cron.schedule('*/1 * * * *', () => {
    pool.query('SELECT * FROM gptswitch', (error, results) => {
        if (error) {
            throw error;
        }
        if (results.rows[0].gptswitch === true) {
            gptswitch = true;
        } else {
            gptswitch = false;
        }
    });
    // console.log('gptswitch: ' + gptswitch);
});

const parser = new Parser();
app.get('/api/search', async (req, res) => {
    try {
        // const answer = await fetchGPTResponse(req.query.q);
        // const answer = "SELECT * FROM satcat_orbitdata where satcat_object_name ilike '%ISS (ZAR%'";
        // const answer = req.query.q;
        if (gptswitch === true) {
            const answer = await fetchGPTResponse(req.query.q);
        } else {
            const answer = "SELECT * FROM satcat_orbitdata where satcat_object_name ilike '%ISS (ZAR%'";
        }
        console.log(answer);
        let result;
        try {
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

// CRON JOBS
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

