require('dotenv').config();
const postgres = require('postgres');

async function checkAdmins() {
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
    try {
        const admins = await sql`SELECT firebase_uid, email, is_admin FROM users WHERE is_admin = true`;
        console.log('Admin users:');
        console.log(JSON.stringify(admins, null, 2));

        const allUsers = await sql`SELECT firebase_uid, email, is_admin FROM users LIMIT 10`;
        console.log('\nFirst 10 users:');
        console.log(JSON.stringify(allUsers, null, 2));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.end();
    }
}

checkAdmins();
