const postgres = require('postgres');

(async function () {
    try {
        const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
        const rows = await sql`select table_name from information_schema.tables where table_schema='public' and table_name in ('categories','services','category_services','migrations_applied')`;
        console.log('tables:', rows);
        try {
            const applied = await sql`select filename, applied_at from migrations_applied order by id`;
            console.log('migrations_applied:', applied);
        } catch (err) {
            console.log('migrations_applied table missing or query failed:', err.message || err);
        }
        await sql.end();
    } catch (err) {
        console.error('error checking db:', err.message || err);
        process.exit(1);
    }
})();
