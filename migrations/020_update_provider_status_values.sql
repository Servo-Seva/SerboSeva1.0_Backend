-- Migration: Update provider status values to support both old and new statuses
-- Unifies status values for provider registration flow

-- Drop old constraint and add new one with all status values
ALTER TABLE providers DROP CONSTRAINT IF EXISTS providers_status_check;
ALTER TABLE providers ADD CONSTRAINT providers_status_check 
    CHECK (status IN ('pending', 'active', 'approved', 'rejected', 'suspended', 'blocked'));

-- Optionally update 'active' to 'approved' for consistency (uncomment if needed)
-- UPDATE providers SET status = 'approved' WHERE status = 'active';
