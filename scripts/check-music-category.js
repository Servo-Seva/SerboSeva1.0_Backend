require('dotenv').config();
const postgres = require('postgres');

async function checkMusicCategory() {
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
    try {
        // Check if Music & Band category exists
        const categories = await sql`SELECT id, name FROM categories WHERE name ILIKE '%music%' OR name ILIKE '%band%'`;
        console.log('Music/Band categories found:', categories);

        if (categories.length > 0) {
            const catId = categories[0].id;
            
            // Check subcategories
            const subcategories = await sql`SELECT id, name FROM subcategories WHERE category_id = ${catId}`;
            console.log('Subcategories:', subcategories);

            // Check services count
            for (const sub of subcategories) {
                const services = await sql`SELECT id, name, base_price FROM services WHERE subcategory_id = ${sub.id}`;
                console.log(`Services in ${sub.name}:`, services);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sql.end();
    }
}

checkMusicCategory();
