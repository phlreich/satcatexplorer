import dotenv from 'dotenv';
dotenv.config({ path: './config.env' });

import express from 'express';
import cron from 'node-cron';
import pg from 'pg';
import path from 'path';
import cors from 'cors';

import { fetchDataForNoradId, fetchGPTResponse,
         updateSatcatData, updateOrbitDataTable } from './helpers.js';

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

app.get('/api/search', async (req, res) => {
    try {
        let sqlQuery;
        const settingsResult = await pool.query('SELECT gpt_api_active FROM settings');
        if (settingsResult.rows[0].gpt_api_active === true) {
            sqlQuery = await fetchGPTResponse(req.query.q);
        } else {
            sqlQuery = "SELECT * FROM satcat_orbitdata where satcat_object_name ilike '%ISS (ZAR%'";
        }
        console.log(sqlQuery);
        let result;
        try {
            result = await pool.query(sqlQuery);
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

updateSatcatData(pool);

// CRON JOBS
cron.schedule('0 0 * * *', () => updateSatcatData(pool));

cron.schedule('*/4 * * * *', () => updateOrbitDataTable(pool));


