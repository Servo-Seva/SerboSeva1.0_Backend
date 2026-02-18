-- Migration: Add FCM token column to providers table for push notifications
-- This stores the Firebase Cloud Messaging device token for each provider

-- Add fcm_token column to providers table
ALTER TABLE providers 
ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Add last_notification_at column to track when the last notification was sent
ALTER TABLE providers 
ADD COLUMN IF NOT EXISTS last_notification_at TIMESTAMPTZ;

-- Add notifications_enabled column for providers to opt-in/opt-out
ALTER TABLE providers 
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;

-- Create index for quick lookups by fcm_token
CREATE INDEX IF NOT EXISTS idx_providers_fcm_token ON providers(fcm_token) WHERE fcm_token IS NOT NULL;

-- Create notifications table to store notification history
CREATE TABLE IF NOT EXISTS provider_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- 'job_assigned', 'job_cancelled', 'job_updated', etc.
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB, -- Additional data sent with the notification
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fetching provider notifications
CREATE INDEX IF NOT EXISTS idx_provider_notifications_provider ON provider_notifications(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_notifications_booking ON provider_notifications(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_provider_notifications_created ON provider_notifications(created_at DESC);

COMMENT ON COLUMN providers.fcm_token IS 'Firebase Cloud Messaging token for push notifications';
COMMENT ON COLUMN providers.notifications_enabled IS 'Whether the provider has enabled push notifications';
COMMENT ON TABLE provider_notifications IS 'History of all notifications sent to providers';
