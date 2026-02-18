require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function check() {
    try {
        // First let's just see what raw SQL gives us
        const result = await sql`
            SELECT id, service
            FROM bookings
            LIMIT 1
        `;

        console.log('Raw result:', result[0]);

        // Try direct JSONB extraction
        const result2 = await sql.unsafe(`
            SELECT id, service, service->>'service_id' as sid
            FROM bookings
            LIMIT 1
        `);

        console.log('\nWith JSONB extraction:', result2[0]);

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

check();
