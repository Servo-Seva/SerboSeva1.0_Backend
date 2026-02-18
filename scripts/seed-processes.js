require('dotenv').config();
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function seed() {
    try {
        console.log('🔄 Starting service process seeding...\n');

        // Get all active services
        const services = await sql`SELECT id, name FROM services WHERE is_active = true`;
        console.log('Found', services.length, 'active services\n');

        for (const svc of services) {
            const name = svc.name.toLowerCase();
            const svcId = svc.id;

            // Clear existing data
            await sql`DELETE FROM service_processes WHERE service_id = ${svcId}`;
            await sql`DELETE FROM service_cover_promises WHERE service_id = ${svcId}`;
            await sql`DELETE FROM service_faqs WHERE service_id = ${svcId}`;
            await sql`DELETE FROM service_includes WHERE service_id = ${svcId}`;
            await sql`DELETE FROM service_excludes WHERE service_id = ${svcId}`;

            // Determine service type
            let type = 'generic';
            if (name.includes('ac') || name.includes('air') || name.includes('cooling')) type = 'ac';
            else if (name.includes('clean') || name.includes('wash')) type = 'cleaning';
            else if (name.includes('plumb') || name.includes('pipe') || name.includes('leak') || name.includes('tap')) type = 'plumbing';
            else if (name.includes('electric') || name.includes('wiring') || name.includes('switch') || name.includes('fan')) type = 'electrical';
            else if (name.includes('pest') || name.includes('cockroach') || name.includes('termite')) type = 'pest';
            else if (name.includes('paint')) type = 'painting';
            else if (name.includes('salon') || name.includes('beauty') || name.includes('facial') || name.includes('makeup') || name.includes('hair') || name.includes('wax') || name.includes('manicure') || name.includes('pedicure')) type = 'beauty';
            else if (name.includes('massage') || name.includes('spa')) type = 'spa';
            else if (name.includes('carpenter') || name.includes('furniture') || name.includes('wood')) type = 'carpentry';
            else if (name.includes('repair')) type = 'repair';

            // Insert processes based on type
            switch (type) {
                case 'ac':
                    await sql`INSERT INTO service_processes (service_id, step_number, title, description) VALUES
            (${svcId}, 1, 'Diagnosis', 'Technician inspects AC unit and identifies the issue'),
            (${svcId}, 2, 'Gas Level Check', 'Check refrigerant levels and pressure'),
            (${svcId}, 3, 'Component Repair', 'Repair or replace faulty components'),
            (${svcId}, 4, 'Performance Test', 'Test cooling efficiency and airflow'),
            (${svcId}, 5, 'Cleanup & Handover', 'Clean work area and explain repairs done')`;

                    await sql`INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
            (${svcId}, '90-Day Repair Warranty', 'Free re-repair if same issue occurs', 0),
            (${svcId}, 'Genuine Parts Only', 'Original or high-quality spare parts used', 1),
            (${svcId}, 'Certified Technicians', 'Brand-trained AC professionals', 2),
            (${svcId}, 'Transparent Pricing', 'No hidden charges, pay what you see', 3)`;

                    await sql`INSERT INTO service_faqs (service_id, question, answer, sort_order) VALUES
            (${svcId}, 'How long does AC repair take?', 'Most repairs complete in 1-2 hours. Complex issues may take longer.', 0),
            (${svcId}, 'Do I need to provide spare parts?', 'No, our technicians carry common parts. Special parts sourced with prior notice.', 1),
            (${svcId}, 'What if AC cannot be repaired?', 'We will advise you on replacement options with no service charge.', 2)`;

                    await sql`INSERT INTO service_includes (service_id, item, description, sort_order) VALUES
            (${svcId}, 'Complete diagnosis', 'Full inspection of all AC components', 0),
            (${svcId}, 'Basic filter cleaning', 'Filter and exterior cleaning included', 1),
            (${svcId}, 'Minor gas top-up', 'Small gas refill if needed', 2)`;

                    await sql`INSERT INTO service_excludes (service_id, item, description, sort_order) VALUES
            (${svcId}, 'Major spare parts', 'Compressor, PCB charged separately', 0),
            (${svcId}, 'Complete gas refill', 'Full gas refill costs extra', 1)`;
                    break;

                case 'cleaning':
                    await sql`INSERT INTO service_processes (service_id, step_number, title, description) VALUES
            (${svcId}, 1, 'Area Assessment', 'Survey all areas and identify spots needing attention'),
            (${svcId}, 2, 'Dusting & Sweeping', 'Dust all surfaces and sweep floors'),
            (${svcId}, 3, 'Deep Cleaning', 'Scrub and clean stubborn stains'),
            (${svcId}, 4, 'Mopping & Sanitizing', 'Mop floors with eco-friendly disinfectant'),
            (${svcId}, 5, 'Final Inspection', 'Walkthrough to ensure your satisfaction')`;

                    await sql`INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
            (${svcId}, 'Satisfaction Guarantee', 'Not happy? We will re-clean for free', 0),
            (${svcId}, 'Eco-Friendly Products', 'Safe for kids, pets, and environment', 1),
            (${svcId}, 'Verified Staff', 'Background-checked cleaning professionals', 2),
            (${svcId}, 'On-Time Arrival', 'We arrive within scheduled time window', 3)`;

                    await sql`INSERT INTO service_faqs (service_id, question, answer, sort_order) VALUES
            (${svcId}, 'Do I need to provide cleaning supplies?', 'No, our team brings all necessary equipment and supplies.', 0),
            (${svcId}, 'How long does cleaning take?', '2BHK typically takes 2-3 hours, larger homes may take 3-4 hours.', 1),
            (${svcId}, 'Are your products safe for pets?', 'Yes, we use eco-friendly, pet-safe cleaning solutions.', 2)`;
                    break;

                case 'plumbing':
                    await sql`INSERT INTO service_processes (service_id, step_number, title, description) VALUES
            (${svcId}, 1, 'Problem Identification', 'Locate the source of the plumbing issue'),
            (${svcId}, 2, 'Repair Work', 'Fix leaks, unclog drains, or repair pipes'),
            (${svcId}, 3, 'Pressure Testing', 'Test water pressure and check for leaks'),
            (${svcId}, 4, 'Cleanup', 'Clean work area and dispose of debris')`;

                    await sql`INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
            (${svcId}, '30-Day Warranty', 'Free re-service if issue recurs', 0),
            (${svcId}, 'No Fix No Fee', 'If we cannot fix it, you do not pay', 1),
            (${svcId}, 'Upfront Pricing', 'Know the cost before we start', 2)`;

                    await sql`INSERT INTO service_faqs (service_id, question, answer, sort_order) VALUES
            (${svcId}, 'Do you handle major pipe repairs?', 'Yes, we handle all plumbing from minor fixes to major repairs.', 0),
            (${svcId}, 'What about hidden leaks?', 'We use professional equipment to detect hidden leaks.', 1)`;
                    break;

                case 'electrical':
                    await sql`INSERT INTO service_processes (service_id, step_number, title, description) VALUES
            (${svcId}, 1, 'Safety First', 'Turn off power and ensure safe working conditions'),
            (${svcId}, 2, 'Fault Diagnosis', 'Identify electrical issues using testing equipment'),
            (${svcId}, 3, 'Repair/Installation', 'Fix wiring or install new fixtures'),
            (${svcId}, 4, 'Safety Testing', 'Test all repaired items for safety'),
            (${svcId}, 5, 'Handover', 'Explain work done and provide safety tips')`;

                    await sql`INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
            (${svcId}, '30-Day Warranty', 'Free re-service for workmanship issues', 0),
            (${svcId}, 'Licensed Electricians', 'All work by certified professionals', 1),
            (${svcId}, 'Safety Compliant', 'All work follows electrical codes', 2)`;

                    await sql`INSERT INTO service_faqs (service_id, question, answer, sort_order) VALUES
            (${svcId}, 'Is electrical work safe?', 'All our electricians are certified and follow strict safety protocols.', 0),
            (${svcId}, 'Do you provide wiring materials?', 'Yes, we bring all necessary materials and cables.', 1)`;
                    break;

                case 'pest':
                    await sql`INSERT INTO service_processes (service_id, step_number, title, description) VALUES
            (${svcId}, 1, 'Pest Inspection', 'Identify pest type and infestation areas'),
            (${svcId}, 2, 'Treatment Plan', 'Explain our approach and safety measures'),
            (${svcId}, 3, 'Chemical Application', 'Apply appropriate pesticides'),
            (${svcId}, 4, 'Entry Point Sealing', 'Seal common pest entry points'),
            (${svcId}, 5, 'Prevention Tips', 'Advice to prevent re-infestation')`;

                    await sql`INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
            (${svcId}, '60-Day Warranty', 'Free re-treatment if pests return', 0),
            (${svcId}, 'Safe Chemicals', 'Child and pet-safe after drying', 1),
            (${svcId}, 'Government Licensed', 'Certified pest control experts', 2)`;

                    await sql`INSERT INTO service_faqs (service_id, question, answer, sort_order) VALUES
            (${svcId}, 'Is it safe for children and pets?', 'Yes, after 2-3 hours of drying the treated area is completely safe.', 0),
            (${svcId}, 'How often should pest control be done?', 'We recommend every 3-6 months for effective prevention.', 1)`;
                    break;

                case 'beauty':
                    await sql`INSERT INTO service_processes (service_id, step_number, title, description) VALUES
            (${svcId}, 1, 'Consultation', 'Discuss your preferences and skin/hair type'),
            (${svcId}, 2, 'Preparation', 'Cleanse and prep the treatment area'),
            (${svcId}, 3, 'Treatment', 'Professional beauty service'),
            (${svcId}, 4, 'Finishing Touches', 'Style and perfect the look'),
            (${svcId}, 5, 'Aftercare Tips', 'Advice for maintaining results at home')`;

                    await sql`INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
            (${svcId}, 'Premium Products', 'Salon-quality branded products only', 0),
            (${svcId}, 'Trained Professionals', 'Certified beauty experts', 1),
            (${svcId}, 'Hygiene First', 'Sanitized tools, single-use items', 2),
            (${svcId}, 'Satisfaction Guarantee', 'Not happy? We make it right', 3)`;

                    await sql`INSERT INTO service_faqs (service_id, question, answer, sort_order) VALUES
            (${svcId}, 'What products do you use?', 'We use premium salon brands suitable for all skin types.', 0),
            (${svcId}, 'Can I request a specific beautician?', 'Yes, you can request your preferred professional when booking.', 1)`;
                    break;

                case 'spa':
                    await sql`INSERT INTO service_processes (service_id, step_number, title, description) VALUES
            (${svcId}, 1, 'Consultation', 'Discuss preferences and any health concerns'),
            (${svcId}, 2, 'Setup', 'Prepare massage table, oils, and create ambiance'),
            (${svcId}, 3, 'Therapy Session', 'Professional massage/spa treatment'),
            (${svcId}, 4, 'Relaxation', 'Post-treatment relaxation period'),
            (${svcId}, 5, 'Aftercare', 'Hydration and wellness tips')`;

                    await sql`INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
            (${svcId}, 'Certified Therapists', 'Trained and experienced massage professionals', 0),
            (${svcId}, 'Premium Products', 'Organic oils and natural lotions', 1),
            (${svcId}, 'Complete Privacy', 'Professional and discreet service', 2)`;
                    break;

                case 'carpentry':
                    await sql`INSERT INTO service_processes (service_id, step_number, title, description) VALUES
            (${svcId}, 1, 'Requirement Discussion', 'Understand your needs and take measurements'),
            (${svcId}, 2, 'Material Check', 'Inspect materials and hardware needed'),
            (${svcId}, 3, 'Woodwork', 'Cutting, joining, and assembly'),
            (${svcId}, 4, 'Finishing', 'Polish, paint, or laminate as needed'),
            (${svcId}, 5, 'Installation', 'Fit and secure the finished work')`;

                    await sql`INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
            (${svcId}, '6-Month Warranty', 'Coverage for workmanship defects', 0),
            (${svcId}, 'Quality Materials', 'Premium wood and hardware used', 1),
            (${svcId}, 'Custom Solutions', 'Made exactly to your specifications', 2)`;
                    break;

                case 'painting':
                    await sql`INSERT INTO service_processes (service_id, step_number, title, description) VALUES
            (${svcId}, 1, 'Surface Preparation', 'Clean walls, fill cracks and sand smooth'),
            (${svcId}, 2, 'Primer Application', 'Apply primer for better paint adhesion'),
            (${svcId}, 3, 'Color Application', 'Apply your chosen paint colors'),
            (${svcId}, 4, 'Final Coat', 'Apply finishing coat for smooth finish'),
            (${svcId}, 5, 'Cleanup', 'Clean work area and remove coverings')`;

                    await sql`INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
            (${svcId}, '1-Year Warranty', 'Coverage for peeling or bubbling', 0),
            (${svcId}, 'Premium Paints', 'Branded, long-lasting paints', 1),
            (${svcId}, 'Clean Finish', 'Professional, streak-free work', 2)`;
                    break;

                case 'repair':
                    await sql`INSERT INTO service_processes (service_id, step_number, title, description) VALUES
            (${svcId}, 1, 'Inspection', 'Examine the item and diagnose the problem'),
            (${svcId}, 2, 'Quote', 'Provide transparent cost estimate'),
            (${svcId}, 3, 'Repair', 'Fix or replace faulty components'),
            (${svcId}, 4, 'Testing', 'Verify the repair is successful'),
            (${svcId}, 5, 'Handover', 'Explain the repair and warranty terms')`;

                    await sql`INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
            (${svcId}, '30-Day Warranty', 'Free re-repair if issue returns', 0),
            (${svcId}, 'Expert Technicians', 'Trained for your specific appliance', 1),
            (${svcId}, 'Genuine Parts', 'Original or equivalent quality parts', 2)`;
                    break;

                default:
                    await sql`INSERT INTO service_processes (service_id, step_number, title, description) VALUES
            (${svcId}, 1, 'Assessment', 'Our expert evaluates your requirements'),
            (${svcId}, 2, 'Preparation', 'Prepare the work area and materials'),
            (${svcId}, 3, 'Service Execution', 'Professional service delivery'),
            (${svcId}, 4, 'Quality Check', 'Verify work meets our standards'),
            (${svcId}, 5, 'Handover', 'Explain work done and answer questions')`;

                    await sql`INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
            (${svcId}, '30-Day Warranty', 'Free re-service if issues arise', 0),
            (${svcId}, 'Verified Professionals', 'Background-checked experts', 1),
            (${svcId}, 'Transparent Pricing', 'No hidden charges', 2),
            (${svcId}, 'On-Time Guarantee', 'Punctual service delivery', 3)`;

                    await sql`INSERT INTO service_faqs (service_id, question, answer, sort_order) VALUES
            (${svcId}, 'What if I need to reschedule?', 'Free rescheduling up to 2 hours before the scheduled time.', 0),
            (${svcId}, 'Are professionals verified?', 'Yes, all undergo background checks and skill verification.', 1),
            (${svcId}, 'What payment methods are accepted?', 'UPI, cards, net banking, and cash accepted.', 2)`;
            }

            console.log('  ✓', svc.name, '(' + type + ')');
        }

        // Show summary
        console.log('\n📊 Summary:');
        const summary = await sql`
      SELECT 
        s.name,
        (SELECT COUNT(*) FROM service_processes WHERE service_id = s.id) as steps,
        (SELECT COUNT(*) FROM service_cover_promises WHERE service_id = s.id) as promises,
        (SELECT COUNT(*) FROM service_faqs WHERE service_id = s.id) as faqs
      FROM services s
      WHERE s.is_active = true
      ORDER BY s.name
    `;
        console.table(summary);

        console.log('\n✅ Successfully seeded', services.length, 'services with unique process data!');
        await sql.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

seed();
