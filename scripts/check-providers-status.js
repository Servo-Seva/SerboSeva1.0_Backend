require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL);

async function checkProviders() {
    try {
        const providers = await sql`SELECT id, name, phone, status FROM providers`;
        console.log('All providers:');
        console.log(JSON.stringify(providers, null, 2));

        const approved = await sql`SELECT id, name, phone, status FROM providers WHERE status = 'approved'`;
        console.log('\nApproved providers:');
        console.log(JSON.stringify(approved, null, 2));

        await sql.end();
    } catch (err) {
        console.error('Error:', err);
        await sql.end();
    }
}

checkProviders();
