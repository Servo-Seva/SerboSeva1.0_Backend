require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL);

async function checkBookings() {
    try {
        const bookings = await sql`
      SELECT b.id, b.status, b.provider_id, b.assigned_at, p.name as provider_name, p.phone as provider_phone
      FROM bookings b
      LEFT JOIN providers p ON b.provider_id = p.id
      ORDER BY b.created_at DESC
      LIMIT 10
    `;
        console.log('Recent bookings with provider info:');
        console.log(JSON.stringify(bookings, null, 2));

        await sql.end();
    } catch (err) {
        console.error('Error:', err);
        await sql.end();
    }
}

checkBookings();
