-- Add Event Organizer category with subcategories and services

-- 1. Create Event Organizer category
INSERT INTO categories (id, name, description, image_url)
VALUES (
  gen_random_uuid(),
  'Event Organizer',
  'Professional event planning and organization services for weddings, parties, corporate events and more',
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=400&h=300&fit=crop'
)
ON CONFLICT (name) DO NOTHING;

-- Get the category ID for use in subcategories
DO $$
DECLARE
  event_cat_id UUID;
  wedding_sub_id UUID;
  birthday_sub_id UUID;
  corporate_sub_id UUID;
  decoration_sub_id UUID;
  catering_sub_id UUID;
BEGIN
  -- Get the Event Organizer category ID
  SELECT id INTO event_cat_id FROM categories WHERE name = 'Event Organizer';
  
  IF event_cat_id IS NULL THEN
    RAISE NOTICE 'Event Organizer category not found';
    RETURN;
  END IF;

  -- 2. Create subcategories
  INSERT INTO subcategories (id, category_id, name, icon, image_url)
  VALUES (gen_random_uuid(), event_cat_id, 'Wedding Planning', '💒', 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=300&fit=crop')
  ON CONFLICT DO NOTHING
  RETURNING id INTO wedding_sub_id;
  
  IF wedding_sub_id IS NULL THEN
    SELECT id INTO wedding_sub_id FROM subcategories WHERE category_id = event_cat_id AND name = 'Wedding Planning';
  END IF;

  INSERT INTO subcategories (id, category_id, name, icon, image_url)
  VALUES (gen_random_uuid(), event_cat_id, 'Birthday Parties', '🎂', 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=400&h=300&fit=crop')
  ON CONFLICT DO NOTHING
  RETURNING id INTO birthday_sub_id;
  
  IF birthday_sub_id IS NULL THEN
    SELECT id INTO birthday_sub_id FROM subcategories WHERE category_id = event_cat_id AND name = 'Birthday Parties';
  END IF;

  INSERT INTO subcategories (id, category_id, name, icon, image_url)
  VALUES (gen_random_uuid(), event_cat_id, 'Corporate Events', '🏢', 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=400&h=300&fit=crop')
  ON CONFLICT DO NOTHING
  RETURNING id INTO corporate_sub_id;
  
  IF corporate_sub_id IS NULL THEN
    SELECT id INTO corporate_sub_id FROM subcategories WHERE category_id = event_cat_id AND name = 'Corporate Events';
  END IF;

  INSERT INTO subcategories (id, category_id, name, icon, image_url)
  VALUES (gen_random_uuid(), event_cat_id, 'Decoration Services', '🎊', 'https://images.unsplash.com/photo-1478146059778-26028b07395a?w=400&h=300&fit=crop')
  ON CONFLICT DO NOTHING
  RETURNING id INTO decoration_sub_id;
  
  IF decoration_sub_id IS NULL THEN
    SELECT id INTO decoration_sub_id FROM subcategories WHERE category_id = event_cat_id AND name = 'Decoration Services';
  END IF;

  INSERT INTO subcategories (id, category_id, name, icon, image_url)
  VALUES (gen_random_uuid(), event_cat_id, 'Catering Services', '🍽️', 'https://images.unsplash.com/photo-1555244162-803834f70033?w=400&h=300&fit=crop')
  ON CONFLICT DO NOTHING
  RETURNING id INTO catering_sub_id;
  
  IF catering_sub_id IS NULL THEN
    SELECT id INTO catering_sub_id FROM subcategories WHERE category_id = event_cat_id AND name = 'Catering Services';
  END IF;

  -- 3. Create services for each subcategory
  
  -- Wedding Planning Services
  IF wedding_sub_id IS NOT NULL THEN
    INSERT INTO services (subcategory_id, name, description, base_price, price, duration_minutes, thumbnail_url, is_active)
    VALUES 
      (wedding_sub_id, 'Complete Wedding Planning', 'End-to-end wedding planning including venue, decoration, catering coordination', 50000, 50000, 480, 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=300&fit=crop', true),
      (wedding_sub_id, 'Wedding Day Coordination', 'On-the-day coordination and management of wedding events', 15000, 15000, 720, 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=400&h=300&fit=crop', true),
      (wedding_sub_id, 'Mehendi Ceremony Setup', 'Complete mehendi function decoration and arrangement', 8000, 8000, 240, 'https://images.unsplash.com/photo-1583089892943-e02e5b017b6a?w=400&h=300&fit=crop', true),
      (wedding_sub_id, 'Sangeet Night Organization', 'Full sangeet event planning with music and dance arrangements', 25000, 25000, 360, 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=300&fit=crop', true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Birthday Party Services
  IF birthday_sub_id IS NOT NULL THEN
    INSERT INTO services (subcategory_id, name, description, base_price, price, duration_minutes, thumbnail_url, is_active)
    VALUES 
      (birthday_sub_id, 'Kids Birthday Party Package', 'Complete birthday party setup for kids with games, decoration and cake', 5000, 5000, 180, 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=400&h=300&fit=crop', true),
      (birthday_sub_id, 'Adult Birthday Celebration', 'Elegant birthday party planning for adults', 8000, 8000, 240, 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop', true),
      (birthday_sub_id, 'Theme Birthday Party', 'Customized theme-based birthday party setup', 12000, 12000, 300, 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=400&h=300&fit=crop', true),
      (birthday_sub_id, 'Surprise Birthday Setup', 'Secret surprise party arrangement and execution', 7000, 7000, 180, 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=400&h=300&fit=crop', true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Corporate Event Services
  IF corporate_sub_id IS NOT NULL THEN
    INSERT INTO services (subcategory_id, name, description, base_price, price, duration_minutes, thumbnail_url, is_active)
    VALUES 
      (corporate_sub_id, 'Corporate Conference Setup', 'Complete conference organization with AV setup and seating', 30000, 30000, 480, 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=400&h=300&fit=crop', true),
      (corporate_sub_id, 'Team Building Event', 'Fun team building activities and games organization', 15000, 15000, 360, 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400&h=300&fit=crop', true),
      (corporate_sub_id, 'Product Launch Event', 'Grand product launch event planning and execution', 50000, 50000, 480, 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=400&h=300&fit=crop', true),
      (corporate_sub_id, 'Annual Day Celebration', 'Company annual day event management', 40000, 40000, 600, 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop', true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Decoration Services
  IF decoration_sub_id IS NOT NULL THEN
    INSERT INTO services (subcategory_id, name, description, base_price, price, duration_minutes, thumbnail_url, is_active)
    VALUES 
      (decoration_sub_id, 'Balloon Decoration', 'Creative balloon decoration for any event', 3000, 3000, 120, 'https://images.unsplash.com/photo-1478146059778-26028b07395a?w=400&h=300&fit=crop', true),
      (decoration_sub_id, 'Flower Decoration', 'Beautiful fresh flower arrangements and decoration', 5000, 5000, 180, 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=400&h=300&fit=crop', true),
      (decoration_sub_id, 'Stage Decoration', 'Professional stage setup and decoration', 15000, 15000, 300, 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=400&h=300&fit=crop', true),
      (decoration_sub_id, 'LED & Lighting Setup', 'Ambient LED lighting and effects setup', 8000, 8000, 180, 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=300&fit=crop', true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Catering Services
  IF catering_sub_id IS NOT NULL THEN
    INSERT INTO services (subcategory_id, name, description, base_price, price, duration_minutes, thumbnail_url, is_active)
    VALUES 
      (catering_sub_id, 'Vegetarian Catering (50 pax)', 'Complete veg menu catering for 50 people', 15000, 15000, 240, 'https://images.unsplash.com/photo-1555244162-803834f70033?w=400&h=300&fit=crop', true),
      (catering_sub_id, 'Non-Veg Catering (50 pax)', 'Complete non-veg menu catering for 50 people', 20000, 20000, 240, 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop', true),
      (catering_sub_id, 'Live Food Counter', 'Live cooking counter with chef', 12000, 12000, 300, 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop', true),
      (catering_sub_id, 'Dessert & Cake Service', 'Dessert buffet and custom cake service', 8000, 8000, 180, 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=300&fit=crop', true)
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Event Organizer category, subcategories, and services created successfully!';
END $$;
