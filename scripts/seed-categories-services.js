// Seed script for 10 categories with 6+ services each
try { require('dotenv').config(); } catch (e) { }
const postgres = require('postgres');

async function run() {
    const sqlUrl = process.env.DATABASE_URL;
    if (!sqlUrl) {
        console.error('DATABASE_URL not set');
        process.exit(1);
    }

    const client = postgres(sqlUrl, { ssl: 'require' });

    // 10 categories with descriptions
    const categories = [
        { name: 'Cleaning Services', description: 'Professional home and office cleaning' },
        { name: 'Electrical Work', description: 'Expert electrician services for repairs and installation' },
        { name: 'Plumbing Services', description: 'Professional plumbing repair and maintenance' },
        { name: 'AC & HVAC', description: 'Air conditioning and heating system services' },
        { name: 'Pest Control', description: 'Professional pest control and fumigation services' },
        { name: 'Beauty & Salon', description: 'Hair, makeup, and beauty services' },
        { name: 'Home Repair', description: 'General home maintenance and repairs' },
        { name: 'Furniture & Upholstery', description: 'Furniture repair, restoration, and upholstery services' },
        { name: 'Appliance Repair', description: 'Repair services for household appliances' },
        { name: 'Painting Services', description: 'Interior and exterior painting services' },
    ];

    // Services for each category (7 services each)
    const categoryServices = {
        'Cleaning Services': [
            { name: 'Full Home Deep Cleaning', description: 'Complete home cleaning including all rooms with sanitization', price: 2499, avg_rating: 4.8, reviews_count: 2341, duration_minutes: 240 },
            { name: 'Bathroom Cleaning', description: 'Deep cleaning of bathrooms with tile and fixture sanitization', price: 599, avg_rating: 4.7, reviews_count: 1823, duration_minutes: 90 },
            { name: 'Kitchen Cleaning', description: 'Thorough kitchen cleaning including appliances and cabinets', price: 799, avg_rating: 4.9, reviews_count: 1456, duration_minutes: 120 },
            { name: 'Window & Glass Cleaning', description: 'Professional window and glass cleaning service', price: 499, avg_rating: 4.6, reviews_count: 932, duration_minutes: 60 },
            { name: 'Post-Construction Cleaning', description: 'Specialized cleaning after construction or renovation', price: 3999, avg_rating: 4.7, reviews_count: 456, duration_minutes: 300 },
            { name: 'Carpet Cleaning', description: 'Deep carpet cleaning with steam treatment', price: 1299, avg_rating: 4.8, reviews_count: 1200, duration_minutes: 150 },
            { name: 'Office Cleaning', description: 'Daily or weekly office space cleaning services', price: 1999, avg_rating: 4.7, reviews_count: 800, duration_minutes: 180 },
        ],
        'Electrical Work': [
            { name: 'Electrical Repair & Troubleshooting', description: 'Fix electrical issues and troubleshoot problems', price: 499, avg_rating: 4.8, reviews_count: 1523, duration_minutes: 45 },
            { name: 'Light Installation', description: 'Install ceiling fans, lights, and decorative lighting', price: 799, avg_rating: 4.7, reviews_count: 1234, duration_minutes: 90 },
            { name: 'Switch & Socket Installation', description: 'Install new switches, outlets, and electrical points', price: 349, avg_rating: 4.6, reviews_count: 876, duration_minutes: 60 },
            { name: 'Circuit Breaker Service', description: 'Repair and replacement of circuit breakers', price: 1299, avg_rating: 4.9, reviews_count: 567, duration_minutes: 120 },
            { name: 'Electrical Wiring', description: 'Complete electrical rewiring for homes and offices', price: 4999, avg_rating: 4.8, reviews_count: 345, duration_minutes: 480 },
            { name: 'Appliance Installation', description: 'Professional installation of electrical appliances', price: 899, avg_rating: 4.7, reviews_count: 654, duration_minutes: 90 },
            { name: 'Emergency Electrical Service', description: '24/7 emergency electrical repair and assistance', price: 1599, avg_rating: 4.9, reviews_count: 789, duration_minutes: 60 },
        ],
        'Plumbing Services': [
            { name: 'Leak Repair & Detection', description: 'Find and fix water leaks in pipes and fixtures', price: 599, avg_rating: 4.8, reviews_count: 1876, duration_minutes: 60 },
            { name: 'Tap & Valve Replacement', description: 'Replace taps, valves, and water fixtures', price: 449, avg_rating: 4.7, reviews_count: 1345, duration_minutes: 45 },
            { name: 'Drainage Cleaning', description: 'Clear blocked drains and pipes', price: 699, avg_rating: 4.6, reviews_count: 1623, duration_minutes: 90 },
            { name: 'Toilet Installation & Repair', description: 'Install or repair toilets and flush systems', price: 799, avg_rating: 4.8, reviews_count: 987, duration_minutes: 75 },
            { name: 'Geyser Installation & Repair', description: 'Install, repair, and service water geysers', price: 1299, avg_rating: 4.8, reviews_count: 654, duration_minutes: 120 },
            { name: 'Full Bathroom Plumbing', description: 'Complete bathroom plumbing setup and installation', price: 3999, avg_rating: 4.7, reviews_count: 432, duration_minutes: 240 },
            { name: 'Sump Pump Installation', description: 'Install and maintain sump pump systems', price: 1999, avg_rating: 4.8, reviews_count: 345, duration_minutes: 150 },
        ],
        'AC & HVAC': [
            { name: 'AC Cleaning & Maintenance', description: 'Regular cleaning and servicing of air conditioners', price: 499, avg_rating: 4.9, reviews_count: 2145, duration_minutes: 90 },
            { name: 'Gas Refill & Recharge', description: 'Refrigerant refill and AC recharge service', price: 799, avg_rating: 4.8, reviews_count: 1567, duration_minutes: 60 },
            { name: 'AC Installation', description: 'Professional installation of new AC units', price: 2999, avg_rating: 4.8, reviews_count: 876, duration_minutes: 180 },
            { name: 'AC Repair & Troubleshooting', description: 'Repair and fix AC mechanical and electrical issues', price: 899, avg_rating: 4.7, reviews_count: 1234, duration_minutes: 90 },
            { name: 'Compressor Service', description: 'Repair and replacement of AC compressors', price: 1999, avg_rating: 4.8, reviews_count: 567, duration_minutes: 120 },
            { name: 'Ductwork Installation', description: 'Install and repair AC ductwork', price: 2499, avg_rating: 4.7, reviews_count: 345, duration_minutes: 240 },
            { name: 'Split AC Uninstall', description: 'Professional AC uninstallation service', price: 649, avg_rating: 4.6, reviews_count: 432, duration_minutes: 75 },
        ],
        'Pest Control': [
            { name: 'General Pest Treatment', description: 'Treatment for general household pests', price: 699, avg_rating: 4.8, reviews_count: 1456, duration_minutes: 90 },
            { name: 'Termite Control', description: 'Specialized termite treatment and prevention', price: 1299, avg_rating: 4.9, reviews_count: 876, duration_minutes: 120 },
            { name: 'Mosquito Fogging', description: 'Fogging service for mosquito and insect control', price: 499, avg_rating: 4.7, reviews_count: 1234, duration_minutes: 60 },
            { name: 'Rodent Control', description: 'Rat and rodent elimination service', price: 899, avg_rating: 4.8, reviews_count: 654, duration_minutes: 90 },
            { name: 'Bed Bug Treatment', description: 'Complete bed bug elimination service', price: 1599, avg_rating: 4.8, reviews_count: 567, duration_minutes: 120 },
            { name: 'Wood Borer Treatment', description: 'Treatment for wood boring insects', price: 1199, avg_rating: 4.7, reviews_count: 345, duration_minutes: 100 },
            { name: 'Annual Maintenance Plan', description: 'Monthly pest control and prevention service', price: 2999, avg_rating: 4.9, reviews_count: 234, duration_minutes: 60 },
        ],
        'Beauty & Salon': [
            { name: 'Hair Cutting & Styling', description: 'Professional hair cut and styling service', price: 299, avg_rating: 4.7, reviews_count: 3456, duration_minutes: 45 },
            { name: 'Hair Coloring', description: 'Hair coloring with premium products', price: 899, avg_rating: 4.8, reviews_count: 2123, duration_minutes: 120 },
            { name: 'Facial & Skin Care', description: 'Professional facial treatment with skincare', price: 599, avg_rating: 4.8, reviews_count: 1876, duration_minutes: 60 },
            { name: 'Makeup & Bridal Makeup', description: 'Professional makeup for events and weddings', price: 1299, avg_rating: 4.9, reviews_count: 1234, duration_minutes: 90 },
            { name: 'Manicure & Pedicure', description: 'Nail care and grooming service', price: 399, avg_rating: 4.7, reviews_count: 2345, duration_minutes: 60 },
            { name: 'Hair Spa & Treatment', description: 'Deep conditioning and hair spa treatment', price: 649, avg_rating: 4.8, reviews_count: 1567, duration_minutes: 75 },
            { name: 'Threading & Waxing', description: 'Hair removal service using threading and waxing', price: 249, avg_rating: 4.6, reviews_count: 2987, duration_minutes: 30 },
        ],
        'Home Repair': [
            { name: 'Door & Window Repair', description: 'Repair and fix doors and windows', price: 399, avg_rating: 4.7, reviews_count: 1234, duration_minutes: 60 },
            { name: 'Wall Repair & Patching', description: 'Repair holes, cracks in walls', price: 299, avg_rating: 4.6, reviews_count: 876, duration_minutes: 45 },
            { name: 'Tile & Flooring Repair', description: 'Repair broken tiles and flooring', price: 599, avg_rating: 4.8, reviews_count: 654, duration_minutes: 90 },
            { name: 'Furniture Assembly', description: 'Assemble and install furniture', price: 449, avg_rating: 4.7, reviews_count: 1567, duration_minutes: 75 },
            { name: 'Lock & Key Installation', description: 'Install and repair locks and keys', price: 349, avg_rating: 4.6, reviews_count: 987, duration_minutes: 45 },
            { name: 'Cabinet & Shelf Installation', description: 'Install cabinets and shelves', price: 599, avg_rating: 4.8, reviews_count: 765, duration_minutes: 90 },
            { name: 'General Handyman Service', description: 'Multiple minor repairs and fixes', price: 799, avg_rating: 4.7, reviews_count: 1345, duration_minutes: 120 },
        ],
        'Furniture & Upholstery': [
            { name: 'Sofa Reupholstery', description: 'Complete sofa reupholstery and restoration', price: 4999, avg_rating: 4.9, reviews_count: 567, duration_minutes: 300 },
            { name: 'Furniture Polish & Restoration', description: 'Polish and restore wooden furniture', price: 1299, avg_rating: 4.8, reviews_count: 432, duration_minutes: 120 },
            { name: 'Cushion Replacement', description: 'Replace cushions in sofas and chairs', price: 1999, avg_rating: 4.8, reviews_count: 345, duration_minutes: 150 },
            { name: 'Chair Upholstery', description: 'Reupholster chairs and benches', price: 2499, avg_rating: 4.7, reviews_count: 234, duration_minutes: 180 },
            { name: 'Wooden Furniture Repair', description: 'Repair and fix wooden furniture issues', price: 899, avg_rating: 4.7, reviews_count: 345, duration_minutes: 90 },
            { name: 'Carpet & Rug Repair', description: 'Repair and restoration of carpets and rugs', price: 1599, avg_rating: 4.8, reviews_count: 267, duration_minutes: 120 },
            { name: 'Furniture Moving & Shifting', description: 'Professional furniture movement and relocation', price: 1999, avg_rating: 4.6, reviews_count: 456, duration_minutes: 180 },
        ],
        'Appliance Repair': [
            { name: 'Washing Machine Repair', description: 'Repair and service washing machines', price: 599, avg_rating: 4.8, reviews_count: 1876, duration_minutes: 90 },
            { name: 'Refrigerator Service', description: 'Repair and servicing of refrigerators', price: 799, avg_rating: 4.7, reviews_count: 1567, duration_minutes: 90 },
            { name: 'Microwave Repair', description: 'Repair of microwave ovens', price: 449, avg_rating: 4.6, reviews_count: 876, duration_minutes: 60 },
            { name: 'Dishwasher Repair', description: 'Repair and maintenance of dishwashers', price: 549, avg_rating: 4.7, reviews_count: 654, duration_minutes: 75 },
            { name: 'Electric Cooker & Heater Repair', description: 'Repair electric cooking and heating appliances', price: 399, avg_rating: 4.6, reviews_count: 765, duration_minutes: 60 },
            { name: 'Television & Home Theater Repair', description: 'Repair of TV and audio systems', price: 699, avg_rating: 4.8, reviews_count: 567, duration_minutes: 90 },
            { name: 'Water Purifier Service', description: 'Maintenance and repair of water purifiers', price: 349, avg_rating: 4.7, reviews_count: 987, duration_minutes: 45 },
        ],
        'Painting Services': [
            { name: 'Interior Wall Painting', description: 'Professional interior painting service', price: 1299, avg_rating: 4.8, reviews_count: 1456, duration_minutes: 180 },
            { name: 'Exterior House Painting', description: 'Full exterior painting of houses', price: 3999, avg_rating: 4.9, reviews_count: 876, duration_minutes: 480 },
            { name: 'Ceiling Painting', description: 'Professional ceiling painting and texture', price: 899, avg_rating: 4.7, reviews_count: 654, duration_minutes: 120 },
            { name: 'Door & Window Frame Painting', description: 'Painting of doors and window frames', price: 499, avg_rating: 4.6, reviews_count: 567, duration_minutes: 90 },
            { name: 'Furniture Painting & Refinishing', description: 'Paint and refinish furniture pieces', price: 1599, avg_rating: 4.8, reviews_count: 345, duration_minutes: 150 },
            { name: 'Waterproofing & Sealant', description: 'Apply waterproofing and protective sealants', price: 2499, avg_rating: 4.8, reviews_count: 234, duration_minutes: 240 },
            { name: 'Texture & Wall Design', description: 'Create textured walls and design patterns', price: 1999, avg_rating: 4.9, reviews_count: 432, duration_minutes: 180 },
        ],
    };

    console.log('Starting category and service seeding...');

    const createdCats = {};

    // Create categories
    for (const c of categories) {
        try {
            const rows = await client`
                insert into categories (name, description) values (${c.name}, ${c.description})
                on conflict (name) do update set description = excluded.description
                returning id, name
            `;
            if (rows && rows.length > 0) {
                createdCats[rows[0].name] = rows[0].id;
                console.log(`✓ Created category: ${rows[0].name}`);
            }
        } catch (err) {
            console.error(`✗ Error creating category ${c.name}:`, err.message);
        }
    }

    console.log(`\nCreated ${Object.keys(createdCats).length} categories`);

    // Create services for each category
    let totalServicesCreated = 0;
    for (const [categoryName, services] of Object.entries(categoryServices)) {
        const categoryId = createdCats[categoryName];
        if (!categoryId) {
            console.log(`⚠ Skipping services for ${categoryName}: category not found`);
            continue;
        }

        for (const s of services) {
            try {
                const rows = await client`
                    insert into services (name, description, price, avg_rating, reviews_count, duration_minutes, currency)
                    values (${s.name}, ${s.description}, ${s.price}, ${s.avg_rating}, ${s.reviews_count}, ${s.duration_minutes}, 'INR')
                    on conflict (name) do update set price = excluded.price, avg_rating = excluded.avg_rating, reviews_count = excluded.reviews_count
                    returning id, name
                `;
                if (rows && rows.length > 0) {
                    const svcId = rows[0].id;
                    // Map service to category
                    await client`
                        insert into category_services (category_id, service_id) values (${categoryId}, ${svcId})
                        on conflict do nothing
                    `;
                    totalServicesCreated++;
                }
            } catch (err) {
                console.error(`✗ Error creating service ${s.name}:`, err.message);
            }
        }
        console.log(`✓ Added ${services.length} services to ${categoryName}`);
    }

    console.log(`\n✓ Successfully created ${totalServicesCreated} services`);
    console.log('Seeding complete!');

    await client.end();
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
