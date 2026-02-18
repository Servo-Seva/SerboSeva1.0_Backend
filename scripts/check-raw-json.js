require('dotenv').config();
const postgres = require('postgres');

async function checkRawJson() {
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

    try {
        const bookings = await sql`
      SELECT 
        id,
        service,
        service::text as service_text,
        service->>'service_id' as direct_extract,
        (service #>> '{}')::jsonb->>'service_id' as nested_extract
      FROM bookings 
      WHERE service IS NOT NULL
      LIMIT 3
    `;

        console.log('Raw JSON analysis:');
        bookings.forEach(b => {
            console.log('ID:', b.id);
            console.log('Raw service:', b.service);
            console.log('As text:', b.service_text);
            console.log('Direct extract:', b.direct_extract);
            console.log('Nested extract:', b.nested_extract);
            console.log('---');
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sql.end();
    }
}

checkRawJson();
