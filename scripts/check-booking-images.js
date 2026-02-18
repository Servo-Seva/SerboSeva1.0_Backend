require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function checkBookingImages() {
    try {
        const rows = await sql`
      SELECT id, order_number, service 
      FROM bookings 
      ORDER BY created_at DESC 
      LIMIT 5
    `;

        console.log('=== Checking image_url in bookings ===\n');

        for (const row of rows) {
            const service = typeof row.service === 'string'
                ? JSON.parse(row.service)
                : row.service;

            console.log(`Order: ${row.order_number}`);
            console.log(`  Service: ${service.service_name}`);
            console.log(`  image_url: ${service.image_url || 'NOT FOUND'}`);
            console.log('');
        }

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkBookingImages();
