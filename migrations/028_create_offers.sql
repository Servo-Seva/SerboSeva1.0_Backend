-- Create offers table for promotional banners and discounts
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  bg_color VARCHAR(100) NOT NULL DEFAULT 'bg-gradient-to-br from-slate-100 to-slate-50',
  text_color VARCHAR(50) NOT NULL DEFAULT 'text-gray-900',
  link_to VARCHAR(255) NOT NULL DEFAULT '/services',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for active offers query
CREATE INDEX IF NOT EXISTS idx_offers_active ON offers (is_active, display_order);

-- Seed initial offers
INSERT INTO offers (title, subtitle, image_url, bg_color, text_color, link_to, is_active, display_order) VALUES
(
  'AC & Appliance Repair',
  'Free Inspection Visit',
  'https://images.unsplash.com/photo-1631545806609-2effeb05a7cd?w=600&h=400&fit=crop',
  'bg-gradient-to-br from-slate-100 to-slate-50',
  'text-gray-900',
  '/services/appliances',
  true,
  1
),
(
  'Flat 20% OFF',
  'On All Home Services',
  'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&h=400&fit=crop',
  'bg-gradient-to-br from-green-500 to-green-400',
  'text-white',
  '/services',
  true,
  2
),
(
  'Home & Professional Services',
  'Free Consultation',
  'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=600&h=400&fit=crop',
  'bg-gradient-to-br from-blue-500 to-blue-400',
  'text-white',
  '/professional-services',
  true,
  3
),
(
  'Professional Services',
  'At Affordable Prices',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop',
  'bg-gradient-to-br from-orange-500 to-orange-400',
  'text-white',
  '/professional-services',
  true,
  4
);
