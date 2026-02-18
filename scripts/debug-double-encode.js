require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function check() {
    try {
        // Check if it's double-encoded - stored as a JSON string within JSONB
        const result = await sql.unsafe(`
            SELECT id, 
                   service,
                   pg_typeof(service) as type,
                   (service #>> '{}')::jsonb->>'service_id' as sid_unescaped,
                   service::text as service_text
            FROM bookings
            LIMIT 1
        `);

        console.log('Result:', result[0]);

        // Check if the value starts with a quote (meaning it's a JSON string)
        const serviceText = result[0].service_text;
        console.log('\nService text first char:', serviceText[0]);
        console.log('Is it a quoted string?', serviceText[0] === '"');

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

check();
