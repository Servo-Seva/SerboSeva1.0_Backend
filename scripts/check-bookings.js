require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function checkBookings() {
    try {
        const rows = await sql`
      SELECT id, order_number, user_id, status, payment_status, created_at 
      FROM bookings 
      ORDER BY created_at DESC 
      LIMIT 10
    `;

        console.log('=== Recent Bookings ===');
        console.log(JSON.stringify(rows, null, 2));
        console.log(`\nTotal: ${rows.length} bookings`);

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkBookings();
