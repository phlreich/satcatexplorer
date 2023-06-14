import dotenv from 'dotenv';
dotenv.config({ path: './config.env' });

export { fetchDataForNoradId, fetchGPTResponse, updateSatcatData, updateOrbitDataTable };
import Papa from 'papaparse';
import { Configuration, OpenAIApi } from "openai";
import fs from 'fs';

const s = [...Array(17)].map((_,i)=>"$"+(i+1)).join(','); // $1,$2,$3,...,$17

async function fetchDataForNoradId(norad_ids, pool) {
    for (const id of norad_ids) {
        try {
            const response = await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${id}&FORMAT=csv`)
                .catch(error => console.error(`Failed to fetch for NORAD ID ${id}: ${error}`));
            const responseText = await response.text();
            if (responseText.trim() === "No GP data found") {
                const query = `INSERT INTO no_gp (norad_cat_id, gp_data_available) VALUES ($1, $2)`;
                await pool.query(query, [id, false]);
            } else {
                const data = Papa.parse(responseText, { header: true }).data.slice(0, -1);
                const query = `INSERT INTO orbitdata (${Object.keys(data[0])}) VALUES (${s}) 
                    ON CONFLICT (norad_cat_id) DO UPDATE SET (${Object.keys(data[0])}) = (${s})`;
                await pool.query(query, Object.values(data[0]).map(value => value === '' ? null : value));
                await pool.query(`INSERT INTO orbitdata_last_updated VALUES ($1, $2) ON CONFLICT (norad_cat_id) DO UPDATE SET last_update = $2`, [id, new Date()]);
            }
        } catch (err) {
            console.error(err, `update orbitdata operation on NORAD ID ${id}`);
        }
    }
}

const configuration = new Configuration({
    organization: process.env.OPENAI_ORG,
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

// TODO change this to only inject the prompt once
// TODO implement model feedback if the query fails
async function fetchGPTResponse(query) {
    const prompt = fs.readFileSync('./prompt.txt', 'utf8');
    let apiquery = prompt + query + "\n\nQueryGPT: ";
    const gptResponse = await openai.createChatCompletion({
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": apiquery}]
    }
    );
    const answer = gptResponse.data.choices[0].message.content;
    return answer;
}

const updateSatcatData = async (pool) => {
    try {
        const response = await fetch('https://celestrak.com/pub/satcat.csv');
        const data = Papa.parse(await response.text(), { header: true }).data.slice(0, -1);
        await pool.query('TRUNCATE TABLE satcatdata');
        const query = `INSERT INTO satcatdata (${Object.keys(data[0])}) VALUES (${s})`;
        await Promise.all(data.map(row => 
            pool.query(query, Object.values(row).map(value => value === '' ? null : value))
        ));
    } catch (err) {
        console.error(err);
    }
};

async function updateOrbitDataTable(pool) {
    try {
        const sqlQuery = `
            SELECT norad_cat_id
            FROM satcatdata_viable
            WHERE norad_cat_id NOT IN
                (SELECT norad_cat_id FROM orbitdata_last_updated
                    WHERE last_update > (NOW() - INTERVAL '3 days'))
            AND norad_cat_id NOT IN
                (SELECT norad_cat_id FROM no_gp) limit 200
        `;
        const result = await pool.query(sqlQuery);
        const norad_ids = result.rows.map(row => row.norad_cat_id);
        console.log(norad_ids);
        await fetchDataForNoradId(norad_ids, pool);
    } catch (err) {
        console.error(err);
    }
}