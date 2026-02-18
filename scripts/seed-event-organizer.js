require('dotenv').config();
const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function seedEventOrganizer() {
    try {
        console.log('=== Seeding Event Organizer Category ===\n');

        // Read and execute the migration
        const migrationPath = path.join(__dirname, '../migrations/035_add_event_organizer_category.sql');
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        await sql.unsafe(migrationSql);

        console.log('Migration executed successfully!\n');

        // Verify the data
        const category = await sql`SELECT id, name FROM categories WHERE name = 'Event Organizer'`;
        console.log('Category created:', JSON.stringify(category, null, 2));

        if (category.length > 0) {
            const subcategories = await sql`SELECT id, name FROM subcategories WHERE category_id = ${category[0].id}`;
            console.log('\nSubcategories created:', JSON.stringify(subcategories, null, 2));

            const services = await sql`
                SELECT s.id, s.name, s.base_price, sc.name as subcategory_name
                FROM services s
                JOIN subcategories sc ON s.subcategory_id = sc.id
                WHERE sc.category_id = ${category[0].id}
                ORDER BY sc.name, s.name
            `;
            console.log('\nServices created:', services.length);
            console.log(JSON.stringify(services, null, 2));
        }

        await sql.end();
        console.log('\n✅ Event Organizer category seeded successfully!');
    } catch (err) {
        console.error('Error:', err.message);
        await sql.end();
        process.exit(1);
    }
}

seedEventOrganizer();
