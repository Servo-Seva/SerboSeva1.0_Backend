require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL);

async function check() {
    // Get all bookings with their user_id and provider info
    const bookings = await sql`
    SELECT 
      b.id, 
      b.user_id, 
      b.status, 
      b.provider_id,
      p.name as provider_name,
      p.phone as provider_phone
    FROM bookings b
    LEFT JOIN providers p ON b.provider_id = p.id
    ORDER BY b.created_at DESC
  `;

    console.log('All bookings with provider info:');
    bookings.forEach(b => {
        console.log(`- Booking ${b.id.slice(0, 8)}... | User: ${b.user_id.slice(0, 8)}... | Status: ${b.status} | Provider: ${b.provider_name || 'None'}`);
    });

    await sql.end();
}

check();
