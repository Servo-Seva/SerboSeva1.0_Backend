require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function main() {
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'categories'`;
    console.log('Categories columns:', cols.map(c => c.column_name));

    const cats = await sql`SELECT * FROM categories LIMIT 2`;
    console.log('Sample categories:', cats);

    await sql.end();
}

main();
