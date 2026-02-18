-- Drop existing promo_codes table if it exists (to ensure correct schema)
DROP TABLE IF EXISTS promo_codes CASCADE;

-- Create promo_codes table
CREATE TABLE promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('flat', 'percentage')),
    discount_value DECIMAL(10, 2) NOT NULL,
    min_order_value DECIMAL(10, 2) DEFAULT 0,
    max_discount DECIMAL(10, 2), -- For percentage discounts, cap the max discount
    usage_limit INTEGER, -- NULL means unlimited
    used_count INTEGER DEFAULT 0,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active);

-- Insert some sample promo codes
INSERT INTO promo_codes (code, description, discount_type, discount_value, min_order_value, max_discount, usage_limit, valid_until)
VALUES 
    ('SAVE10', 'Save ₹10 on your order', 'flat', 10, 100, NULL, NULL, '2026-12-31 23:59:59+00'),
    ('FIRST50', 'First order discount - ₹50 off', 'flat', 50, 200, NULL, 1000, '2026-12-31 23:59:59+00'),
    ('FLAT100', 'Flat ₹100 off on orders above ₹500', 'flat', 100, 500, NULL, NULL, '2026-12-31 23:59:59+00'),
    ('WELCOME20', 'Welcome discount - 20% off', 'percentage', 20, 150, 100, NULL, '2026-12-31 23:59:59+00'),
    ('MEGA25', 'Mega sale - 25% off up to ₹200', 'percentage', 25, 300, 200, 500, '2026-06-30 23:59:59+00')
ON CONFLICT (code) DO NOTHING;
