require('dotenv').config({ path: '../.env' });
const postgres = require('postgres');

async function checkReviews() {
    try {
        const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

        // Check reviews
        const reviews = await sql`SELECT * FROM service_reviews ORDER BY created_at DESC LIMIT 10`;
        console.log('Reviews in database:', reviews.length);
        console.log(JSON.stringify(reviews, null, 2));

        // Check completed bookings with their service info
        console.log('\n--- Completed Bookings ---');
        const bookings = await sql`SELECT id, status, service, user_id FROM bookings WHERE status = 'completed' ORDER BY created_at DESC LIMIT 5`;
        console.log('Completed bookings:', bookings.length);
        for (const b of bookings) {
            console.log('Booking ID:', b.id);
            console.log('Service:', b.service);
            console.log('User ID:', b.user_id);
            console.log('---');
        }

        // Check if there are any services matching the booking's service_id
        if (bookings.length > 0 && bookings[0].service) {
            const serviceInfo = bookings[0].service;
            const serviceId = serviceInfo.service_id;
            console.log('\nLooking for service with ID:', serviceId);
            const services = await sql`SELECT id, name FROM services WHERE id = ${serviceId}`;
            console.log('Service found:', services.length > 0 ? services[0] : 'NOT FOUND');
        }

        await sql.end();
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

checkReviews();
