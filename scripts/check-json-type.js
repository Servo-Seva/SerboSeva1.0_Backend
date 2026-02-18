require('dotenv').config();
const postgres = require('postgres');

async function checkJsonType() {
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

    try {
        // Check the column type
        const colInfo = await sql`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'service'
    `;
        console.log('Column info:', colInfo);

        // Check if we can extract service_id properly
        const test = await sql`
      SELECT 
        id,
        pg_typeof(service) as service_type,
        service,
        CASE 
          WHEN pg_typeof(service) = 'jsonb'::regtype THEN service->>'service_id'
          ELSE (service::jsonb)->>'service_id'
        END as extracted_service_id
      FROM bookings 
      LIMIT 3
    `;
        console.log('\nService extraction test:');
        test.forEach(t => {
            console.log('ID:', t.id);
            console.log('Type:', t.service_type);
            console.log('Extracted service_id:', t.extracted_service_id);
            console.log('---');
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sql.end();
    }
}

checkJsonType();
