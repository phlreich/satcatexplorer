import dotenv from 'dotenv';
dotenv.config({ path: './config.env' });

export { fetchDataForNoradId, fetchGPTResponse };
import Papa from 'papaparse';
import { Configuration, OpenAIApi } from "openai";
import fs from 'fs';

async function fetchDataForNoradId(norad_ids, pool) {
    try {
        const fetchPromises = norad_ids.map(id =>
            fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${id}&FORMAT=csv`)
            .catch(error => console.error(`Failed to fetch for NORAD ID ${id}: ${error}`))
        );
        const responses = await Promise.all(fetchPromises);
        const textPromises = responses.map(response => response.text());
        const texts = await Promise.all(textPromises);

        const queryPromises = texts.map(async (text, index) => {
            const id = norad_ids[index];
            if (text.trim() === "No GP data found") {
                console.error(`No data found for object with NORAD CAT ID: ${id}`);
                const query = `INSERT INTO no_gp (norad_cat_id, gp_data_available) VALUES ($1, $2)`;
                const values = [id, false];
                return pool.query(query, values);
            }
            const csvData = Papa.parse(text, { header: true }).data[0];
            const query = `INSERT INTO orbitdata (object_name, object_id, epoch, mean_motion, eccentricity, inclination, ra_of_asc_node, 
                    arg_of_pericenter, mean_anomaly, ephemeris_type, classification_type, norad_cat_id, element_set_no, rev_at_epoch, 
                    bstar, mean_motion_dot, mean_motion_ddot) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) 
                ON CONFLICT (norad_cat_id) DO UPDATE SET (object_name, object_id, epoch, mean_motion, eccentricity, inclination, ra_of_asc_node, 
                    arg_of_pericenter, mean_anomaly, ephemeris_type, classification_type, element_set_no, rev_at_epoch, 
                    bstar, mean_motion_dot, mean_motion_ddot) = ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $13, $14, $15, $16, $17)`;
            const values = Object.values(csvData);
            return pool.query(query, values);
        });

        await Promise.all(queryPromises);
    } catch (error) {
        console.error(`Failed to fetch data for NORAD IDs: ${error}
        norad_ids: ${norad_ids}`);
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