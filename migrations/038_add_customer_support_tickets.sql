-- Add customer support fields to support_tickets
-- Make provider_id nullable (already nullable in practice) and add user fields

ALTER TABLE support_tickets
  ALTER COLUMN provider_id DROP NOT NULL;

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS user_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS user_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS user_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS ticket_type VARCHAR(20) DEFAULT 'provider' CHECK (ticket_type IN ('provider', 'customer'));

-- Index for customer ticket lookups
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_type ON support_tickets(ticket_type);
