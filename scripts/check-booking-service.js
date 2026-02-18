require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function check() {
    try {
        const bookings = await sql`SELECT id, service FROM bookings LIMIT 2`;
        console.log('=== Booking service JSON ===');
        for (const b of bookings) {
            console.log('Booking ID:', b.id);
            console.log('Service:', JSON.stringify(b.service, null, 2));
            console.log('---');
        }

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

check();
