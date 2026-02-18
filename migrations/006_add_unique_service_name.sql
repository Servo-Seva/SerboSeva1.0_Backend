-- Add unique constraint on services.name if it's missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_name_unique'
  ) THEN
    ALTER TABLE services ADD CONSTRAINT services_name_unique UNIQUE (name);
  END IF;
END$$;
