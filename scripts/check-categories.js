require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function checkCategories() {
    try {
        const categories = await sql`SELECT id, name FROM categories ORDER BY name`;
        console.log('=== All Categories ===');
        console.log(JSON.stringify(categories, null, 2));

        // Check if any event-related category exists
        const eventCategory = categories.find(cat =>
            cat.name?.toLowerCase().includes('event') ||
            cat.name?.toLowerCase().includes('organizer') ||
            cat.name?.toLowerCase().includes('wedding') ||
            cat.name?.toLowerCase().includes('party')
        );

        if (eventCategory) {
            console.log('\n=== Found Event Category ===');
            console.log(eventCategory);

            // Check subcategories
            const subcategories = await sql`SELECT id, name FROM subcategories WHERE category_id = ${eventCategory.id}`;
            console.log('\n=== Subcategories ===');
            console.log(JSON.stringify(subcategories, null, 2));

            // Check services
            for (const sub of subcategories) {
                const services = await sql`SELECT id, name FROM services WHERE subcategory_id = ${sub.id} LIMIT 5`;
                console.log(`\n=== Services in ${sub.name} ===`);
                console.log(JSON.stringify(services, null, 2));
            }
        } else {
            console.log('\n*** No event-related category found! ***');
            console.log('You need to create an "Event Organizer" category with subcategories and services.');
        }

        await sql.end();
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkCategories();
