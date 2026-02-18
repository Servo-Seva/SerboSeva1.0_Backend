require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function check() {
    try {
        // Check services table
        const services = await sql`SELECT id, name, thumbnail_url FROM services LIMIT 3`;
        console.log('=== Services Table ===');
        console.log(services);

        // Check booking service_id format
        const bookings = await sql`SELECT id, service->>'service_id' as service_id FROM bookings LIMIT 3`;
        console.log('\n=== Booking service_id ===');
        console.log(bookings);

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

check();
