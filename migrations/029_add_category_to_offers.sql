-- Add category_id to offers table to link offers with service categories
-- This allows fetching related services for each offer

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'offers' AND column_name = 'category_id'
    ) THEN
        ALTER TABLE offers ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for faster category lookups
CREATE INDEX IF NOT EXISTS idx_offers_category_id ON offers(category_id);

-- Update existing offers with appropriate category IDs based on their link_to paths
-- First, let's update AC & Appliance offer to link to Appliance Repair category if it exists
UPDATE offers 
SET category_id = (SELECT id FROM categories WHERE name ILIKE '%appliance%' LIMIT 1)
WHERE title ILIKE '%appliance%' AND category_id IS NULL;

-- Update home services offer to link to Cleaning category if it exists
UPDATE offers 
SET category_id = (SELECT id FROM categories WHERE name ILIKE '%cleaning%' LIMIT 1)
WHERE title ILIKE '%home%' AND category_id IS NULL;
