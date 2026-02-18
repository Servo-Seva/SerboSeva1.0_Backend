require('dotenv').config();
const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
    
    try {
        const migrationPath = path.join(__dirname, '..', 'migrations', '034_add_music_band_category.sql');
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('Running 034_add_music_band_category.sql...');
        await sql.unsafe(migrationSql);
        console.log('Migration completed successfully!');
        
        // Verify the category was created
        const categories = await sql`SELECT id, name FROM categories WHERE name = 'Music & Band'`;
        console.log('Music & Band category:', categories);
        
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await sql.end();
    }
}

runMigration();
