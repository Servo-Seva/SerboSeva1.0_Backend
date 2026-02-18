require("dotenv").config();
const postgres = require("postgres");

const sql = postgres(process.env.DATABASE_URL, {
    ssl: "require",
});

async function reset() {
    try {
        // Delete the migration record so it runs again
        await sql`DELETE FROM migrations_applied WHERE filename = '022_create_promo_codes.sql'`;
        console.log("✅ Migration record deleted. Restart the server to apply the migration.");
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await sql.end();
    }
}

reset();
