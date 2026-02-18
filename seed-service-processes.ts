import sql from "./src/db";
import fs from "fs";
import path from "path";

async function seedServiceProcesses() {
  console.log("🔄 Starting service process seeding...\n");

  try {
    // First ensure the tables exist
    const migration012Path = path.join(
      __dirname,
      "migrations",
      "012_create_service_processes.sql"
    );
    if (fs.existsSync(migration012Path)) {
      const tablesSql = fs.readFileSync(migration012Path, "utf8");
      await sql.unsafe(tablesSql);
      console.log("✅ Tables verified/created");
    }

    // Get all active services
    const services = await sql`
      SELECT id, name FROM services WHERE is_active = true
    `;

    console.log(`📋 Found ${services.length} active services\n`);

    for (const service of services) {
      const name = service.name.toLowerCase();
      const svcId = service.id;

      // Clear existing data
      await sql`DELETE FROM service_processes WHERE service_id = ${svcId}`;
      await sql`DELETE FROM service_cover_promises WHERE service_id = ${svcId}`;
      await sql`DELETE FROM service_faqs WHERE service_id = ${svcId}`;
      await sql`DELETE FROM service_includes WHERE service_id = ${svcId}`;
      await sql`DELETE FROM service_excludes WHERE service_id = ${svcId}`;

      // Determine service type and add appropriate data
      if (
        name.includes("ac") ||
        name.includes("air condition") ||
        name.includes("cooling")
      ) {
        await seedACService(svcId);
      } else if (
        name.includes("clean") ||
        name.includes("cleaning") ||
        name.includes("wash")
      ) {
        await seedCleaningService(svcId);
      } else if (
        name.includes("plumb") ||
        name.includes("pipe") ||
        name.includes("leak")
      ) {
        await seedPlumbingService(svcId);
      } else if (
        name.includes("electric") ||
        name.includes("wiring") ||
        name.includes("switch")
      ) {
        await seedElectricalService(svcId);
      } else if (
        name.includes("pest") ||
        name.includes("cockroach") ||
        name.includes("termite")
      ) {
        await seedPestControlService(svcId);
      } else if (name.includes("paint") || name.includes("painting")) {
        await seedPaintingService(svcId);
      } else if (
        name.includes("carpenter") ||
        name.includes("furniture") ||
        name.includes("wood")
      ) {
        await seedCarpentryService(svcId);
      } else if (
        name.includes("salon") ||
        name.includes("beauty") ||
        name.includes("hair") ||
        name.includes("makeup")
      ) {
        await seedBeautyService(svcId);
      } else if (name.includes("massage") || name.includes("spa")) {
        await seedSpaService(svcId);
      } else {
        await seedGenericService(svcId);
      }

      console.log(`  ✓ ${service.name}`);
    }

    // Show summary
    const summary = await sql`
      SELECT 
        s.name as service_name,
        (SELECT COUNT(*) FROM service_processes WHERE service_id = s.id)::int as processes,
        (SELECT COUNT(*) FROM service_cover_promises WHERE service_id = s.id)::int as promises,
        (SELECT COUNT(*) FROM service_faqs WHERE service_id = s.id)::int as faqs,
        (SELECT COUNT(*) FROM service_includes WHERE service_id = s.id)::int as includes,
        (SELECT COUNT(*) FROM service_excludes WHERE service_id = s.id)::int as excludes
      FROM services s
      WHERE s.is_active = true
      ORDER BY s.name
    `;

    console.log("\n📊 Summary:");
    console.table(summary);

    console.log("\n✅ Service process seeding complete!");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

async function seedACService(svcId: string) {
  await sql`
    INSERT INTO service_processes (service_id, step_number, title, description, icon) VALUES
    (${svcId}, 1, 'Diagnosis', 'Technician inspects your AC unit and identifies issues', 'search'),
    (${svcId}, 2, 'Gas Level Check', 'Check refrigerant levels and pressure', 'gauge'),
    (${svcId}, 3, 'Component Repair', 'Repair or replace faulty parts', 'wrench'),
    (${svcId}, 4, 'Performance Test', 'Test cooling efficiency and airflow', 'thermometer'),
    (${svcId}, 5, 'Cleanup & Handover', 'Clean work area and explain repairs', 'sparkles')
  `;

  await sql`
    INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
    (${svcId}, '90-Day Repair Warranty', 'Free re-repair if same issue occurs', 0),
    (${svcId}, 'Genuine Parts Only', 'Original or high-quality spare parts', 1),
    (${svcId}, 'Certified Technicians', 'Brand-trained professionals', 2),
    (${svcId}, 'Transparent Pricing', 'No hidden charges', 3)
  `;

  await sql`
    INSERT INTO service_faqs (service_id, question, answer, sort_order) VALUES
    (${svcId}, 'How long does AC repair take?', 'Most repairs complete in 1-2 hours. Complex issues may take longer.', 0),
    (${svcId}, 'Do I need to provide parts?', 'No, technicians carry common parts. Special parts sourced with notice.', 1),
    (${svcId}, 'What if AC cannot be repaired?', 'We advise on replacement options with no service charge.', 2)
  `;

  await sql`
    INSERT INTO service_includes (service_id, item, description, sort_order) VALUES
    (${svcId}, 'Complete diagnosis', 'Full inspection of all AC components', 0),
    (${svcId}, 'Basic filter cleaning', 'Filter and exterior cleaning included', 1),
    (${svcId}, 'Minor gas top-up', 'Small gas refill if needed', 2)
  `;

  await sql`
    INSERT INTO service_excludes (service_id, item, description, sort_order) VALUES
    (${svcId}, 'Major spare parts', 'Compressor, PCB charged separately', 0),
    (${svcId}, 'Complete gas refill', 'Full refill costs extra', 1)
  `;
}

async function seedCleaningService(svcId: string) {
  await sql`
    INSERT INTO service_processes (service_id, step_number, title, description, icon) VALUES
    (${svcId}, 1, 'Area Assessment', 'Survey all areas and note special attention spots', 'clipboard'),
    (${svcId}, 2, 'Dusting & Sweeping', 'Dust surfaces and sweep all floors', 'wind'),
    (${svcId}, 3, 'Deep Cleaning', 'Scrub and clean stubborn stains', 'sparkles'),
    (${svcId}, 4, 'Mopping & Sanitizing', 'Mop floors with eco-friendly disinfectant', 'droplet'),
    (${svcId}, 5, 'Final Inspection', 'Walkthrough to ensure satisfaction', 'check')
  `;

  await sql`
    INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
    (${svcId}, 'Satisfaction Guarantee', 'Not happy? We re-clean for free', 0),
    (${svcId}, 'Eco-Friendly Products', 'Safe for kids and pets', 1),
    (${svcId}, 'Verified Staff', 'Background-checked professionals', 2),
    (${svcId}, 'On-Time Arrival', 'Within scheduled time window', 3)
  `;

  await sql`
    INSERT INTO service_faqs (service_id, question, answer, sort_order) VALUES
    (${svcId}, 'Do I need to provide cleaning supplies?', 'No, our team brings all equipment and supplies.', 0),
    (${svcId}, 'How long does cleaning take?', '2BHK takes 2-3 hours, larger homes 3-4 hours.', 1),
    (${svcId}, 'Are products safe for pets?', 'Yes, we use eco-friendly, pet-safe solutions.', 2)
  `;
}

async function seedPlumbingService(svcId: string) {
  await sql`
    INSERT INTO service_processes (service_id, step_number, title, description, icon) VALUES
    (${svcId}, 1, 'Problem Identification', 'Locate source of the plumbing issue', 'search'),
    (${svcId}, 2, 'Repair Work', 'Fix leaks, unclog drains, or repair pipes', 'wrench'),
    (${svcId}, 3, 'Pressure Testing', 'Test water pressure and check for leaks', 'gauge'),
    (${svcId}, 4, 'Cleanup', 'Clean work area and dispose of debris', 'sparkles')
  `;

  await sql`
    INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
    (${svcId}, '30-Day Warranty', 'Free re-service if issue recurs', 0),
    (${svcId}, 'No Fix No Fee', 'If we cannot fix it, you do not pay', 1),
    (${svcId}, 'Upfront Pricing', 'Know the cost before we start', 2)
  `;

  await sql`
    INSERT INTO service_faqs (service_id, question, answer, sort_order) VALUES
    (${svcId}, 'Do you handle major pipe repairs?', 'Yes, we handle all plumbing from minor fixes to major repairs.', 0),
    (${svcId}, 'What about hidden leaks?', 'We use detection equipment to find hidden leaks.', 1)
  `;
}

async function seedElectricalService(svcId: string) {
  await sql`
    INSERT INTO service_processes (service_id, step_number, title, description, icon) VALUES
    (${svcId}, 1, 'Safety First', 'Turn off power and ensure safe conditions', 'shield'),
    (${svcId}, 2, 'Fault Diagnosis', 'Identify electrical issues using testing equipment', 'search'),
    (${svcId}, 3, 'Repair/Installation', 'Fix wiring or install new fixtures', 'zap'),
    (${svcId}, 4, 'Safety Testing', 'Test all repaired items for safety', 'check'),
    (${svcId}, 5, 'Handover', 'Explain work done and safety tips', 'clipboard')
  `;

  await sql`
    INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
    (${svcId}, '30-Day Warranty', 'Free re-service for workmanship issues', 0),
    (${svcId}, 'Licensed Electricians', 'Certified professionals only', 1),
    (${svcId}, 'Safety Compliant', 'All work follows electrical codes', 2)
  `;

  await sql`
    INSERT INTO service_faqs (service_id, question, answer, sort_order) VALUES
    (${svcId}, 'Is it safe to do electrical work myself?', 'We strongly recommend professionals for safety.', 0),
    (${svcId}, 'Do you provide wiring materials?', 'Yes, we bring all necessary materials and cables.', 1)
  `;
}

async function seedPestControlService(svcId: string) {
  await sql`
    INSERT INTO service_processes (service_id, step_number, title, description, icon) VALUES
    (${svcId}, 1, 'Pest Inspection', 'Identify pest type and infestation areas', 'search'),
    (${svcId}, 2, 'Treatment Plan', 'Explain approach and safety measures', 'clipboard'),
    (${svcId}, 3, 'Chemical Application', 'Apply appropriate pesticides', 'spray'),
    (${svcId}, 4, 'Entry Sealing', 'Seal common pest entry points', 'shield'),
    (${svcId}, 5, 'Prevention Tips', 'Advice to prevent re-infestation', 'lightbulb')
  `;

  await sql`
    INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
    (${svcId}, '60-Day Warranty', 'Free re-treatment if pests return', 0),
    (${svcId}, 'Safe Chemicals', 'Child and pet-safe after drying', 1),
    (${svcId}, 'Government Licensed', 'Certified pest control experts', 2)
  `;

  await sql`
    INSERT INTO service_faqs (service_id, question, answer, sort_order) VALUES
    (${svcId}, 'Is it safe for children and pets?', 'Yes, after 2-3 hours of drying the area is completely safe.', 0),
    (${svcId}, 'How often should pest control be done?', 'We recommend every 3-6 months for prevention.', 1)
  `;
}

async function seedPaintingService(svcId: string) {
  await sql`
    INSERT INTO service_processes (service_id, step_number, title, description, icon) VALUES
    (${svcId}, 1, 'Surface Preparation', 'Clean and prep walls, fill cracks', 'tool'),
    (${svcId}, 2, 'Primer Application', 'Apply primer coat for better adhesion', 'paintbrush'),
    (${svcId}, 3, 'Color Application', 'Apply chosen paint colors', 'palette'),
    (${svcId}, 4, 'Final Coat', 'Apply finishing coat for smooth finish', 'sparkles'),
    (${svcId}, 5, 'Cleanup', 'Clean work area and remove coverings', 'check')
  `;

  await sql`
    INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
    (${svcId}, '1-Year Warranty', 'Coverage for peeling or bubbling', 0),
    (${svcId}, 'Premium Paints', 'Branded, long-lasting paints', 1),
    (${svcId}, 'Clean Finish', 'Professional, streak-free work', 2)
  `;
}

async function seedCarpentryService(svcId: string) {
  await sql`
    INSERT INTO service_processes (service_id, step_number, title, description, icon) VALUES
    (${svcId}, 1, 'Requirement Discussion', 'Understand your needs and measurements', 'clipboard'),
    (${svcId}, 2, 'Material Check', 'Inspect materials and hardware needed', 'search'),
    (${svcId}, 3, 'Woodwork', 'Cutting, joining, and assembly', 'tool'),
    (${svcId}, 4, 'Finishing', 'Polish, paint, or laminate as needed', 'sparkles'),
    (${svcId}, 5, 'Installation', 'Fit and secure the finished work', 'check')
  `;

  await sql`
    INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
    (${svcId}, '6-Month Warranty', 'Coverage for workmanship defects', 0),
    (${svcId}, 'Quality Materials', 'Premium wood and hardware', 1),
    (${svcId}, 'Custom Solutions', 'Made to your specifications', 2)
  `;
}

async function seedBeautyService(svcId: string) {
  await sql`
    INSERT INTO service_processes (service_id, step_number, title, description, icon) VALUES
    (${svcId}, 1, 'Consultation', 'Discuss your preferences and skin/hair type', 'chat'),
    (${svcId}, 2, 'Preparation', 'Cleanse and prep the treatment area', 'droplet'),
    (${svcId}, 3, 'Service', 'Professional beauty treatment', 'sparkles'),
    (${svcId}, 4, 'Finishing Touches', 'Style and perfect the look', 'star'),
    (${svcId}, 5, 'Aftercare Tips', 'Advice for maintaining results', 'lightbulb')
  `;

  await sql`
    INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
    (${svcId}, 'Premium Products', 'Salon-quality branded products', 0),
    (${svcId}, 'Trained Professionals', 'Certified beauty experts', 1),
    (${svcId}, 'Hygiene First', 'Sanitized tools, fresh products', 2),
    (${svcId}, 'Satisfaction Guarantee', 'Not happy? We make it right', 3)
  `;

  await sql`
    INSERT INTO service_faqs (service_id, question, answer, sort_order) VALUES
    (${svcId}, 'What products do you use?', 'We use premium salon brands suitable for all skin types.', 0),
    (${svcId}, 'Can I request a specific beautician?', 'Yes, you can request your preferred professional.', 1)
  `;
}

async function seedSpaService(svcId: string) {
  await sql`
    INSERT INTO service_processes (service_id, step_number, title, description, icon) VALUES
    (${svcId}, 1, 'Consultation', 'Discuss preferences and any health concerns', 'chat'),
    (${svcId}, 2, 'Setup', 'Prepare massage table, oils, and ambiance', 'sparkles'),
    (${svcId}, 3, 'Therapy Session', 'Professional massage/spa treatment', 'heart'),
    (${svcId}, 4, 'Relaxation', 'Post-treatment relaxation time', 'moon'),
    (${svcId}, 5, 'Aftercare', 'Hydration and care tips', 'droplet')
  `;

  await sql`
    INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
    (${svcId}, 'Certified Therapists', 'Trained and experienced professionals', 0),
    (${svcId}, 'Premium Products', 'Organic oils and lotions', 1),
    (${svcId}, 'Complete Privacy', 'Professional and discreet service', 2)
  `;
}

async function seedGenericService(svcId: string) {
  await sql`
    INSERT INTO service_processes (service_id, step_number, title, description, icon) VALUES
    (${svcId}, 1, 'Assessment', 'Expert assesses the job requirements', 'clipboard'),
    (${svcId}, 2, 'Preparation', 'Prepare work area and materials', 'tool'),
    (${svcId}, 3, 'Service Execution', 'Professional service delivery', 'wrench'),
    (${svcId}, 4, 'Quality Check', 'Verify work meets standards', 'check'),
    (${svcId}, 5, 'Handover', 'Explain work done and answer questions', 'chat')
  `;

  await sql`
    INSERT INTO service_cover_promises (service_id, title, description, sort_order) VALUES
    (${svcId}, '30-Day Warranty', 'Free re-service if issues arise', 0),
    (${svcId}, 'Verified Professionals', 'Background-checked experts', 1),
    (${svcId}, 'Transparent Pricing', 'No hidden charges', 2),
    (${svcId}, 'On-Time Guarantee', 'Punctual service delivery', 3)
  `;

  await sql`
    INSERT INTO service_faqs (service_id, question, answer, sort_order) VALUES
    (${svcId}, 'What if I need to reschedule?', 'Reschedule free up to 2 hours before the slot.', 0),
    (${svcId}, 'Are professionals verified?', 'Yes, all undergo background checks and training.', 1),
    (${svcId}, 'What payment methods accepted?', 'UPI, cards, net banking, and cash.', 2)
  `;
}

seedServiceProcesses();
