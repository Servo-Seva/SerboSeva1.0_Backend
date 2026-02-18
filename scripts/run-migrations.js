const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function run() {
    const sql = process.env.DATABASE_URL;
    if (!sql) {
        console.error('DATABASE_URL is not set');
        process.exit(1);
    }

    const client = postgres(sql, { ssl: 'require' });
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    files.sort();

    for (const file of files) {
        const sqlText = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        console.log('Running', file);
        // Execute raw SQL text (avoid parameterizing the entire script)
        await client.unsafe(sqlText);
    }

    await client.end();
    console.log('Migrations complete');
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
