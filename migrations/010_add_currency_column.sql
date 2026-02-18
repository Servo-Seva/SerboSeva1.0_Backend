-- Migration: Add any missing columns to services table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'currency') THEN
        ALTER TABLE services ADD COLUMN currency TEXT DEFAULT 'INR';
    END IF;
END $$;
