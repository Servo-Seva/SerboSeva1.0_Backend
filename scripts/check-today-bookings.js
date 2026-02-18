require('dotenv').config();
const postgres = require('postgres');

async function checkTodayBookings() {
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
    const acDeepCleaningId = 'db7427c7-b281-499a-829e-1ab55c4652e0';

    try {
        // Check all bookings for today
        const todayBookings = await sql`
      SELECT 
        id, 
        booking_date, 
        time_slot, 
        status,
        CASE 
          WHEN jsonb_typeof(service) = 'string' THEN (service #>> '{}')::jsonb->>'service_id'
          ELSE service->>'service_id'
        END as service_id,
        CASE 
          WHEN jsonb_typeof(service) = 'string' THEN (service #>> '{}')::jsonb->>'service_name'
          ELSE service->>'service_name'
        END as service_name
      FROM bookings 
      WHERE booking_date = '2026-01-23'
      ORDER BY created_at DESC
    `;

        console.log('All bookings for 2026-01-23:');
        console.log(JSON.stringify(todayBookings, null, 2));

        // Check AC Deep Cleaning bookings specifically
        const acBookings = await sql`
      SELECT 
        id, 
        booking_date, 
        time_slot, 
        status,
        created_at
      FROM bookings 
      WHERE booking_date = '2026-01-23'
      AND (
        CASE 
          WHEN jsonb_typeof(service) = 'string' THEN (service #>> '{}')::jsonb->>'service_id'
          ELSE service->>'service_id'
        END
      ) = ${acDeepCleaningId}
    `;

        console.log('\nAC Deep Cleaning bookings for 2026-01-23:');
        console.log(JSON.stringify(acBookings, null, 2));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sql.end();
    }
}

checkTodayBookings();
