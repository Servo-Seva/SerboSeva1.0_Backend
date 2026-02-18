require('dotenv').config();
const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function runMigration() {
    try {
        console.log('Running migration: Create offer_services table...\n');

        // Read and execute the migration SQL
        const migrationPath = path.join(__dirname, '../migrations/031_create_offer_services.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        const result = await sql.unsafe(migrationSQL);

        console.log('✅ Migration completed successfully!\n');

        // Verify the offer-service links
        const links = await sql`
            SELECT 
                o.title as offer_title,
                s.name as service_name,
                os.discount_percent
            FROM offer_services os
            JOIN offers o ON os.offer_id = o.id
            JOIN services s ON os.service_id = s.id
            ORDER BY o.title, s.name
        `;

        console.log('Offer-Service Links:');
        console.log('====================');
        let currentOffer = '';
        links.forEach(link => {
            if (link.offer_title !== currentOffer) {
                console.log(`\n📦 ${link.offer_title}:`);
                currentOffer = link.offer_title;
            }
            console.log(`   - ${link.service_name} (${link.discount_percent}% off)`);
        });

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        console.error(err);
        await sql.end();
        process.exit(1);
    }
}

runMigration();
