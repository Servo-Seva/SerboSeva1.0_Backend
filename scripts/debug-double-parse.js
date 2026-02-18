require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function check() {
    try {
        const result = await sql`
            SELECT b.id, b.service, s.thumbnail_url as service_thumbnail 
            FROM bookings b
            LEFT JOIN services s ON s.id::text = ((b.service #>> '{}')::jsonb->>'service_id')
            LIMIT 1
        `;

        const row = result[0];
        console.log('=== Raw row ===');
        console.log('service type:', typeof row.service);
        console.log('service value:', row.service);
        console.log('service_thumbnail:', row.service_thumbnail);

        // Simulate what parseBookingWithImage does
        console.log('\n=== After first JSON.parse ===');
        let service = typeof row.service === "string" ? JSON.parse(row.service) : row.service;
        console.log('service type after parse:', typeof service);
        console.log('service value after parse:', service);

        // Check if it's still a string (double encoded)
        if (typeof service === "string") {
            console.log('\n=== Double encoded! Parsing again ===');
            service = JSON.parse(service);
            console.log('service after second parse:', service);
        }

        console.log('\nservice.image_url before fallback:', service.image_url);

        // Add fallback
        if (!service.image_url && row.service_thumbnail) {
            service.image_url = row.service_thumbnail;
        }

        console.log('service.image_url after fallback:', service.image_url);

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

check();
