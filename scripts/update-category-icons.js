require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function updateCategoryIcons() {
    try {
        // Professional icon images from flaticon/cdn (PNG format, clean icons)
        const categoryIcons = {
            'AC & Appliances': 'https://cdn-icons-png.flaticon.com/128/3274/3274231.png',
            'Beauty & Salon': 'https://cdn-icons-png.flaticon.com/128/3163/3163010.png',
            'Carpenter': 'https://cdn-icons-png.flaticon.com/128/2830/2830324.png',
            'Electrician': 'https://cdn-icons-png.flaticon.com/128/4635/4635163.png',
            'Furniture & Upholstery': 'https://cdn-icons-png.flaticon.com/128/3649/3649579.png',
            'Home Repair': 'https://cdn-icons-png.flaticon.com/128/1067/1067357.png',
            'Music & Band': 'https://cdn-icons-png.flaticon.com/128/3659/3659784.png',
            'Painting': 'https://cdn-icons-png.flaticon.com/128/1648/1648784.png',
            'Plumbing': 'https://cdn-icons-png.flaticon.com/128/4635/4635189.png',
            'Tutor/Teacher': 'https://cdn-icons-png.flaticon.com/128/3976/3976631.png',
            'Event Organizer': 'https://cdn-icons-png.flaticon.com/128/2421/2421991.png',
        };

        console.log('=== Updating Category Icons ===\n');

        for (const [name, imageUrl] of Object.entries(categoryIcons)) {
            const result = await sql`
                UPDATE categories 
                SET image_url = ${imageUrl} 
                WHERE name = ${name}
                RETURNING id, name, image_url
            `;
            if (result.length > 0) {
                console.log(`✅ Updated: ${name}`);
            } else {
                console.log(`⚠️ Not found: ${name}`);
            }
        }

        // Verify updates
        console.log('\n=== Current Category Icons ===');
        const cats = await sql`SELECT id, name, image_url FROM categories ORDER BY name`;
        console.log(JSON.stringify(cats, null, 2));

        await sql.end();
        console.log('\n✅ Category icons updated successfully!');
    } catch (err) {
        console.error('Error:', err.message);
        await sql.end();
        process.exit(1);
    }
}

updateCategoryIcons();
