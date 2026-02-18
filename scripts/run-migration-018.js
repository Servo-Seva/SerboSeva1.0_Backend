const fs = require('fs');
const path = require('path');
require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL);

async function runMigration() {
    try {
        const migrationPath = path.join(__dirname, '..', 'migrations', '018_provider_registration_documents.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

        console.log('Running migration 018_provider_registration_documents.sql...');
        await sql.unsafe(migrationSQL);
        console.log('✅ Migration 018 applied successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
