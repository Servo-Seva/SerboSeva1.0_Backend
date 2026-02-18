require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function fixHomeOffer() {
    try {
        console.log('Fixing Home & Professional Services offer...\n');

        // Get all offers
        const offers = await sql`
            SELECT id, title, subtitle FROM offers WHERE is_active = true ORDER BY display_order
        `;

        console.log('All offers:');
        offers.forEach(o => console.log(`  - ${o.title}: ${o.subtitle}`));

        // Get the "Home & Professional Services - Free Consultation" offer
        const homeOffer = await sql`
            SELECT id, title, subtitle 
            FROM offers 
            WHERE title ILIKE '%home%' AND subtitle ILIKE '%consultation%'
            LIMIT 1
        `;

        if (homeOffer.length === 0) {
            console.log('\n"Home & Professional Services - Free Consultation" offer not found');

            // Try to find it differently
            const altOffer = await sql`
                SELECT id, title, subtitle 
                FROM offers 
                WHERE subtitle ILIKE '%consultation%'
                LIMIT 1
            `;

            if (altOffer.length > 0) {
                console.log('\nFound alternate offer:', altOffer[0].title, '-', altOffer[0].subtitle);
            }

            await sql.end();
            return;
        }

        console.log('\nFound offer:', homeOffer[0].title, '-', homeOffer[0].subtitle);
        const offerId = homeOffer[0].id;

        // Get subcategory for professional services
        const subcategory = await sql`
            SELECT id FROM subcategories LIMIT 1
        `;
        const subcategoryId = subcategory[0].id;

        // Create free consultation services
        const consultationServices = [
            {
                name: 'Home Cleaning Consultation',
                description: 'Free consultation to assess your home cleaning needs. Our expert will visit, evaluate the space, and provide a customized cleaning plan with an accurate quote.',
                duration: 30,
                thumbnail: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&h=400&fit=crop'
            },
            {
                name: 'Interior Design Consultation',
                description: 'Free consultation with our interior design expert. Get professional advice on space planning, color schemes, furniture arrangement, and home décor ideas.',
                duration: 45,
                thumbnail: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&h=400&fit=crop'
            },
            {
                name: 'Pest Control Consultation',
                description: 'Free pest assessment and consultation. Our specialist will identify pest problems, assess infestation levels, and recommend the best treatment plan.',
                duration: 30,
                thumbnail: 'https://images.unsplash.com/photo-1632935191652-c9c312902621?w=600&h=400&fit=crop'
            },
            {
                name: 'Home Renovation Consultation',
                description: 'Free consultation for home renovation projects. Discuss your ideas with our experts and get professional guidance on feasibility, timeline, and budget.',
                duration: 60,
                thumbnail: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&h=400&fit=crop'
            },
            {
                name: 'Plumbing Assessment',
                description: 'Free plumbing consultation and assessment. Our certified plumber will inspect your plumbing system and provide recommendations for any needed repairs.',
                duration: 30,
                thumbnail: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=600&h=400&fit=crop'
            },
            {
                name: 'Electrical Safety Consultation',
                description: 'Free electrical safety assessment for your home. Our licensed electrician will check wiring, outlets, and electrical panels for potential issues.',
                duration: 45,
                thumbnail: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&h=400&fit=crop'
            }
        ];

        // First, remove old links
        await sql`DELETE FROM offer_services WHERE offer_id = ${offerId}`;

        // Insert consultation services and link them
        for (const service of consultationServices) {
            const inserted = await sql`
                INSERT INTO services (name, description, price, base_price, subcategory_id, duration_minutes, thumbnail_url, is_active)
                VALUES (
                    ${service.name},
                    ${service.description},
                    0,
                    0,
                    ${subcategoryId},
                    ${service.duration},
                    ${service.thumbnail},
                    true
                )
                ON CONFLICT (name) DO UPDATE SET 
                    price = 0, 
                    base_price = 0, 
                    description = EXCLUDED.description,
                    thumbnail_url = EXCLUDED.thumbnail_url
                RETURNING id
            `;

            if (inserted.length > 0) {
                await sql`
                    INSERT INTO offer_services (offer_id, service_id, discount_percent)
                    VALUES (${offerId}, ${inserted[0].id}, 100)
                    ON CONFLICT (offer_id, service_id) DO UPDATE SET discount_percent = 100
                `;
                console.log(`✅ Added: ${service.name}`);
            }
        }

        console.log('\n✅ Done!');

        // Verify
        const linked = await sql`
            SELECT s.name, os.discount_percent
            FROM offer_services os
            JOIN services s ON os.service_id = s.id
            WHERE os.offer_id = ${offerId}
            ORDER BY s.name
        `;

        console.log('\nServices linked to "Home & Professional Services - Free Consultation":');
        linked.forEach(l => {
            console.log(`  - ${l.name} (FREE)`);
        });

        await sql.end();
    } catch (err) {
        console.error('Error:', err.message);
        await sql.end();
    }
}

fixHomeOffer();
