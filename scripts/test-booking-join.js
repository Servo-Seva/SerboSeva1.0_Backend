require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function check() {
    try {
        const result = await sql`
            SELECT b.id, b.service::jsonb->>'service_id' as service_id, 
                   b.service::jsonb->>'service_name' as service_name,
                   s.thumbnail_url as service_thumbnail 
            FROM bookings b
            LEFT JOIN services s ON s.id::text = (b.service::jsonb->>'service_id')
            LIMIT 3
        `;

        console.log('=== Bookings with thumbnail JOIN ===');
        for (const r of result) {
            console.log(`Service: ${r.service_name}`);
            console.log(`  Service ID: ${r.service_id}`);
            console.log(`  Thumbnail: ${r.service_thumbnail || 'NOT FOUND'}`);
            console.log('');
        }

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

check();
