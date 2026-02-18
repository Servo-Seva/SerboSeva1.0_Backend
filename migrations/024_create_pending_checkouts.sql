-- Migration: Create pending_checkouts table
-- Purpose: Store checkout data temporarily for online payments until payment is verified
-- Bookings are only created after successful payment verification

CREATE TABLE IF NOT EXISTS pending_checkouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    pg_order_id TEXT UNIQUE NOT NULL,
    checkout_data JSONB NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    promo_id UUID REFERENCES promo_codes(id),
    promo_code TEXT,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    tip_amount DECIMAL(10, 2) DEFAULT 0,
    idempotency_key TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_checkouts_order_id ON pending_checkouts(pg_order_id);
CREATE INDEX IF NOT EXISTS idx_pending_checkouts_user_id ON pending_checkouts(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_checkouts_expires_at ON pending_checkouts(expires_at);

-- Auto-cleanup expired pending checkouts (can be run periodically)
-- DELETE FROM pending_checkouts WHERE expires_at < NOW();
