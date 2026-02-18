-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Firebase UID (no FK since user may not exist in local DB yet)
  
  -- Service details
  services JSONB NOT NULL, -- Array of {service_id, service_name, quantity, price}
  total_amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  
  -- Address details
  address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  delivery_address JSONB NOT NULL, -- Stored address snapshot {line1, line2, city, state, pincode, country}
  
  -- Scheduling
  booking_date DATE NOT NULL,
  time_slot TEXT NOT NULL, -- e.g., "09:00-11:00"
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled')),
  
  -- Provider assignment
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP,
  
  -- Payment
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_method TEXT, -- 'razorpay', 'cod', etc.
  payment_id TEXT, -- External payment gateway ID
  
  -- Promo code
  promo_code TEXT,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  
  -- Notes
  customer_notes TEXT,
  cancellation_reason TEXT
);

-- Create indexes for better query performance
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_provider_id ON bookings(provider_id);
CREATE INDEX idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_bookings_updated_at();
