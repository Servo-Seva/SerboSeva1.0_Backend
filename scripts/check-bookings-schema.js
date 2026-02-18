require('dotenv').config({ path: '../.env' });
const postgres = require('postgres');

async function checkSchema() {
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

    try {
        // Check bookings table schema
        const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bookings'
      ORDER BY ordinal_position
    `;
        console.log('Bookings table columns:');
        console.log(JSON.stringify(columns, null, 2));

        // Also check service_reviews schema
        const reviewColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'service_reviews'
      ORDER BY ordinal_position
    `;
        console.log('\nService_reviews table columns:');
        console.log(JSON.stringify(reviewColumns, null, 2));

        // Check a sample booking
        const sampleBooking = await sql`SELECT id, user_id FROM bookings LIMIT 1`;
        console.log('\nSample booking:');
        console.log(JSON.stringify(sampleBooking, null, 2));

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await sql.end();
        process.exit();
    }
}

checkSchema();
