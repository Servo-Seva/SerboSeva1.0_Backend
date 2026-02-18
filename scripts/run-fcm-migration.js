// Script to run the FCM token migration
const fs = require('fs');
const path = require('path');

async function runFcmMigration() {
    require('dotenv').config();
    const postgres = require('postgres');

    const sql = postgres(process.env.DATABASE_URL, {
        ssl: 'require',
    });

    try {
        console.log('Running FCM token migration...');

        // Add fcm_token column
        await sql`
      ALTER TABLE providers 
      ADD COLUMN IF NOT EXISTS fcm_token TEXT
    `;
        console.log('✅ Added fcm_token column');

        // Add last_notification_at column
        await sql`
      ALTER TABLE providers 
      ADD COLUMN IF NOT EXISTS last_notification_at TIMESTAMPTZ
    `;
        console.log('✅ Added last_notification_at column');

        // Add notifications_enabled column
        await sql`
      ALTER TABLE providers 
      ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE
    `;
        console.log('✅ Added notifications_enabled column');

        // Create index for fcm_token
        await sql`
      CREATE INDEX IF NOT EXISTS idx_providers_fcm_token ON providers(fcm_token) WHERE fcm_token IS NOT NULL
    `;
        console.log('✅ Created fcm_token index');

        // Create notifications table
        await sql`
      CREATE TABLE IF NOT EXISTS provider_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        data JSONB,
        status VARCHAR(20) DEFAULT 'pending',
        sent_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
        console.log('✅ Created provider_notifications table');

        // Create indexes for notifications
        await sql`
      CREATE INDEX IF NOT EXISTS idx_provider_notifications_provider ON provider_notifications(provider_id)
    `;
        await sql`
      CREATE INDEX IF NOT EXISTS idx_provider_notifications_booking ON provider_notifications(booking_id) WHERE booking_id IS NOT NULL
    `;
        await sql`
      CREATE INDEX IF NOT EXISTS idx_provider_notifications_created ON provider_notifications(created_at DESC)
    `;
        console.log('✅ Created notification indexes');

        console.log('\n✅ FCM token migration completed successfully!');

        await sql.end();
    } catch (error) {
        console.error('Migration error:', error);
        await sql.end();
        process.exit(1);
    }
}

runFcmMigration();
