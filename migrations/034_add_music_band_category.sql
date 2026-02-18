-- Migration: Add Music & Band category with subcategories and services

DO $$
DECLARE
    cat_music_band UUID;
    sub_dj UUID;
    sub_live_band UUID;
    sub_instruments UUID;
    sub_music_classes UUID;
BEGIN
    -- =============================================
    -- CREATE MUSIC & BAND CATEGORY
    -- =============================================
    INSERT INTO categories (name, description, image_url)
    VALUES (
        'Music & Band', 
        'Professional musicians, DJs, live bands, and music lessons for all occasions',
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800'
    )
    ON CONFLICT (name) DO NOTHING
    RETURNING id INTO cat_music_band;
    
    -- If category already exists, get its ID
    IF cat_music_band IS NULL THEN
        SELECT id INTO cat_music_band FROM categories WHERE name = 'Music & Band';
    END IF;

    -- =============================================
    -- CREATE SUBCATEGORIES (no description column)
    -- =============================================
    
    -- DJ Services
    INSERT INTO subcategories (name, category_id, image_url)
    VALUES (
        'DJ Services',
        cat_music_band,
        'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO sub_dj;
    
    IF sub_dj IS NULL THEN
        SELECT id INTO sub_dj FROM subcategories WHERE name = 'DJ Services' AND category_id = cat_music_band;
    END IF;

    -- Live Band
    INSERT INTO subcategories (name, category_id, image_url)
    VALUES (
        'Live Band',
        cat_music_band,
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO sub_live_band;
    
    IF sub_live_band IS NULL THEN
        SELECT id INTO sub_live_band FROM subcategories WHERE name = 'Live Band' AND category_id = cat_music_band;
    END IF;

    -- Instrument Services
    INSERT INTO subcategories (name, category_id, image_url)
    VALUES (
        'Instrument Services',
        cat_music_band,
        'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO sub_instruments;
    
    IF sub_instruments IS NULL THEN
        SELECT id INTO sub_instruments FROM subcategories WHERE name = 'Instrument Services' AND category_id = cat_music_band;
    END IF;

    -- Music Classes
    INSERT INTO subcategories (name, category_id, image_url)
    VALUES (
        'Music Classes',
        cat_music_band,
        'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO sub_music_classes;
    
    IF sub_music_classes IS NULL THEN
        SELECT id INTO sub_music_classes FROM subcategories WHERE name = 'Music Classes' AND category_id = cat_music_band;
    END IF;

    -- =============================================
    -- CREATE SERVICES
    -- =============================================
    
    -- DJ Services
    INSERT INTO services (name, description, base_price, subcategory_id, avg_rating, reviews_count, duration_minutes, thumbnail_url, currency)
    VALUES 
        ('Wedding DJ', 'Professional DJ for wedding ceremonies and receptions', 8000, sub_dj, 4.8, 324, 480, 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400', 'INR'),
        ('Party DJ', 'High-energy DJ for birthday parties and celebrations', 5000, sub_dj, 4.7, 512, 300, 'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=400', 'INR'),
        ('Corporate Event DJ', 'Professional DJ for corporate functions and events', 10000, sub_dj, 4.6, 189, 360, 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=400', 'INR'),
        ('Club DJ Session', 'Club-style DJ performance', 15000, sub_dj, 4.9, 98, 240, 'https://images.unsplash.com/photo-1598387181032-a3103a2db5b3?w=400', 'INR')
    ON CONFLICT (name) DO NOTHING;

    -- Live Band Services
    INSERT INTO services (name, description, base_price, subcategory_id, avg_rating, reviews_count, duration_minutes, thumbnail_url, currency)
    VALUES 
        ('Live Band Performance', 'Full live band for concerts and events', 25000, sub_live_band, 4.8, 156, 180, 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400', 'INR'),
        ('Acoustic Band', 'Acoustic performance for intimate gatherings', 12000, sub_live_band, 4.7, 234, 120, 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400', 'INR'),
        ('Jazz Band', 'Professional jazz band for sophisticated events', 18000, sub_live_band, 4.9, 87, 180, 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=400', 'INR'),
        ('Rock Band', 'High-energy rock band performance', 20000, sub_live_band, 4.6, 143, 180, 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400', 'INR')
    ON CONFLICT (name) DO NOTHING;

    -- Instrument Services
    INSERT INTO services (name, description, base_price, subcategory_id, avg_rating, reviews_count, duration_minutes, thumbnail_url, currency)
    VALUES 
        ('Guitar Repair', 'Professional guitar repair and setup', 800, sub_instruments, 4.7, 412, 60, 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400', 'INR'),
        ('Piano Tuning', 'Expert piano tuning service', 1500, sub_instruments, 4.9, 267, 90, 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=400', 'INR'),
        ('Drum Kit Repair', 'Complete drum kit maintenance and repair', 1200, sub_instruments, 4.5, 134, 120, 'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=400', 'INR'),
        ('Violin Repair', 'Delicate violin repair by experts', 1000, sub_instruments, 4.8, 189, 60, 'https://images.unsplash.com/photo-1612225330812-01a9c6b355ec?w=400', 'INR')
    ON CONFLICT (name) DO NOTHING;

    -- Music Classes
    INSERT INTO services (name, description, base_price, subcategory_id, avg_rating, reviews_count, duration_minutes, thumbnail_url, currency)
    VALUES 
        ('Guitar Lessons', 'One-on-one guitar lessons for all levels', 500, sub_music_classes, 4.8, 567, 60, 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400', 'INR'),
        ('Piano Lessons', 'Professional piano instruction', 600, sub_music_classes, 4.9, 423, 60, 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=400', 'INR'),
        ('Vocal Training', 'Voice training and singing lessons', 500, sub_music_classes, 4.7, 345, 60, 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400', 'INR'),
        ('Drum Lessons', 'Beginner to advanced drum lessons', 550, sub_music_classes, 4.6, 234, 60, 'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=400', 'INR')
    ON CONFLICT (name) DO NOTHING;

    RAISE NOTICE 'Music & Band category created with ID: %', cat_music_band;
END $$;
