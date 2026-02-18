-- Migration: Seed sample data for subcategories, providers, and provider_services
-- This migration adds sample data for testing

-- Ensure required columns exist on services table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'avg_rating') THEN
        ALTER TABLE services ADD COLUMN avg_rating NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'reviews_count') THEN
        ALTER TABLE services ADD COLUMN reviews_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'duration_minutes') THEN
        ALTER TABLE services ADD COLUMN duration_minutes INTEGER DEFAULT 60;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'thumbnail_url') THEN
        ALTER TABLE services ADD COLUMN thumbnail_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'currency') THEN
        ALTER TABLE services ADD COLUMN currency TEXT DEFAULT 'INR';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'subcategory_id') THEN
        ALTER TABLE services ADD COLUMN subcategory_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'base_price') THEN
        ALTER TABLE services ADD COLUMN base_price NUMERIC;
    END IF;
END $$;

-- First, let's get the category IDs and store them in variables
-- We'll use DO blocks for this

DO $$
DECLARE
    -- Category IDs
    cat_ac_appliances UUID;
    cat_electrician UUID;
    cat_plumber UUID;
    cat_carpenter UUID;
    cat_painting UUID;
    cat_beauty_spa UUID;
    cat_furniture UUID;
    cat_home_repair UUID;
    
    -- Subcategory IDs
    sub_home_appliances UUID;
    sub_kitchen_appliances UUID;
    sub_switch_socket UUID;
    sub_fan_light UUID;
    sub_tap_mixer UUID;
    sub_toilet_bath UUID;
    sub_cupboard UUID;
    sub_furniture_repair UUID;
    sub_full_home UUID;
    sub_few_walls UUID;
    sub_salon_women UUID;
    sub_salon_men UUID;
    sub_sofa_cleaning UUID;
    sub_repair_services UUID;
    sub_door_window UUID;
    sub_installation UUID;
    
    -- Service IDs for provider assignment
    svc_ac_install UUID;
    svc_ac_repair UUID;
    svc_washing_repair UUID;
    svc_switch_repair UUID;
    svc_fan_install UUID;
    svc_tap_repair UUID;
    svc_toilet_repair UUID;
    svc_cupboard_repair UUID;
    svc_door_repair UUID;
    svc_full_home_paint UUID;
    svc_room_paint UUID;
    svc_haircut_women UUID;
    svc_facial UUID;
    svc_sofa_clean UUID;
    svc_door_fix UUID;
    
    -- Provider IDs
    prov_rahul UUID;
    prov_amit UUID;
    prov_suresh UUID;
    prov_priya UUID;
    prov_deepak UUID;
    prov_vikram UUID;
    prov_meena UUID;
    prov_raj UUID;

BEGIN
    -- =============================================
    -- GET EXISTING CATEGORY IDs
    -- =============================================
    SELECT id INTO cat_ac_appliances FROM categories WHERE LOWER(name) LIKE '%ac%' OR LOWER(name) LIKE '%appliance%' LIMIT 1;
    SELECT id INTO cat_electrician FROM categories WHERE LOWER(name) LIKE '%electric%' LIMIT 1;
    SELECT id INTO cat_plumber FROM categories WHERE LOWER(name) LIKE '%plumb%' LIMIT 1;
    SELECT id INTO cat_carpenter FROM categories WHERE LOWER(name) LIKE '%carpenter%' LIMIT 1;
    SELECT id INTO cat_painting FROM categories WHERE LOWER(name) LIKE '%paint%' LIMIT 1;
    SELECT id INTO cat_beauty_spa FROM categories WHERE LOWER(name) LIKE '%beauty%' OR LOWER(name) LIKE '%spa%' LIMIT 1;
    SELECT id INTO cat_furniture FROM categories WHERE LOWER(name) LIKE '%furniture%' LIMIT 1;
    SELECT id INTO cat_home_repair FROM categories WHERE LOWER(name) LIKE '%home%repair%' OR LOWER(name) LIKE '%repair%' LIMIT 1;

    -- =============================================
    -- INSERT SUBCATEGORIES
    -- =============================================
    
    -- AC & Appliances subcategories
    IF cat_ac_appliances IS NOT NULL THEN
        INSERT INTO subcategories (id, category_id, name, icon) VALUES 
            (gen_random_uuid(), cat_ac_appliances, 'Home Appliances', '🏠'),
            (gen_random_uuid(), cat_ac_appliances, 'Kitchen Appliances', '🍳')
        ON CONFLICT (category_id, name) DO NOTHING;
        
        SELECT id INTO sub_home_appliances FROM subcategories WHERE category_id = cat_ac_appliances AND name = 'Home Appliances';
        SELECT id INTO sub_kitchen_appliances FROM subcategories WHERE category_id = cat_ac_appliances AND name = 'Kitchen Appliances';
    END IF;
    
    -- Electrician subcategories
    IF cat_electrician IS NOT NULL THEN
        INSERT INTO subcategories (id, category_id, name, icon) VALUES 
            (gen_random_uuid(), cat_electrician, 'Switch & Socket', '🔌'),
            (gen_random_uuid(), cat_electrician, 'Fan & Light', '💡')
        ON CONFLICT (category_id, name) DO NOTHING;
        
        SELECT id INTO sub_switch_socket FROM subcategories WHERE category_id = cat_electrician AND name = 'Switch & Socket';
        SELECT id INTO sub_fan_light FROM subcategories WHERE category_id = cat_electrician AND name = 'Fan & Light';
    END IF;
    
    -- Plumber subcategories
    IF cat_plumber IS NOT NULL THEN
        INSERT INTO subcategories (id, category_id, name, icon) VALUES 
            (gen_random_uuid(), cat_plumber, 'Tap & Mixer', '🚰'),
            (gen_random_uuid(), cat_plumber, 'Toilet & Bath', '🚿')
        ON CONFLICT (category_id, name) DO NOTHING;
        
        SELECT id INTO sub_tap_mixer FROM subcategories WHERE category_id = cat_plumber AND name = 'Tap & Mixer';
        SELECT id INTO sub_toilet_bath FROM subcategories WHERE category_id = cat_plumber AND name = 'Toilet & Bath';
    END IF;
    
    -- Carpenter subcategories
    IF cat_carpenter IS NOT NULL THEN
        INSERT INTO subcategories (id, category_id, name, icon) VALUES 
            (gen_random_uuid(), cat_carpenter, 'Cupboard & Drawer', '🗄️'),
            (gen_random_uuid(), cat_carpenter, 'Furniture Repair', '🪑')
        ON CONFLICT (category_id, name) DO NOTHING;
        
        SELECT id INTO sub_cupboard FROM subcategories WHERE category_id = cat_carpenter AND name = 'Cupboard & Drawer';
        SELECT id INTO sub_furniture_repair FROM subcategories WHERE category_id = cat_carpenter AND name = 'Furniture Repair';
    END IF;
    
    -- Painting subcategories
    IF cat_painting IS NOT NULL THEN
        INSERT INTO subcategories (id, category_id, name, icon) VALUES 
            (gen_random_uuid(), cat_painting, 'Full Home Painting', '🏠'),
            (gen_random_uuid(), cat_painting, 'Few Walls & Rooms', '🎨')
        ON CONFLICT (category_id, name) DO NOTHING;
        
        SELECT id INTO sub_full_home FROM subcategories WHERE category_id = cat_painting AND name = 'Full Home Painting';
        SELECT id INTO sub_few_walls FROM subcategories WHERE category_id = cat_painting AND name = 'Few Walls & Rooms';
    END IF;
    
    -- Beauty & Spa subcategories
    IF cat_beauty_spa IS NOT NULL THEN
        INSERT INTO subcategories (id, category_id, name, icon) VALUES 
            (gen_random_uuid(), cat_beauty_spa, 'Salon for Women', '💇‍♀️'),
            (gen_random_uuid(), cat_beauty_spa, 'Salon for Men', '💇‍♂️')
        ON CONFLICT (category_id, name) DO NOTHING;
        
        SELECT id INTO sub_salon_women FROM subcategories WHERE category_id = cat_beauty_spa AND name = 'Salon for Women';
        SELECT id INTO sub_salon_men FROM subcategories WHERE category_id = cat_beauty_spa AND name = 'Salon for Men';
    END IF;
    
    -- Furniture & Upholstery subcategories
    IF cat_furniture IS NOT NULL THEN
        INSERT INTO subcategories (id, category_id, name, icon) VALUES 
            (gen_random_uuid(), cat_furniture, 'Sofa & Carpet Cleaning', '🛋️'),
            (gen_random_uuid(), cat_furniture, 'Repair Services', '🔧')
        ON CONFLICT (category_id, name) DO NOTHING;
        
        SELECT id INTO sub_sofa_cleaning FROM subcategories WHERE category_id = cat_furniture AND name = 'Sofa & Carpet Cleaning';
        SELECT id INTO sub_repair_services FROM subcategories WHERE category_id = cat_furniture AND name = 'Repair Services';
    END IF;
    
    -- Home Repair subcategories
    IF cat_home_repair IS NOT NULL THEN
        INSERT INTO subcategories (id, category_id, name, icon) VALUES 
            (gen_random_uuid(), cat_home_repair, 'Door & Window', '🚪'),
            (gen_random_uuid(), cat_home_repair, 'Installation', '🔩')
        ON CONFLICT (category_id, name) DO NOTHING;
        
        SELECT id INTO sub_door_window FROM subcategories WHERE category_id = cat_home_repair AND name = 'Door & Window';
        SELECT id INTO sub_installation FROM subcategories WHERE category_id = cat_home_repair AND name = 'Installation';
    END IF;

    -- =============================================
    -- INSERT SERVICES UNDER SUBCATEGORIES
    -- =============================================
    
    -- Home Appliances services
    IF sub_home_appliances IS NOT NULL THEN
        INSERT INTO services (id, subcategory_id, name, description, base_price, price, is_active, duration_minutes, avg_rating, reviews_count) VALUES 
            (gen_random_uuid(), sub_home_appliances, 'AC Installation', 'Professional split/window AC installation with warranty', 799, 799, true, 90, 4.8, 245),
            (gen_random_uuid(), sub_home_appliances, 'AC Repair & Service', 'Complete AC servicing including gas refill and cleaning', 499, 499, true, 60, 4.7, 312),
            (gen_random_uuid(), sub_home_appliances, 'Washing Machine Repair', 'All brands washing machine repair service', 349, 349, true, 45, 4.6, 189)
        ON CONFLICT DO NOTHING;
        
        SELECT id INTO svc_ac_install FROM services WHERE subcategory_id = sub_home_appliances AND name = 'AC Installation';
        SELECT id INTO svc_ac_repair FROM services WHERE subcategory_id = sub_home_appliances AND name = 'AC Repair & Service';
        SELECT id INTO svc_washing_repair FROM services WHERE subcategory_id = sub_home_appliances AND name = 'Washing Machine Repair';
    END IF;
    
    -- Kitchen Appliances services
    IF sub_kitchen_appliances IS NOT NULL THEN
        INSERT INTO services (id, subcategory_id, name, description, base_price, price, is_active, duration_minutes, avg_rating, reviews_count) VALUES 
            (gen_random_uuid(), sub_kitchen_appliances, 'Refrigerator Repair', 'All brands fridge repair and gas refill', 449, 449, true, 60, 4.5, 156),
            (gen_random_uuid(), sub_kitchen_appliances, 'Microwave Repair', 'Microwave oven repair service', 299, 299, true, 30, 4.4, 98),
            (gen_random_uuid(), sub_kitchen_appliances, 'Chimney Cleaning', 'Deep cleaning and servicing of kitchen chimney', 599, 599, true, 45, 4.7, 134)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Switch & Socket services
    IF sub_switch_socket IS NOT NULL THEN
        INSERT INTO services (id, subcategory_id, name, description, base_price, price, is_active, duration_minutes, avg_rating, reviews_count) VALUES 
            (gen_random_uuid(), sub_switch_socket, 'Switch/Socket Replacement', 'Replace faulty switches and sockets', 149, 149, true, 30, 4.6, 267),
            (gen_random_uuid(), sub_switch_socket, 'Switchboard Installation', 'New switchboard installation', 299, 299, true, 45, 4.5, 145),
            (gen_random_uuid(), sub_switch_socket, 'MCB/Fuse Replacement', 'MCB box repair and fuse replacement', 199, 199, true, 30, 4.7, 198)
        ON CONFLICT DO NOTHING;
        
        SELECT id INTO svc_switch_repair FROM services WHERE subcategory_id = sub_switch_socket AND name = 'Switch/Socket Replacement';
    END IF;
    
    -- Fan & Light services
    IF sub_fan_light IS NOT NULL THEN
        INSERT INTO services (id, subcategory_id, name, description, base_price, price, is_active, duration_minutes, avg_rating, reviews_count) VALUES 
            (gen_random_uuid(), sub_fan_light, 'Ceiling Fan Installation', 'New ceiling fan installation with wiring', 249, 249, true, 45, 4.8, 312),
            (gen_random_uuid(), sub_fan_light, 'Fan Repair', 'All types of fan repair service', 149, 149, true, 30, 4.5, 223),
            (gen_random_uuid(), sub_fan_light, 'Light Fixture Installation', 'LED lights, chandeliers installation', 199, 199, true, 30, 4.6, 187)
        ON CONFLICT DO NOTHING;
        
        SELECT id INTO svc_fan_install FROM services WHERE subcategory_id = sub_fan_light AND name = 'Ceiling Fan Installation';
    END IF;
    
    -- Tap & Mixer services
    IF sub_tap_mixer IS NOT NULL THEN
        INSERT INTO services (id, subcategory_id, name, description, base_price, price, is_active, duration_minutes, avg_rating, reviews_count) VALUES 
            (gen_random_uuid(), sub_tap_mixer, 'Tap Repair/Replacement', 'Fix leaky taps or install new ones', 149, 149, true, 30, 4.7, 289),
            (gen_random_uuid(), sub_tap_mixer, 'Mixer Installation', 'Bathroom/kitchen mixer installation', 249, 249, true, 45, 4.6, 167),
            (gen_random_uuid(), sub_tap_mixer, 'Water Filter Installation', 'RO/UV water purifier installation', 399, 399, true, 60, 4.8, 145)
        ON CONFLICT DO NOTHING;
        
        SELECT id INTO svc_tap_repair FROM services WHERE subcategory_id = sub_tap_mixer AND name = 'Tap Repair/Replacement';
    END IF;
    
    -- Toilet & Bath services
    IF sub_toilet_bath IS NOT NULL THEN
        INSERT INTO services (id, subcategory_id, name, description, base_price, price, is_active, duration_minutes, avg_rating, reviews_count) VALUES 
            (gen_random_uuid(), sub_toilet_bath, 'Toilet Repair', 'Flush tank, seat, pipe repairs', 199, 199, true, 45, 4.5, 234),
            (gen_random_uuid(), sub_toilet_bath, 'Toilet Installation', 'New western/Indian toilet installation', 599, 599, true, 90, 4.7, 123),
            (gen_random_uuid(), sub_toilet_bath, 'Drainage Cleaning', 'Blocked drain cleaning service', 349, 349, true, 60, 4.4, 178)
        ON CONFLICT DO NOTHING;
        
        SELECT id INTO svc_toilet_repair FROM services WHERE subcategory_id = sub_toilet_bath AND name = 'Toilet Repair';
    END IF;
    
    -- Cupboard & Drawer services
    IF sub_cupboard IS NOT NULL THEN
        INSERT INTO services (id, subcategory_id, name, description, base_price, price, is_active, duration_minutes, avg_rating, reviews_count) VALUES 
            (gen_random_uuid(), sub_cupboard, 'Cupboard Repair', 'Hinges, handles, shelf repair', 249, 249, true, 45, 4.6, 156),
            (gen_random_uuid(), sub_cupboard, 'Drawer Repair', 'Drawer channel and lock repair', 199, 199, true, 30, 4.5, 134),
            (gen_random_uuid(), sub_cupboard, 'Wardrobe Installation', 'New wardrobe assembly and installation', 499, 499, true, 120, 4.7, 98)
        ON CONFLICT DO NOTHING;
        
        SELECT id INTO svc_cupboard_repair FROM services WHERE subcategory_id = sub_cupboard AND name = 'Cupboard Repair';
    END IF;
    
    -- Furniture Repair services
    IF sub_furniture_repair IS NOT NULL THEN
        INSERT INTO services (id, subcategory_id, name, description, base_price, price, is_active, duration_minutes, avg_rating, reviews_count) VALUES 
            (gen_random_uuid(), sub_furniture_repair, 'Chair Repair', 'Office/dining chair repair', 199, 199, true, 30, 4.5, 145),
            (gen_random_uuid(), sub_furniture_repair, 'Table Repair', 'Dining/study table repair', 299, 299, true, 45, 4.6, 112),
            (gen_random_uuid(), sub_furniture_repair, 'Bed Repair', 'Bed frame and support repair', 349, 349, true, 60, 4.4, 89)
        ON CONFLICT DO NOTHING;
        
        SELECT id INTO svc_door_repair FROM services WHERE subcategory_id = sub_furniture_repair AND name = 'Chair Repair';
    END IF;
    
    -- Full Home Painting services
    IF sub_full_home IS NOT NULL THEN
        INSERT INTO services (id, subcategory_id, name, description, base_price, price, is_active, duration_minutes, avg_rating, reviews_count) VALUES 
            (gen_random_uuid(), sub_full_home, '1 BHK Painting', 'Complete 1 BHK home painting', 8999, 8999, true, 480, 4.8, 234),
            (gen_random_uuid(), sub_full_home, '2 BHK Painting', 'Complete 2 BHK home painting', 14999, 14999, true, 720, 4.7, 189),
            (gen_random_uuid(), sub_full_home, '3 BHK Painting', 'Complete 3 BHK home painting', 22999, 22999, true, 960, 4.9, 145)
        ON CONFLICT DO NOTHING;
        
        SELECT id INTO svc_full_home_paint FROM services WHERE subcategory_id = sub_full_home AND name = '1 BHK Painting';
    END IF;
    
    -- Few Walls & Rooms services
    IF sub_few_walls IS NOT NULL THEN
        INSERT INTO services (id, subcategory_id, name, description, base_price, price, is_active, duration_minutes, avg_rating, reviews_count) VALUES 
            (gen_random_uuid(), sub_few_walls, 'Single Room Painting', 'Paint one room completely', 2999, 2999, true, 180, 4.6, 267),
            (gen_random_uuid(), sub_few_walls, 'Single Wall Painting', 'Paint one wall (accent wall)', 999, 999, true, 90, 4.5, 198),
            (gen_random_uuid(), sub_few_walls, 'Texture Painting', 'Decorative texture wall painting', 1499, 1499, true, 120, 4.7, 156)
        ON CONFLICT DO NOTHING;
        
        SELECT id INTO svc_room_paint FROM services WHERE subcategory_id = sub_few_walls AND name = 'Single Room Painting';
    END IF;
    
    -- Salon for Women services
    IF sub_salon_women IS NOT NULL THEN
        INSERT INTO services (id, subcategory_id, name, description, base_price, price, is_active, duration_minutes, avg_rating, reviews_count) VALUES 
            (gen_random_uuid(), sub_salon_women, 'Haircut & Styling', 'Professional haircut with styling', 399, 399, true, 45, 4.8, 456),
            (gen_random_uuid(), sub_salon_women, 'Facial', 'Deep cleansing facial treatment', 599, 599, true, 60, 4.7, 378),
            (gen_random_uuid(), sub_salon_women, 'Manicure & Pedicure', 'Complete hand and foot care', 699, 699, true, 75, 4.6, 289)
        ON CONFLICT DO NOTHING;
        
        SELECT id INTO svc_haircut_women FROM services WHERE subcategory_id = sub_salon_women AND name = 'Haircut & Styling';
        SELECT id INTO svc_facial FROM services WHERE subcategory_id = sub_salon_women AND name = 'Facial';
    END IF;
    
    -- Salon for Men services
    IF sub_salon_men IS NOT NULL THEN
        INSERT INTO services (id, subcategory_id, name, description, base_price, price, is_active, duration_minutes, avg_rating, reviews_count) VALUES 
            (gen_random_uuid(), sub_salon_men, 'Haircut', 'Professional men haircut', 199, 199, true, 30, 4.7, 534),
            (gen_random_uuid(), sub_salon_men, 'Beard Grooming', 'Beard trim and styling', 149, 149, true, 20, 4.6, 423),
            (gen_random_uuid(), sub_salon_men, 'Head Massage', 'Relaxing head massage', 249, 249, true, 30, 4.8, 312)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Sofa & Carpet Cleaning services
    IF sub_sofa_cleaning IS NOT NULL THEN
        INSERT INTO services (id, subcategory_id, name, description, base_price, price, is_active, duration_minutes, avg_rating, reviews_count) VALUES 
            (gen_random_uuid(), sub_sofa_cleaning, 'Sofa Cleaning', 'Deep cleaning for sofas (per seat)', 349, 349, true, 45, 4.7, 267),
            (gen_random_uuid(), sub_sofa_cleaning, 'Carpet Cleaning', 'Professional carpet shampooing', 499, 499, true, 60, 4.6, 198),
            (gen_random_uuid(), sub_sofa_cleaning, 'Mattress Cleaning', 'Deep mattress cleaning and sanitization', 599, 599, true, 45, 4.8, 156)
        ON CONFLICT DO NOTHING;
        
        SELECT id INTO svc_sofa_clean FROM services WHERE subcategory_id = sub_sofa_cleaning AND name = 'Sofa Cleaning';
    END IF;
    
    -- Repair Services (Furniture) services
    IF sub_repair_services IS NOT NULL THEN
        INSERT INTO services (id, subcategory_id, name, description, base_price, price, is_active, duration_minutes, avg_rating, reviews_count) VALUES 
            (gen_random_uuid(), sub_repair_services, 'Sofa Repair', 'Foam, fabric, frame repair', 499, 499, true, 60, 4.5, 145),
            (gen_random_uuid(), sub_repair_services, 'Recliner Repair', 'Recliner mechanism repair', 699, 699, true, 90, 4.4, 89),
            (gen_random_uuid(), sub_repair_services, 'Upholstery Work', 'Re-upholstery and fabric change', 999, 999, true, 120, 4.6, 67)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Door & Window services
    IF sub_door_window IS NOT NULL THEN
        INSERT INTO services (id, subcategory_id, name, description, base_price, price, is_active, duration_minutes, avg_rating, reviews_count) VALUES 
            (gen_random_uuid(), sub_door_window, 'Door Repair', 'Door hinges, locks, alignment', 249, 249, true, 45, 4.6, 234),
            (gen_random_uuid(), sub_door_window, 'Window Repair', 'Window frame and glass repair', 299, 299, true, 45, 4.5, 178),
            (gen_random_uuid(), sub_door_window, 'Lock Replacement', 'Door lock installation/replacement', 199, 199, true, 30, 4.7, 289)
        ON CONFLICT DO NOTHING;
        
        SELECT id INTO svc_door_fix FROM services WHERE subcategory_id = sub_door_window AND name = 'Door Repair';
    END IF;
    
    -- Installation services
    IF sub_installation IS NOT NULL THEN
        INSERT INTO services (id, subcategory_id, name, description, base_price, price, is_active, duration_minutes, avg_rating, reviews_count) VALUES 
            (gen_random_uuid(), sub_installation, 'CCTV Installation', 'Security camera setup', 999, 999, true, 120, 4.8, 145),
            (gen_random_uuid(), sub_installation, 'Geyser Installation', 'Water heater installation', 399, 399, true, 60, 4.6, 198),
            (gen_random_uuid(), sub_installation, 'TV Wall Mount', 'TV mounting on wall', 349, 349, true, 45, 4.7, 267)
        ON CONFLICT DO NOTHING;
    END IF;

    -- =============================================
    -- INSERT PROVIDERS
    -- =============================================
    
    INSERT INTO providers (id, name, phone, experience, status, avatar_url) VALUES 
        (gen_random_uuid(), 'Rahul Kumar', '+919876543201', 8, 'active', 'https://randomuser.me/api/portraits/men/1.jpg'),
        (gen_random_uuid(), 'Amit Singh', '+919876543202', 5, 'active', 'https://randomuser.me/api/portraits/men/2.jpg'),
        (gen_random_uuid(), 'Suresh Patel', '+919876543203', 10, 'active', 'https://randomuser.me/api/portraits/men/3.jpg'),
        (gen_random_uuid(), 'Priya Sharma', '+919876543204', 6, 'active', 'https://randomuser.me/api/portraits/women/1.jpg'),
        (gen_random_uuid(), 'Deepak Verma', '+919876543205', 4, 'active', 'https://randomuser.me/api/portraits/men/4.jpg'),
        (gen_random_uuid(), 'Vikram Yadav', '+919876543206', 7, 'active', 'https://randomuser.me/api/portraits/men/5.jpg'),
        (gen_random_uuid(), 'Meena Kumari', '+919876543207', 5, 'active', 'https://randomuser.me/api/portraits/women/2.jpg'),
        (gen_random_uuid(), 'Raj Malhotra', '+919876543208', 9, 'active', 'https://randomuser.me/api/portraits/men/6.jpg'),
        (gen_random_uuid(), 'Ankit Gupta', '+919876543209', 3, 'pending', 'https://randomuser.me/api/portraits/men/7.jpg'),
        (gen_random_uuid(), 'Sunita Devi', '+919876543210', 4, 'active', 'https://randomuser.me/api/portraits/women/3.jpg')
    ON CONFLICT (phone) DO NOTHING;
    
    -- Get provider IDs
    SELECT id INTO prov_rahul FROM providers WHERE phone = '+919876543201';
    SELECT id INTO prov_amit FROM providers WHERE phone = '+919876543202';
    SELECT id INTO prov_suresh FROM providers WHERE phone = '+919876543203';
    SELECT id INTO prov_priya FROM providers WHERE phone = '+919876543204';
    SELECT id INTO prov_deepak FROM providers WHERE phone = '+919876543205';
    SELECT id INTO prov_vikram FROM providers WHERE phone = '+919876543206';
    SELECT id INTO prov_meena FROM providers WHERE phone = '+919876543207';
    SELECT id INTO prov_raj FROM providers WHERE phone = '+919876543208';

    -- =============================================
    -- ASSIGN PROVIDERS TO SERVICES
    -- =============================================
    
    -- Rahul Kumar - AC & Appliances specialist
    IF prov_rahul IS NOT NULL AND svc_ac_install IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_rahul, svc_ac_install, 'active') ON CONFLICT DO NOTHING;
    END IF;
    IF prov_rahul IS NOT NULL AND svc_ac_repair IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_rahul, svc_ac_repair, 'active') ON CONFLICT DO NOTHING;
    END IF;
    IF prov_rahul IS NOT NULL AND svc_washing_repair IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_rahul, svc_washing_repair, 'active') ON CONFLICT DO NOTHING;
    END IF;
    
    -- Amit Singh - Electrician
    IF prov_amit IS NOT NULL AND svc_switch_repair IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_amit, svc_switch_repair, 'active') ON CONFLICT DO NOTHING;
    END IF;
    IF prov_amit IS NOT NULL AND svc_fan_install IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_amit, svc_fan_install, 'active') ON CONFLICT DO NOTHING;
    END IF;
    
    -- Suresh Patel - Plumber
    IF prov_suresh IS NOT NULL AND svc_tap_repair IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_suresh, svc_tap_repair, 'active') ON CONFLICT DO NOTHING;
    END IF;
    IF prov_suresh IS NOT NULL AND svc_toilet_repair IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_suresh, svc_toilet_repair, 'active') ON CONFLICT DO NOTHING;
    END IF;
    
    -- Priya Sharma - Beauty specialist
    IF prov_priya IS NOT NULL AND svc_haircut_women IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_priya, svc_haircut_women, 'active') ON CONFLICT DO NOTHING;
    END IF;
    IF prov_priya IS NOT NULL AND svc_facial IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_priya, svc_facial, 'active') ON CONFLICT DO NOTHING;
    END IF;
    
    -- Deepak Verma - Carpenter
    IF prov_deepak IS NOT NULL AND svc_cupboard_repair IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_deepak, svc_cupboard_repair, 'active') ON CONFLICT DO NOTHING;
    END IF;
    IF prov_deepak IS NOT NULL AND svc_door_repair IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_deepak, svc_door_repair, 'active') ON CONFLICT DO NOTHING;
    END IF;
    
    -- Vikram Yadav - Painter
    IF prov_vikram IS NOT NULL AND svc_full_home_paint IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_vikram, svc_full_home_paint, 'active') ON CONFLICT DO NOTHING;
    END IF;
    IF prov_vikram IS NOT NULL AND svc_room_paint IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_vikram, svc_room_paint, 'active') ON CONFLICT DO NOTHING;
    END IF;
    
    -- Meena Kumari - Beauty & Cleaning
    IF prov_meena IS NOT NULL AND svc_facial IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_meena, svc_facial, 'active') ON CONFLICT DO NOTHING;
    END IF;
    IF prov_meena IS NOT NULL AND svc_sofa_clean IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_meena, svc_sofa_clean, 'active') ON CONFLICT DO NOTHING;
    END IF;
    
    -- Raj Malhotra - Multi-skilled (AC + Electrician)
    IF prov_raj IS NOT NULL AND svc_ac_install IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_raj, svc_ac_install, 'active') ON CONFLICT DO NOTHING;
    END IF;
    IF prov_raj IS NOT NULL AND svc_ac_repair IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_raj, svc_ac_repair, 'active') ON CONFLICT DO NOTHING;
    END IF;
    IF prov_raj IS NOT NULL AND svc_fan_install IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_raj, svc_fan_install, 'active') ON CONFLICT DO NOTHING;
    END IF;
    IF prov_raj IS NOT NULL AND svc_door_fix IS NOT NULL THEN
        INSERT INTO provider_services (provider_id, service_id, status) VALUES (prov_raj, svc_door_fix, 'active') ON CONFLICT DO NOTHING;
    END IF;

    RAISE NOTICE 'Sample data seeded successfully!';
    
END $$;
