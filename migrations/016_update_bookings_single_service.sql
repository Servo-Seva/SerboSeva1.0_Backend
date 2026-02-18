-- Update bookings table to have single service per booking
-- This allows different slots for each service

-- Add batch_id to group bookings from same checkout
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS batch_id UUID;

-- Rename services to service (single service per booking)
ALTER TABLE bookings RENAME COLUMN services TO service;

-- Add tip amount column
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10, 2) DEFAULT 0;

-- Create index for batch_id
CREATE INDEX IF NOT EXISTS idx_bookings_batch_id ON bookings(batch_id);

-- Add comment for clarity
COMMENT ON COLUMN bookings.service IS 'Single service object: {service_id, service_name, quantity, price, category}';
COMMENT ON COLUMN bookings.batch_id IS 'Groups multiple bookings created from same checkout session';
