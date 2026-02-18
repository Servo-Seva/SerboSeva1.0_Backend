require('dotenv').config();
const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function runMigration() {
    try {
        console.log('Running migration: Add free inspection services...\n');

        // Read and execute the migration SQL
        const migrationPath = path.join(__dirname, '../migrations/030_add_free_inspection_services.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        await sql.unsafe(migrationSQL);

        console.log('✅ Migration completed successfully!\n');

        // Verify the inspection services
        const inspectionServices = await sql`
            SELECT id, name, price, base_price, duration_minutes 
            FROM services 
            WHERE LOWER(name) LIKE '%inspection%'
            ORDER BY name
        `;

        console.log('Inspection services in database:');
        console.log('================================');
        inspectionServices.forEach(svc => {
            console.log(`- ${svc.name}: ₹${svc.price} (${svc.duration_minutes} mins)`);
        });

        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        await sql.end();
        process.exit(1);
    }
}

runMigration();
