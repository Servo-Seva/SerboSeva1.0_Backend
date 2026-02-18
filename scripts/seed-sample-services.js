// Robust seed script compatible with CommonJS
try { require('dotenv').config(); } catch (e) { }
const postgres = require('postgres');

async function run() {
    const sqlUrl = process.env.DATABASE_URL;
    if (!sqlUrl) {
        console.error('DATABASE_URL not set');
        process.exit(1);
    }

    const client = postgres(sqlUrl, { ssl: 'require' });

    // create sample categories
    const categories = [
        { name: 'Cleaning', description: 'Professional home cleaning services' },
        { name: 'Beauty & Spa', description: 'Personal care and beauty services' },
        { name: 'AC & Appliances', description: 'AC and appliance maintenance' },
        { name: 'Electrician', description: 'Electrical repair and installation' },
    ];

    const createdCats = {};
    for (const c of categories) {
        const rows = await client`
      insert into categories (name, description) values (${c.name}, ${c.description})
      on conflict (name) do update set description = excluded.description
      returning id, name
    `;
        if (!rows || rows.length === 0) continue;
        createdCats[rows[0].name] = rows[0].id;
    }

    // sample services for Cleaning
    const cleaningServices = [
        { name: 'Full Home Deep Cleaning', description: 'Complete home cleaning including kitchen, bathrooms, bedrooms', price: 2499, avg_rating: 4.8, reviews_count: 2341, duration_minutes: 240, thumbnail_url: null },
        { name: 'Bathroom Cleaning', description: 'Deep cleaning of bathrooms with sanitization', price: 499, avg_rating: 4.7, reviews_count: 1823, duration_minutes: 60, thumbnail_url: null },
        { name: 'Kitchen Cleaning', description: 'Thorough kitchen cleaning including appliances', price: 799, avg_rating: 4.9, reviews_count: 1456, duration_minutes: 120, thumbnail_url: null },
    ];

    for (const s of cleaningServices) {
        const rows = await client`
      insert into services (name, description, price, avg_rating, reviews_count, duration_minutes, currency)
      values (${s.name}, ${s.description}, ${s.price}, ${s.avg_rating}, ${s.reviews_count}, ${s.duration_minutes}, 'INR')
      on conflict (name) do update set price = excluded.price, avg_rating = excluded.avg_rating, reviews_count = excluded.reviews_count
      returning id, name
    `;
        if (!rows || rows.length === 0) continue;
        const svcId = rows[0].id;
        if (createdCats['Cleaning']) {
            await client`
        insert into category_services (category_id, service_id) values (${createdCats['Cleaning']}, ${svcId}) on conflict do nothing
      `;
        }
    }

    console.log('Seeded sample categories and services');
    await client.end();
}

run().catch(err => { console.error('seed error:', err && err.message ? err.message : err); process.exit(1); });
