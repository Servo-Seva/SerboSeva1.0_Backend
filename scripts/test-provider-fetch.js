require('dotenv').config();
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

async function test() {
    try {
        const bookingId = '37436764-fae9-405a-bbe1-7d440ef4cb01';

        const result = await sql`
      SELECT b.*, 
             p.name as provider_name,
             p.phone as provider_phone,
             COALESCE(
               (SELECT pd.file_url FROM provider_documents pd WHERE pd.provider_id = p.id AND pd.document_type = 'photo' LIMIT 1),
               p.avatar_url
             ) as provider_photo,
             p.email as provider_email,
             p.specializations as provider_specializations
      FROM bookings b
      LEFT JOIN providers p ON b.provider_id = p.id
      WHERE b.id = ${bookingId}
    `;

        console.log('=== Raw Query Result ===');
        console.log('provider_id:', result[0].provider_id);
        console.log('provider_name:', result[0].provider_name);
        console.log('provider_phone:', result[0].provider_phone);
        console.log('provider_photo:', result[0].provider_photo);
        console.log('provider_email:', result[0].provider_email);
        console.log('provider_specializations:', result[0].provider_specializations);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

test();
