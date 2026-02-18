require('dotenv').config();
const postgres = require('postgres');

async function checkBookingServices() {
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

    try {
        const bookings = await sql`
      SELECT id, time_slot, booking_date, service, status
      FROM bookings 
      ORDER BY created_at DESC 
      LIMIT 5
    `;

        console.log('Recent bookings with service data:\n');
        bookings.forEach(b => {
            console.log('Booking ID:', b.id);
            console.log('Date:', b.booking_date);
            console.log('Time Slot:', b.time_slot);
            console.log('Status:', b.status);
            console.log('Service:', JSON.stringify(b.service, null, 2));
            console.log('---');
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sql.end();
    }
}

checkBookingServices();
