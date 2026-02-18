require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function check() {
    try {
        const offers = await sql`SELECT id, title, subtitle, category_id FROM offers WHERE is_active = true ORDER BY display_order`;
        console.log('Current offers:');
        console.log(JSON.stringify(offers, null, 2));

        // Check services with discounts
        const discountedServices = await sql`
            SELECT id, name, price, base_price, 
                   CASE WHEN base_price > 0 AND price < base_price 
                        THEN ROUND(((base_price - price) / base_price) * 100)
                        ELSE 0 
                   END as discount_percent
            FROM services 
            WHERE base_price > price AND is_active = true
            ORDER BY discount_percent DESC
            LIMIT 20
        `;
        console.log('\nServices with discounts:');
        console.log(JSON.stringify(discountedServices, null, 2));

        await sql.end();
    } catch (err) {
        console.error('Error:', err.message);
        await sql.end();
    }
}

check();
