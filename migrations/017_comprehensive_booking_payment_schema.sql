-- =====================================================
-- COMPREHENSIVE BOOKING & PAYMENT SYSTEM SCHEMA
-- Supports: COD, Online Payments, Refunds, Provider Assignment
-- =====================================================

-- Drop existing bookings table if exists (for clean migration)
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;

-- =====================================================
-- BOOKINGS TABLE - Core booking entity
-- =====================================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Batch grouping (for multi-service checkout)
  batch_id UUID,
  order_number VARCHAR(20) UNIQUE NOT NULL, -- Human readable: SS-20260121-XXXX
  
  -- User reference (stores Firebase UID, no FK since user may not exist in local DB yet)
  user_id TEXT NOT NULL,
  
  -- Service details (single service per booking)
  service JSONB NOT NULL, -- {service_id, service_name, quantity, price, category, image_url}
  
  -- Pricing
  subtotal DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  tip_amount DECIMAL(10, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  
  -- Address (snapshot at booking time)
  address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  delivery_address JSONB NOT NULL, -- {full_name, line1, line2, city, state, pincode, phone}
  
  -- Scheduling
  booking_date DATE NOT NULL,
  time_slot VARCHAR(20) NOT NULL, -- "09:00-11:00"
  
  -- Booking Status
  status VARCHAR(30) DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment',    -- Awaiting online payment
    'confirmed',          -- Payment received or COD confirmed
    'assigned',           -- Provider assigned
    'provider_enroute',   -- Provider on the way
    'in_progress',        -- Service started
    'completed',          -- Service completed
    'cancelled',          -- Cancelled by user/admin
    'failed'              -- Payment failed / booking failed
  )),
  
  -- Payment Mode & Status
  payment_mode VARCHAR(20) NOT NULL CHECK (payment_mode IN ('cod', 'online')),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN (
    'pending',            -- Not yet paid
    'awaiting',           -- Waiting for payment gateway callback
    'paid',               -- Payment successful
    'failed',             -- Payment failed
    'refunded',           -- Full refund issued
    'partially_refunded'  -- Partial refund issued
  )),
  
  -- Payment Gateway Details (for online payments)
  pg_order_id VARCHAR(100),        -- Razorpay order_id / Stripe payment_intent_id
  pg_payment_id VARCHAR(100),      -- Razorpay payment_id / Stripe charge_id
  pg_signature VARCHAR(255),       -- Verification signature
  payment_gateway VARCHAR(20),     -- 'razorpay', 'stripe', 'phonepe'
  
  -- Refund tracking
  refund_amount DECIMAL(10, 2) DEFAULT 0,
  refund_id VARCHAR(100),
  refund_status VARCHAR(20) CHECK (refund_status IN ('none', 'initiated', 'processed', 'failed')),
  refunded_at TIMESTAMPTZ,
  
  -- Provider Assignment
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  provider_accepted_at TIMESTAMPTZ,
  provider_arrived_at TIMESTAMPTZ,
  
  -- Promo Code
  promo_code VARCHAR(50),
  promo_id UUID,
  
  -- Completion & Cancellation
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_by VARCHAR(20) CHECK (cancelled_by IN ('user', 'provider', 'admin', 'system')),
  
  -- OTP for service verification
  service_otp VARCHAR(6),
  otp_verified_at TIMESTAMPTZ,
  
  -- Notes
  customer_notes TEXT,
  provider_notes TEXT,
  admin_notes TEXT,
  
  -- Idempotency
  idempotency_key VARCHAR(64) UNIQUE, -- Prevent duplicate bookings
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- For pending_payment bookings (auto-cancel if not paid)
);

-- =====================================================
-- PAYMENT TRANSACTIONS - Audit trail for all payments
-- =====================================================
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- Transaction details
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN (
    'payment',            -- Initial payment
    'refund',             -- Refund transaction
    'partial_refund',     -- Partial refund
    'chargeback'          -- Disputed transaction
  )),
  
  -- Amount
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  
  -- Payment Gateway Details
  payment_gateway VARCHAR(20) NOT NULL,
  pg_order_id VARCHAR(100),
  pg_payment_id VARCHAR(100),
  pg_refund_id VARCHAR(100),
  pg_signature VARCHAR(255),
  
  -- Status
  status VARCHAR(20) NOT NULL CHECK (status IN (
    'initiated',
    'pending',
    'success',
    'failed',
    'cancelled'
  )),
  
  -- Error handling
  error_code VARCHAR(50),
  error_message TEXT,
  
  -- Metadata
  gateway_response JSONB, -- Full response from payment gateway
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- =====================================================
-- PROMO CODES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  
  -- Discount type
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
  discount_value DECIMAL(10, 2) NOT NULL,
  max_discount DECIMAL(10, 2), -- Cap for percentage discounts
  min_order_value DECIMAL(10, 2) DEFAULT 0,
  
  -- Validity
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  
  -- Usage limits
  max_uses INT,
  max_uses_per_user INT DEFAULT 1,
  current_uses INT DEFAULT 0,
  
  -- Targeting
  applicable_categories JSONB, -- null = all categories
  applicable_services JSONB,   -- null = all services
  first_order_only BOOLEAN DEFAULT FALSE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PROMO CODE USAGE TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Firebase UID
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  discount_applied DECIMAL(10, 2) NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(promo_id, user_id, booking_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_batch_id ON bookings(batch_id);
CREATE INDEX idx_bookings_order_number ON bookings(order_number);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_provider_id ON bookings(provider_id);
CREATE INDEX idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);
CREATE INDEX idx_bookings_pg_order_id ON bookings(pg_order_id);
CREATE INDEX idx_bookings_expires_at ON bookings(expires_at) WHERE status = 'pending_payment';
CREATE INDEX idx_bookings_idempotency ON bookings(idempotency_key);

CREATE INDEX idx_payment_transactions_booking_id ON payment_transactions(booking_id);
CREATE INDEX idx_payment_transactions_pg_order_id ON payment_transactions(pg_order_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);

CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_code_usage_user ON promo_code_usage(user_id);

-- =====================================================
-- TRIGGER: Auto-update updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_payment_transactions_updated_at
BEFORE UPDATE ON payment_transactions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTION: Generate order number
-- =====================================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  today_str TEXT;
  seq_num INT;
  order_num TEXT;
BEGIN
  today_str := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Get count of orders today + 1
  SELECT COUNT(*) + 1 INTO seq_num
  FROM bookings
  WHERE DATE(created_at) = CURRENT_DATE;
  
  order_num := 'SS-' || today_str || '-' || LPAD(seq_num::TEXT, 4, '0');
  
  RETURN order_num;
END;
$$ LANGUAGE plpgsql;
