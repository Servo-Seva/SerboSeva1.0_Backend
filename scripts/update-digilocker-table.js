require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL);

async function addColumn() {
    try {
        await sql.unsafe(`
      ALTER TABLE digilocker_verifications ADD COLUMN IF NOT EXISTS aadhaar_number TEXT;
      ALTER TABLE digilocker_verifications DROP CONSTRAINT IF EXISTS digilocker_verifications_status_check;
      ALTER TABLE digilocker_verifications ADD CONSTRAINT digilocker_verifications_status_check 
        CHECK (status IN ('initiated', 'pending', 'success', 'failed', 'expired', 'otp_sent', 'otp_resent', 'verified'));
    `);
        console.log('✅ Column and constraints updated successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

addColumn();
