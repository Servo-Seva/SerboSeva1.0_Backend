require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function main() {
    const services = await sql`
        SELECT id, name, price, base_price, thumbnail_url 
        FROM services 
        WHERE name ILIKE '%website%' OR name ILIKE '%web%' 
        ORDER BY name
    `;
    console.log('Web Services:', services);

    await sql.end();
}

main();
