require('dotenv').config();
const postgres = require('postgres');

async function testMaxCapacity() {
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

    try {
        // Get the slot config for max capacity
        const configs = await sql`SELECT * FROM slot_configs LIMIT 1`;
        const maxCapacity = configs.length > 0 ? configs[0].max_bookings_per_slot : 5;
        console.log(`Max capacity per slot: ${maxCapacity}`);

        const testDate = '2026-01-30';
        const testSlot = '10:00 AM';

        // Check current count for test slot
        const countBefore = await sql`
      SELECT COUNT(*) as cnt FROM bookings 
      WHERE booking_date = ${testDate} 
      AND time_slot = ${testSlot}
      AND status NOT IN ('cancelled', 'completed', 'failed')
    `;
        console.log(`Current bookings for ${testDate} ${testSlot}: ${countBefore[0].cnt}`);

        // Create test bookings to fill up the slot
        const neededBookings = maxCapacity - parseInt(countBefore[0].cnt);
        console.log(`Creating ${neededBookings} test bookings to fill the slot...`);

        for (let i = 0; i < neededBookings; i++) {
            await sql`
        INSERT INTO bookings (user_id, service, total_amount, currency, delivery_address, booking_date, time_slot, status)
        VALUES (
          'test_user_' || ${i},
          '{"service_id": "test-service", "service_name": "Test Service", "quantity": 1, "price": 100}'::jsonb,
          100,
          'INR',
          '{"line1": "Test Address"}'::jsonb,
          ${testDate},
          ${testSlot},
          'confirmed'
        )
      `;
        }

        console.log(`✅ Created ${neededBookings} bookings. Slot should now be full.`);

        // Verify the slot is now full
        const countAfter = await sql`
      SELECT COUNT(*) as cnt FROM bookings 
      WHERE booking_date = ${testDate} 
      AND time_slot = ${testSlot}
      AND status NOT IN ('cancelled', 'completed', 'failed')
    `;
        console.log(`\nBookings after: ${countAfter[0].cnt}/${maxCapacity}`);
        console.log(`Slot should be unavailable: ${parseInt(countAfter[0].cnt) >= maxCapacity}`);

        console.log(`\n📋 Test the API: GET http://localhost:5000/api/slots/available?date=${testDate}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.end();
    }
}

testMaxCapacity();
