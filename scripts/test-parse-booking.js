require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

function parseBookingWithImage(row) {
    if (!row) return null;

    let service =
        typeof row.service === "string" ? JSON.parse(row.service) : row.service;

    // Use stored image_url or fallback to service thumbnail from services table
    if (!service.image_url && row.service_thumbnail) {
        service.image_url = row.service_thumbnail;
    }

    return {
        id: row.id,
        service,
        service_thumbnail: row.service_thumbnail,
    };
}

async function check() {
    try {
        const result = await sql`
            SELECT b.id, b.service, s.thumbnail_url as service_thumbnail 
            FROM bookings b
            LEFT JOIN services s ON s.id::text = ((b.service #>> '{}')::jsonb->>'service_id')
            LIMIT 2
        `;

        console.log('=== Raw result ===');
        console.log(result[0]);

        console.log('\n=== After parseBookingWithImage ===');
        const parsed = parseBookingWithImage(result[0]);
        console.log(parsed);
        console.log('\nService image_url:', parsed.service.image_url);

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

check();
