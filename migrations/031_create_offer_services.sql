-- Create offer_services junction table to link specific services to offers
-- This allows fine-grained control over which services appear in each offer

CREATE TABLE IF NOT EXISTS offer_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  discount_percent INTEGER DEFAULT 0, -- Offer-specific discount for this service
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(offer_id, service_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_offer_services_offer_id ON offer_services(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_services_service_id ON offer_services(service_id);

-- Now link the inspection services to the "AC & Appliance Repair - Free Inspection Visit" offer
DO $$
DECLARE
    ac_offer_id UUID;
    flat_20_offer_id UUID;
    service_record RECORD;
BEGIN
    -- Get the AC & Appliance offer ID
    SELECT id INTO ac_offer_id FROM offers WHERE title ILIKE '%appliance%' LIMIT 1;
    
    -- Get the Flat 20% OFF offer ID  
    SELECT id INTO flat_20_offer_id FROM offers WHERE title ILIKE '%20%off%' LIMIT 1;
    
    -- Link inspection services to AC & Appliance offer
    IF ac_offer_id IS NOT NULL THEN
        FOR service_record IN 
            SELECT id FROM services 
            WHERE LOWER(name) LIKE '%inspection%' AND is_active = true
        LOOP
            INSERT INTO offer_services (offer_id, service_id, discount_percent)
            VALUES (ac_offer_id, service_record.id, 100) -- 100% off = free
            ON CONFLICT (offer_id, service_id) DO UPDATE SET discount_percent = 100;
        END LOOP;
        
        RAISE NOTICE 'Linked inspection services to AC & Appliance offer';
    END IF;
    
    -- Link some popular services with 20% discount to the Flat 20% OFF offer
    IF flat_20_offer_id IS NOT NULL THEN
        -- Add various services from different categories with 20% discount
        FOR service_record IN 
            SELECT s.id, s.avg_rating, s.reviews_count
            FROM services s
            LEFT JOIN subcategories sub ON s.subcategory_id = sub.id
            LEFT JOIN categories c ON sub.category_id = c.id
            WHERE s.is_active = true
              AND LOWER(s.name) NOT LIKE '%inspection%' -- Exclude inspection services
              AND s.price > 0
            ORDER BY s.avg_rating DESC NULLS LAST, s.reviews_count DESC NULLS LAST
            LIMIT 15
        LOOP
            INSERT INTO offer_services (offer_id, service_id, discount_percent)
            VALUES (flat_20_offer_id, service_record.id, 20)
            ON CONFLICT (offer_id, service_id) DO UPDATE SET discount_percent = 20;
        END LOOP;
        
        RAISE NOTICE 'Linked popular services with 20%% discount to Flat 20%% OFF offer';
    END IF;
END $$;

-- Verify the links
SELECT 
    o.title as offer_title,
    s.name as service_name,
    os.discount_percent
FROM offer_services os
JOIN offers o ON os.offer_id = o.id
JOIN services s ON os.service_id = s.id
ORDER BY o.title, s.name;
