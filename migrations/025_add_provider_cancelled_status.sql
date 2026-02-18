-- Migration: Add provider_cancelled status to bookings
-- This status is used when a provider declines/cancels a booking
-- The booking remains active for admin to reassign to another provider

-- Drop the existing check constraint
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Add the new check constraint with provider_cancelled status
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
  CHECK (status IN ('pending', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled', 'provider_cancelled'));

-- Add index for provider_cancelled status queries (for admin dashboard)
CREATE INDEX IF NOT EXISTS idx_bookings_provider_cancelled ON bookings(status) WHERE status = 'provider_cancelled';
