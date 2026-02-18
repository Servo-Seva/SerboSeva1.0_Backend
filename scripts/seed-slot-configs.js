require('dotenv').config();
const postgres = require('postgres');

async function seedSlotConfigs() {
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

    try {
        // Get some services to add configs for
        const services = await sql`
      SELECT id, name FROM services 
      WHERE name IN ('AC Repair & Service', 'Haircut', 'Plumbing', 'Facial', 'AC General Service')
      LIMIT 5
    `;

        console.log('Found services:', services.map(s => s.name));

        // First, add a global default config (no service_id)
        const existingDefault = await sql`
      SELECT id FROM slot_configs WHERE service_id IS NULL AND day_of_week IS NULL
    `;

        if (existingDefault.length === 0) {
            await sql`
        INSERT INTO slot_configs (service_id, day_of_week, start_time, end_time, slot_duration_minutes, gap_between_slots_minutes, max_bookings_per_slot, is_active)
        VALUES (NULL, NULL, '09:00', '18:00', 60, 0, 5, true)
      `;
            console.log('✅ Created global default slot config (09:00-18:00, 60min slots)');
        } else {
            console.log('ℹ️ Global default config already exists');
        }

        // Add service-specific configs
        for (const service of services) {
            const existing = await sql`
        SELECT id FROM slot_configs WHERE service_id = ${service.id}
      `;

            if (existing.length > 0) {
                console.log(`ℹ️ Config for "${service.name}" already exists`);
                continue;
            }

            // Different slots for different service types
            let config;
            if (service.name.includes('AC')) {
                // AC services: 8am-6pm, 90 min slots
                config = { start: '08:00', end: '18:00', duration: 90, gap: 30, max: 3 };
            } else if (service.name.includes('Haircut')) {
                // Haircut: 10am-9pm, 30 min slots
                config = { start: '10:00', end: '21:00', duration: 30, gap: 0, max: 2 };
            } else if (service.name.includes('Facial')) {
                // Facial: 10am-7pm, 45 min slots
                config = { start: '10:00', end: '19:00', duration: 45, gap: 15, max: 2 };
            } else {
                // Default for others: 9am-6pm, 60 min slots
                config = { start: '09:00', end: '18:00', duration: 60, gap: 0, max: 5 };
            }

            await sql`
        INSERT INTO slot_configs (service_id, day_of_week, start_time, end_time, slot_duration_minutes, gap_between_slots_minutes, max_bookings_per_slot, is_active)
        VALUES (${service.id}, NULL, ${config.start}, ${config.end}, ${config.duration}, ${config.gap}, ${config.max}, true)
      `;
            console.log(`✅ Created config for "${service.name}": ${config.start}-${config.end}, ${config.duration}min slots`);
        }

        // Show all configs
        const allConfigs = await sql`
      SELECT sc.*, s.name as service_name
      FROM slot_configs sc
      LEFT JOIN services s ON sc.service_id = s.id
      ORDER BY sc.service_id NULLS FIRST
    `;

        console.log('\n📋 All Slot Configurations:');
        console.log('─'.repeat(80));
        for (const c of allConfigs) {
            const serviceName = c.service_name || '(Global Default)';
            const dayName = c.day_of_week !== null ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][c.day_of_week] : 'All Days';
            console.log(`${serviceName}: ${c.start_time}-${c.end_time} | ${c.slot_duration_minutes}min slots | ${dayName} | Max: ${c.max_bookings_per_slot}/slot`);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.end();
    }
}

seedSlotConfigs();
