require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function addFreeConsultationServices() {
    try {
        console.log('Adding free consultation services for Home & Professional Services offer...\n');

        // Get the Home & Professional Services offer
        const homeOffer = await sql`
            SELECT id, title, subtitle, category_id 
            FROM offers 
            WHERE title ILIKE '%home%professional%' OR title ILIKE '%professional%service%'
            LIMIT 1
        `;

        if (homeOffer.length === 0) {
            console.log('Home & Professional Services offer not found');
            await sql.end();
            return;
        }

        console.log('Found offer:', homeOffer[0].title);
        const offerId = homeOffer[0].id;

        // Get subcategory for professional services or cleaning
        const subcategory = await sql`
            SELECT id FROM subcategories 
            WHERE LOWER(name) LIKE '%clean%' OR LOWER(name) LIKE '%home%'
            LIMIT 1
        `;

        let subcategoryId = subcategory.length > 0 ? subcategory[0].id : null;

        // If no subcategory found, get any active one
        if (!subcategoryId) {
            const anySub = await sql`SELECT id FROM subcategories LIMIT 1`;
            subcategoryId = anySub.length > 0 ? anySub[0].id : null;
        }

        if (!subcategoryId) {
            console.log('No subcategory found');
            await sql.end();
            return;
        }

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

        // Insert consultation services
        for (const service of consultationServices) {
            // First try to insert or update the service
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
                // Link to the offer with 100% discount (free)
                await sql`
                    INSERT INTO offer_services (offer_id, service_id, discount_percent)
                    VALUES (${offerId}, ${inserted[0].id}, 100)
                    ON CONFLICT (offer_id, service_id) DO UPDATE SET discount_percent = 100
                `;
                console.log(`✅ Added: ${service.name}`);
            }
        }

        // Remove any old links that are not consultation services
        await sql`
            DELETE FROM offer_services 
            WHERE offer_id = ${offerId}
              AND service_id NOT IN (
                SELECT id FROM services 
                WHERE LOWER(name) LIKE '%consultation%' 
                   OR LOWER(name) LIKE '%assessment%'
              )
        `;

        console.log('\n✅ Free consultation services linked to Home & Professional Services offer!');

        // Verify
        const linked = await sql`
            SELECT s.name, os.discount_percent
            FROM offer_services os
            JOIN services s ON os.service_id = s.id
            WHERE os.offer_id = ${offerId}
            ORDER BY s.name
        `;

        console.log('\nServices now linked to this offer:');
        linked.forEach(l => {
            console.log(`  - ${l.name} (${l.discount_percent}% off = FREE)`);
        });

        await sql.end();
    } catch (err) {
        console.error('Error:', err.message);
        console.error(err);
        await sql.end();
    }
}

addFreeConsultationServices();
