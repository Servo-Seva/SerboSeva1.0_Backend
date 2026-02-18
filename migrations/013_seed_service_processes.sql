-- Seed sample service process data
-- Run this after you have services in your database

-- First, let's add some sample processes for different service types
-- You'll need to replace the service IDs with actual IDs from your services table

-- Example: Get a few service IDs to work with
-- SELECT id, name FROM services LIMIT 10;

-- For demonstration, this creates a function to seed data for a service by name
-- Usage: SELECT seed_service_process('AC Repair');

CREATE OR REPLACE FUNCTION seed_service_process(service_name TEXT) 
RETURNS void AS $$
DECLARE
    svc_id UUID;
BEGIN
    -- Find service by name (case insensitive partial match)
    SELECT id INTO svc_id FROM services 
    WHERE LOWER(name) LIKE LOWER('%' || service_name || '%') 
    LIMIT 1;
    
    IF svc_id IS NULL THEN
        RAISE NOTICE 'Service not found: %', service_name;
        RETURN;
    END IF;
    
    RAISE NOTICE 'Seeding data for service: % (ID: %)', service_name, svc_id;
    
    -- Clear existing data for this service
    DELETE FROM service_processes WHERE service_id = svc_id;
    DELETE FROM service_cover_promises WHERE service_id = svc_id;
    DELETE FROM service_faqs WHERE service_id = svc_id;
    DELETE FROM service_includes WHERE service_id = svc_id;
    DELETE FROM service_excludes WHERE service_id = svc_id;
    
    -- Add processes based on service type
    IF LOWER(service_name) LIKE '%ac%' OR LOWER(service_name) LIKE '%air%condition%' THEN
        INSERT INTO service_processes (service_id, step_number, title, description, icon) VALUES
        (svc_id, 1, 'Diagnosis', 'Our technician will inspect your AC unit and diagnose the issue', 'search'),
        (svc_id, 2, 'Gas Check & Refill', 'Check refrigerant levels and refill if needed', 'thermometer'),
        (svc_id, 3, 'Component Repair', 'Repair or replace faulty components', 'wrench'),
        (svc_id, 4, 'Performance Testing', 'Test cooling efficiency and airflow', 'gauge'),
        (svc_id, 5, 'Cleanup & Handover', 'Clean the work area and explain the repairs done', 'sparkles');
        
        INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
        (svc_id, '90-Day Repair Warranty', 'Free re-repair if the same issue occurs', 0),
        (svc_id, 'Genuine Spare Parts', 'Only original or high-quality parts used', 1),
        (svc_id, 'Trained Technicians', 'All technicians are brand-certified', 2),
        (svc_id, 'Transparent Pricing', 'No hidden charges, pay what you see', 3);
        
        INSERT INTO service_faqs (service_id, question, answer, sort_order) VALUES
        (svc_id, 'How long does AC repair take?', 'Most repairs are completed within 1-2 hours. Complex issues may take longer.', 0),
        (svc_id, 'Do I need to provide any parts?', 'No, our technicians carry common spare parts. Special parts may be sourced with prior notice.', 1),
        (svc_id, 'What if the AC cannot be repaired?', 'If repair is not feasible, we''ll advise you on replacement options with no service charge.', 2);
        
        INSERT INTO service_includes (service_id, item, description, sort_order) VALUES
        (svc_id, 'Complete diagnosis', 'Full inspection of all AC components', 0),
        (svc_id, 'Basic cleaning', 'Filter and exterior cleaning included', 1),
        (svc_id, 'Gas top-up (if needed)', 'Minor gas refill included in service', 2);
        
        INSERT INTO service_excludes (service_id, item, description, sort_order) VALUES
        (svc_id, 'Major spare parts', 'Compressor, PCB, etc. charged separately', 0),
        (svc_id, 'Full gas refill', 'Complete gas refill charged extra', 1),
        (svc_id, 'Outdoor unit repair', 'External unit repairs may have additional charges', 2);
        
    ELSIF LOWER(service_name) LIKE '%clean%' OR LOWER(service_name) LIKE '%cleaning%' THEN
        INSERT INTO service_processes (service_id, step_number, title, description, icon) VALUES
        (svc_id, 1, 'Assessment', 'Survey all rooms and note areas needing special attention', 'clipboard'),
        (svc_id, 2, 'Dusting & Sweeping', 'Dust all surfaces, furniture, and sweep floors', 'wind'),
        (svc_id, 3, 'Mopping & Sanitizing', 'Mop all floors with eco-friendly disinfectant', 'droplet'),
        (svc_id, 4, 'Bathroom Deep Clean', 'Scrub and sanitize all bathroom fixtures', 'bath'),
        (svc_id, 5, 'Kitchen Cleaning', 'Clean kitchen surfaces, sink, and appliances', 'utensils'),
        (svc_id, 6, 'Final Inspection', 'Walkthrough with you to ensure satisfaction', 'check');
        
        INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
        (svc_id, 'Satisfaction Guarantee', 'Not happy? We''ll re-clean for free', 0),
        (svc_id, 'Eco-Friendly Products', 'Safe for kids and pets', 1),
        (svc_id, 'Background-Verified Staff', 'All cleaners are thoroughly vetted', 2),
        (svc_id, 'On-Time Service', 'We arrive within the scheduled window', 3);
        
        INSERT INTO service_faqs (service_id, question, answer, sort_order) VALUES
        (svc_id, 'Do I need to provide cleaning supplies?', 'No, our team brings all necessary cleaning equipment and supplies.', 0),
        (svc_id, 'How long does a full home cleaning take?', 'A 2BHK typically takes 2-3 hours. Larger homes may take 3-4 hours.', 1),
        (svc_id, 'Are your cleaning products safe for pets?', 'Yes, we use eco-friendly, pet-safe cleaning solutions.', 2);
        
    ELSIF LOWER(service_name) LIKE '%plumb%' THEN
        INSERT INTO service_processes (service_id, step_number, title, description, icon) VALUES
        (svc_id, 1, 'Problem Identification', 'Locate the source of the plumbing issue', 'search'),
        (svc_id, 2, 'Repair Work', 'Fix leaks, unclog drains, or repair pipes', 'wrench'),
        (svc_id, 3, 'Pressure Testing', 'Test water pressure and flow', 'gauge'),
        (svc_id, 4, 'Cleanup', 'Clean the work area and dispose of debris', 'sparkles');
        
        INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
        (svc_id, '30-Day Warranty', 'Free re-service if the same issue recurs', 0),
        (svc_id, 'No Fix, No Fee', 'If we can''t fix it, you don''t pay', 1),
        (svc_id, 'Upfront Pricing', 'Know the cost before we start', 2);
        
    ELSIF LOWER(service_name) LIKE '%electric%' THEN
        INSERT INTO service_processes (service_id, step_number, title, description, icon) VALUES
        (svc_id, 1, 'Safety Check', 'Turn off power and ensure safe working conditions', 'shield'),
        (svc_id, 2, 'Diagnosis', 'Identify electrical faults and issues', 'search'),
        (svc_id, 3, 'Repair/Installation', 'Fix wiring, switches, or install new fixtures', 'zap'),
        (svc_id, 4, 'Testing', 'Test all repaired/installed items', 'check'),
        (svc_id, 5, 'Safety Handover', 'Explain work done and safety tips', 'clipboard');
        
        INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
        (svc_id, '30-Day Warranty', 'Free re-service for workmanship issues', 0),
        (svc_id, 'Licensed Electricians', 'All work done by certified professionals', 1),
        (svc_id, 'Safety First', 'We follow all electrical safety codes', 2);
        
    ELSIF LOWER(service_name) LIKE '%pest%' THEN
        INSERT INTO service_processes (service_id, step_number, title, description, icon) VALUES
        (svc_id, 1, 'Inspection', 'Identify pest type and infestation level', 'search'),
        (svc_id, 2, 'Treatment Plan', 'Explain the treatment approach and safety measures', 'clipboard'),
        (svc_id, 3, 'Chemical Application', 'Apply appropriate pesticides to affected areas', 'spray'),
        (svc_id, 4, 'Entry Point Sealing', 'Seal common pest entry points', 'shield'),
        (svc_id, 5, 'Follow-up Advice', 'Tips to prevent re-infestation', 'lightbulb');
        
        INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
        (svc_id, '60-Day Warranty', 'Free re-treatment if pests return', 0),
        (svc_id, 'Safe Chemicals', 'Child and pet-safe after drying', 1),
        (svc_id, 'Certified Technicians', 'Government-licensed pest control experts', 2);
        
    ELSE
        -- Generic service processes
        INSERT INTO service_processes (service_id, step_number, title, description, icon) VALUES
        (svc_id, 1, 'Assessment', 'Our expert assesses the job requirements', 'clipboard'),
        (svc_id, 2, 'Preparation', 'Prepare the work area and gather materials', 'tool'),
        (svc_id, 3, 'Service Execution', 'Professional service delivery', 'wrench'),
        (svc_id, 4, 'Quality Check', 'Verify the work meets our standards', 'check'),
        (svc_id, 5, 'Handover', 'Explain work done and answer questions', 'handshake');
        
        INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
        (svc_id, '30-Day Warranty', 'Free re-service if issues arise', 0),
        (svc_id, 'Verified Professionals', 'Background-checked experts', 1),
        (svc_id, 'Transparent Pricing', 'No hidden charges', 2);
    END IF;
    
    RAISE NOTICE 'Successfully seeded data for: %', service_name;
END;
$$ LANGUAGE plpgsql;

-- Now let's seed data for all existing services automatically
DO $$
DECLARE
    svc RECORD;
BEGIN
    FOR svc IN SELECT id, name FROM services WHERE is_active = true LOOP
        PERFORM seed_service_process(svc.name);
    END LOOP;
END $$;

-- Show what was created
SELECT 
    s.name as service_name,
    (SELECT COUNT(*) FROM service_processes WHERE service_id = s.id) as processes,
    (SELECT COUNT(*) FROM service_cover_promises WHERE service_id = s.id) as promises,
    (SELECT COUNT(*) FROM service_faqs WHERE service_id = s.id) as faqs,
    (SELECT COUNT(*) FROM service_includes WHERE service_id = s.id) as includes,
    (SELECT COUNT(*) FROM service_excludes WHERE service_id = s.id) as excludes
FROM services s
WHERE s.is_active = true
ORDER BY s.name;
