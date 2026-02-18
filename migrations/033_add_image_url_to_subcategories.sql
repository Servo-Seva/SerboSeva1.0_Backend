-- Add image_url column to subcategories table
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN subcategories.image_url IS 'URL to the subcategory image for display on home page';
