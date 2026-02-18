require('dotenv').config();
const postgres = require('postgres');

async function checkACDeepCleaning() {
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

    try {
        // Find AC Deep Cleaning service
        const services = await sql`
      SELECT id, name FROM services WHERE name ILIKE '%AC Deep%'
    `;
        console.log('Services found:', services);

        if (services.length === 0) {
            console.log('No AC Deep Cleaning service found');
            return;
        }

        const serviceId = services[0].id;
        console.log(`\nService ID: ${serviceId}`);

        // Check slot config for this service
        const configs = await sql`
      SELECT * FROM slot_configs WHERE service_id = ${serviceId}
    `;
        console.log('\nSlot configs for this service:', configs);

        // Check bookings for this service
        const bookings = await sql`
      SELECT id, booking_date, time_slot, status, service->>'service_id' as svc_id
      FROM bookings 
      WHERE (service->>'service_id')::text = ${serviceId}
      ORDER BY created_at DESC
      LIMIT 5
    `;
        console.log('\nRecent bookings for this service:', bookings);

        // Check API response for a specific date
        const testDate = '2026-01-24';
        const slotCounts = await sql`
      SELECT 
        time_slot,
        COUNT(*) as booking_count
      FROM bookings
      WHERE 
        booking_date = ${testDate}
        AND status NOT IN ('cancelled', 'completed', 'failed')
        AND (service->>'service_id')::text = ${serviceId}
      GROUP BY time_slot
    `;
        console.log(`\nBooking counts for ${testDate}:`, slotCounts);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sql.end();
    }
}

checkACDeepCleaning();
