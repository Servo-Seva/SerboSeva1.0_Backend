-- Add new address fields: flat_building, area_locality, alt_phone, address_type
-- Replace single line1 with two separate fields

ALTER TABLE addresses ADD COLUMN IF NOT EXISTS flat_building text;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS area_locality text;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS alt_phone text;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS address_type text DEFAULT 'home';

-- Migrate existing line1 data into flat_building
UPDATE addresses SET flat_building = line1 WHERE flat_building IS NULL AND line1 IS NOT NULL;

-- Make line1 nullable (keep for backward compat)
ALTER TABLE addresses ALTER COLUMN line1 DROP NOT NULL;
