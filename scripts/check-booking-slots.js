require('dotenv').config();
const postgres = require('postgres');

async function checkBookings() {
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

    try {
        const bookings = await sql`
      SELECT time_slot, service->>'service_id' as service_id, status, booking_date
      FROM bookings 
      ORDER BY created_at DESC
      LIMIT 10
    `;

        console.log('Recent bookings:');
        console.log(JSON.stringify(bookings, null, 2));

        // Check a specific date
        const today = new Date().toISOString().split('T')[0];
        const slotCounts = await sql`
      SELECT 
        time_slot,
        COUNT(*) as booking_count
      FROM bookings
      WHERE 
        booking_date = ${today}
        AND status NOT IN ('cancelled', 'completed', 'failed')
      GROUP BY time_slot
    `;

        console.log(`\nBooking counts for ${today}:`);
        console.log(JSON.stringify(slotCounts, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.end();
    }
}

checkBookings();
