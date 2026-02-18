require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL);

async function check() {
    const r = await sql`SELECT id, user_id, status, provider_id FROM bookings WHERE status = 'assigned'`;
    console.log(JSON.stringify(r, null, 2));
    await sql.end();
}

check();
