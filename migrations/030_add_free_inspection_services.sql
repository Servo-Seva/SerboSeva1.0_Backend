-- Migration: Add free inspection services for AC & Appliances
-- These are diagnostic/inspection only services with no charge

-- First, get the AC & Appliances subcategory IDs
DO $$
DECLARE
    ac_subcategory_id UUID;
    chimney_subcategory_id UUID;
    washing_machine_subcategory_id UUID;
    home_appliances_subcategory_id UUID;
BEGIN
    -- Get AC subcategory (under AC & Appliances category)
    SELECT id INTO ac_subcategory_id FROM subcategories 
    WHERE LOWER(name) LIKE '%ac%' OR LOWER(name) LIKE '%air condition%'
    LIMIT 1;
    
    -- Get Chimney subcategory
    SELECT id INTO chimney_subcategory_id FROM subcategories 
    WHERE LOWER(name) LIKE '%chimney%'
    LIMIT 1;
    
    -- Get Washing Machine subcategory
    SELECT id INTO washing_machine_subcategory_id FROM subcategories 
    WHERE LOWER(name) LIKE '%washing%'
    LIMIT 1;
    
    -- Get Home Appliances subcategory
    SELECT id INTO home_appliances_subcategory_id FROM subcategories 
    WHERE LOWER(name) LIKE '%home appliance%' OR LOWER(name) LIKE '%appliance%'
    LIMIT 1;

    -- Insert AC Inspection service (Free)
    IF ac_subcategory_id IS NOT NULL THEN
        INSERT INTO services (name, description, price, base_price, subcategory_id, duration_minutes, thumbnail_url, is_active)
        VALUES (
            'AC Inspection',
            'Free diagnostic inspection of your AC unit. Our technician will thoroughly check your air conditioner, identify any issues, and provide a detailed report. No repair charges included - this is purely for inspection.',
            0,
            0,
            ac_subcategory_id,
            30,
            'https://images.unsplash.com/photo-1631545806609-2effeb05a7cd?w=600&h=400&fit=crop',
            true
        )
        ON CONFLICT (name) DO UPDATE SET price = 0, base_price = 0, description = EXCLUDED.description;
    END IF;

    -- Insert Chimney Inspection service (Free)
    IF chimney_subcategory_id IS NOT NULL THEN
        INSERT INTO services (name, description, price, base_price, subcategory_id, duration_minutes, thumbnail_url, is_active)
        VALUES (
            'Chimney Inspection',
            'Free diagnostic inspection of your kitchen chimney. Our expert will check suction power, filter condition, motor health, and overall functionality. Get a detailed report with recommendations.',
            0,
            0,
            chimney_subcategory_id,
            30,
            'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=400&fit=crop',
            true
        )
        ON CONFLICT (name) DO UPDATE SET price = 0, base_price = 0, description = EXCLUDED.description;
    END IF;

    -- Insert Washing Machine Inspection service (Free)
    IF washing_machine_subcategory_id IS NOT NULL THEN
        INSERT INTO services (name, description, price, base_price, subcategory_id, duration_minutes, thumbnail_url, is_active)
        VALUES (
            'Washing Machine Inspection',
            'Free diagnostic inspection of your washing machine. Our technician will check drum, motor, drainage, and electronic controls. Receive a comprehensive report with repair estimates if needed.',
            0,
            0,
            washing_machine_subcategory_id,
            30,
            'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=600&h=400&fit=crop',
            true
        )
        ON CONFLICT (name) DO UPDATE SET price = 0, base_price = 0, description = EXCLUDED.description;
    END IF;

    -- Insert Refrigerator Inspection service (Free)
    IF home_appliances_subcategory_id IS NOT NULL THEN
        INSERT INTO services (name, description, price, base_price, subcategory_id, duration_minutes, thumbnail_url, is_active)
        VALUES (
            'Refrigerator Inspection',
            'Free diagnostic inspection of your refrigerator. Our expert will check cooling efficiency, compressor health, thermostat, and door seals. Get a detailed condition report.',
            0,
            0,
            home_appliances_subcategory_id,
            30,
            'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=600&h=400&fit=crop',
            true
        )
        ON CONFLICT (name) DO UPDATE SET price = 0, base_price = 0, description = EXCLUDED.description;

        -- Insert Microwave Inspection service (Free)
        INSERT INTO services (name, description, price, base_price, subcategory_id, duration_minutes, thumbnail_url, is_active)
        VALUES (
            'Microwave Inspection',
            'Free diagnostic inspection of your microwave oven. Our technician will check heating elements, turntable motor, door safety, and electronic panel. Get a comprehensive health report.',
            0,
            0,
            home_appliances_subcategory_id,
            20,
            'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?w=600&h=400&fit=crop',
            true
        )
        ON CONFLICT (name) DO UPDATE SET price = 0, base_price = 0, description = EXCLUDED.description;
    END IF;

    RAISE NOTICE 'Inspection services added/updated successfully';
END $$;

-- Also update any existing inspection-related services to be free
UPDATE services 
SET price = 0, base_price = 0 
WHERE LOWER(name) LIKE '%inspection%' 
   OR LOWER(name) LIKE '%free visit%'
   OR LOWER(name) LIKE '%diagnostic%'
   OR LOWER(name) LIKE '%free check%';
