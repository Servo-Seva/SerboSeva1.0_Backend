require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function main() {
    const cats = await sql`SELECT id, name FROM categories WHERE name ILIKE '%professional%'`;
    console.log('Professional Services category:', cats);

    const subs = await sql`SELECT id, name, category_id FROM subcategories WHERE name ILIKE '%digital%'`;
    console.log('Digital Services subcategory:', subs);

    await sql.end();
}

main();
