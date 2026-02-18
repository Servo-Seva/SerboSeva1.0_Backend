const postgres = require('postgres');
require('dotenv').config();

async function checkServiceImages() {
    // Use DATABASE_URL with ssl require, matching the working script
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

    try {
        console.log("Checking Service Images...");
        const services = await sql`
            SELECT id, name, thumbnail_url
            FROM services 
            WHERE id IN ('2946274f-12c0-4586-afd0-be9dd0167eea', 'db7427c7-b281-499a-829e-1ab55c4652e0')
        `;

        console.log("Services found:", JSON.stringify(services, null, 2));
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await sql.end();
    }
}

checkServiceImages();
