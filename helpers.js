import dotenv from 'dotenv';
dotenv.config({ path: './config.env' });

export { fetchDataForNoradId, fetchGPTResponse };
import Papa from 'papaparse';
import { Configuration, OpenAIApi } from "openai";
import fs from 'fs';

async function fetchDataForNoradId (norad_ids, pool) {
    for (const id of norad_ids) {
        const response = await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${id}&FORMAT=csv`);
        const text = await response.text();
        if (text.trim() === "No GP data found") {
            console.error(`No data found for object with NORAD CAT ID: ${id}`);
            const query = `INSERT INTO no_gp (norad_cat_id, gp_data_available) VALUES ($1, $2)`;
            const values = [id, false];
            await pool.query(query, values);
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
        "model": "gpt-4",
        "messages": [{"role": "user", "content": apiquery}]
    }
    );
    const answer = gptResponse.data.choices[0].message.content;
    return answer;
}