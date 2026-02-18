-- Create featured_deals table for special discounted services displayed on homepage
-- This table stores curated deals with specific discount percentages

CREATE TABLE IF NOT EXISTS featured_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  tag VARCHAR(50) NOT NULL DEFAULT 'Special', -- e.g., "50% OFF", "Trending", "Best Seller"
  tag_color VARCHAR(50) NOT NULL DEFAULT 'bg-blue-500', -- Tailwind color class
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id) -- Each service can only be featured once
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_featured_deals_active ON featured_deals (is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_featured_deals_service_id ON featured_deals (service_id);

-- Seed featured deals with popular services
DO $$
DECLARE
    service_record RECORD;
    deal_count INTEGER := 0;
BEGIN
    -- Add services with 50% discount (highest priority)
    FOR service_record IN 
        SELECT s.id, s.name, s.avg_rating
        FROM services s
        LEFT JOIN subcategories sub ON s.subcategory_id = sub.id
        LEFT JOIN categories c ON sub.category_id = c.id
        WHERE s.is_active = true
          AND s.price > 0
          AND LOWER(s.name) NOT LIKE '%inspection%'
          AND LOWER(s.name) NOT LIKE '%consultation%'
        ORDER BY s.avg_rating DESC NULLS LAST, s.reviews_count DESC NULLS LAST
        LIMIT 2
    LOOP
        INSERT INTO featured_deals (service_id, discount_percent, tag, tag_color, is_active, display_order)
        VALUES (service_record.id, 50, '50% OFF', 'bg-red-500', true, deal_count + 1)
        ON CONFLICT (service_id) DO UPDATE SET 
            discount_percent = 50, 
            tag = '50% OFF', 
            tag_color = 'bg-red-500',
            display_order = deal_count + 1;
        deal_count := deal_count + 1;
    END LOOP;

    -- Add services with 40% discount
    FOR service_record IN 
        SELECT s.id, s.name
        FROM services s
        WHERE s.is_active = true
          AND s.price > 0
          AND LOWER(s.name) NOT LIKE '%inspection%'
          AND LOWER(s.name) NOT LIKE '%consultation%'
          AND s.id NOT IN (SELECT service_id FROM featured_deals)
        ORDER BY s.reviews_count DESC NULLS LAST, s.avg_rating DESC NULLS LAST
        OFFSET 2 LIMIT 2
    LOOP
        INSERT INTO featured_deals (service_id, discount_percent, tag, tag_color, is_active, display_order)
        VALUES (service_record.id, 40, '40% OFF', 'bg-orange-500', true, deal_count + 1)
        ON CONFLICT (service_id) DO UPDATE SET 
            discount_percent = 40, 
            tag = '40% OFF', 
            tag_color = 'bg-orange-500',
            display_order = deal_count + 1;
        deal_count := deal_count + 1;
    END LOOP;

    -- Add trending services with 30% discount
    FOR service_record IN 
        SELECT s.id, s.name
        FROM services s
        WHERE s.is_active = true
          AND s.price > 0
          AND LOWER(s.name) NOT LIKE '%inspection%'
          AND LOWER(s.name) NOT LIKE '%consultation%'
          AND s.id NOT IN (SELECT service_id FROM featured_deals)
        ORDER BY s.created_at DESC, s.avg_rating DESC NULLS LAST
        LIMIT 2
    LOOP
        INSERT INTO featured_deals (service_id, discount_percent, tag, tag_color, is_active, display_order)
        VALUES (service_record.id, 30, 'Trending', 'bg-pink-500', true, deal_count + 1)
        ON CONFLICT (service_id) DO UPDATE SET 
            discount_percent = 30, 
            tag = 'Trending', 
            tag_color = 'bg-pink-500',
            display_order = deal_count + 1;
        deal_count := deal_count + 1;
    END LOOP;

    -- Add best seller with 25% discount
    FOR service_record IN 
        SELECT s.id, s.name
        FROM services s
        WHERE s.is_active = true
          AND s.price > 0
          AND LOWER(s.name) NOT LIKE '%inspection%'
          AND LOWER(s.name) NOT LIKE '%consultation%'
          AND s.id NOT IN (SELECT service_id FROM featured_deals)
        ORDER BY s.reviews_count DESC NULLS LAST
        LIMIT 1
    LOOP
        INSERT INTO featured_deals (service_id, discount_percent, tag, tag_color, is_active, display_order)
        VALUES (service_record.id, 25, 'Best Seller', 'bg-green-500', true, deal_count + 1)
        ON CONFLICT (service_id) DO UPDATE SET 
            discount_percent = 25, 
            tag = 'Best Seller', 
            tag_color = 'bg-green-500',
            display_order = deal_count + 1;
        deal_count := deal_count + 1;
    END LOOP;

    RAISE NOTICE 'Created % featured deals', deal_count;
END $$;
