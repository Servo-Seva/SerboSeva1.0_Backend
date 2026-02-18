const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function main() {
    // Revert provider back to pending (was accidentally approved for testing)
    await sql`UPDATE providers SET status = 'pending', approved_at = NULL WHERE id = '513d5b73-93af-4b48-9d62-8c2cc538b8cf'`;
    console.log("Provider reverted to pending!");

    const providers = await sql`SELECT id, name, status, kyc_status, provider_type FROM providers WHERE id = '513d5b73-93af-4b48-9d62-8c2cc538b8cf'`;
    console.log("Updated Provider:", JSON.stringify(providers, null, 2));

    await sql.end();
}

main().catch(console.error);
