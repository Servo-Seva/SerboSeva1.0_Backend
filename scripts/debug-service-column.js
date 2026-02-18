require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function check() {
    try {
        const result = await sql`
            SELECT b.id, b.service, pg_typeof(b.service) as service_type
            FROM bookings b
            LIMIT 1
        `;

        console.log('Service column type:', result[0].service_type);
        console.log('Service raw value:', result[0].service);
        console.log('Service type in JS:', typeof result[0].service);

        // Try parsing if it's a string
        if (typeof result[0].service === 'string') {
            const parsed = JSON.parse(result[0].service);
            console.log('Parsed service:', parsed);
            console.log('Service ID from parsed:', parsed.service_id);
        }

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

check();
