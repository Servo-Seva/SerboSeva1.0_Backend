-- =====================================================
-- SLOT CONFIGURATION TABLE
-- Allows admin to manage time slots for services
-- =====================================================

-- Create slot_configs table
CREATE TABLE IF NOT EXISTS slot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Service reference (NULL = global default for all services)
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  
  -- Day of week (0=Sunday, 1=Monday, ..., 6=Saturday, NULL = all days)
  day_of_week INTEGER CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  
  -- Time range
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  
  -- Slot configuration
  slot_duration_minutes INTEGER NOT NULL DEFAULT 60,
  gap_between_slots_minutes INTEGER DEFAULT 0,
  max_bookings_per_slot INTEGER NOT NULL DEFAULT 5,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure no duplicate configs for same service/day combination
  UNIQUE(service_id, day_of_week)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_slot_configs_service_id ON slot_configs(service_id);
CREATE INDEX IF NOT EXISTS idx_slot_configs_active ON slot_configs(is_active) WHERE is_active = true;

-- Insert default global slot configuration
INSERT INTO slot_configs (service_id, day_of_week, start_time, end_time, slot_duration_minutes, max_bookings_per_slot, is_active)
VALUES 
  (NULL, NULL, '09:00', '18:00', 60, 5, true)
ON CONFLICT DO NOTHING;

-- Create holiday/blackout dates table
CREATE TABLE IF NOT EXISTS slot_blackout_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Date range for blackout
  blackout_date DATE NOT NULL,
  
  -- Optional: specific service (NULL = all services)
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  
  -- Reason for blackout
  reason VARCHAR(255),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT, -- Admin user ID
  
  -- Prevent duplicate blackouts for same date/service
  UNIQUE(blackout_date, service_id)
);

CREATE INDEX IF NOT EXISTS idx_blackout_dates ON slot_blackout_dates(blackout_date);

-- Add comment
COMMENT ON TABLE slot_configs IS 'Configurable time slots for booking services';
COMMENT ON TABLE slot_blackout_dates IS 'Dates when bookings are not available (holidays, etc.)';
