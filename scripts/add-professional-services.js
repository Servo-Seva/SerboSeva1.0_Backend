require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function addProfessionalServices() {
    try {
        console.log('Adding Professional Digital Services...\n');

        // Get or create a "Digital Services" subcategory
        let subcategoryId;

        // First check if there's a Professional Services category
        let category = await sql`
            SELECT id FROM categories 
            WHERE LOWER(name) LIKE '%professional%' OR LOWER(name) LIKE '%digital%'
            LIMIT 1
        `;

        if (category.length === 0) {
            // Create Professional Services category
            const newCat = await sql`
                INSERT INTO categories (name, description, image_url)
                VALUES (
                    'Professional Services',
                    'Digital and professional services for businesses and individuals',
                    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop'
                )
                ON CONFLICT DO NOTHING
                RETURNING id
            `;
            if (newCat.length > 0) {
                category = newCat;
                console.log('✅ Created Professional Services category');
            } else {
                category = await sql`SELECT id FROM categories LIMIT 1`;
            }
        }

        const categoryId = category[0].id;

        // Create Digital Services subcategory
        const subcat = await sql`
            INSERT INTO subcategories (name, category_id, icon)
            VALUES ('Digital Services', ${categoryId}, '💻')
            ON CONFLICT DO NOTHING
            RETURNING id
        `;

        if (subcat.length > 0) {
            subcategoryId = subcat[0].id;
            console.log('✅ Created Digital Services subcategory');
        } else {
            const existingSub = await sql`
                SELECT id FROM subcategories 
                WHERE LOWER(name) LIKE '%digital%' OR category_id = ${categoryId}
                LIMIT 1
            `;
            subcategoryId = existingSub.length > 0 ? existingSub[0].id : null;
        }

        if (!subcategoryId) {
            const anySub = await sql`SELECT id FROM subcategories LIMIT 1`;
            subcategoryId = anySub[0].id;
        }

        // Get the Professional Services offer
        const professionalOffer = await sql`
            SELECT id, title FROM offers 
            WHERE title ILIKE '%professional%' AND subtitle ILIKE '%affordable%'
            LIMIT 1
        `;

        if (professionalOffer.length === 0) {
            console.log('Professional Services offer not found');
            await sql.end();
            return;
        }

        console.log('Found offer:', professionalOffer[0].title);
        const offerId = professionalOffer[0].id;

        // Clear old links for this offer
        await sql`DELETE FROM offer_services WHERE offer_id = ${offerId}`;

        // Define professional services with prices
        const services = [
            // 🌐 WEBSITE SERVICES
            {
                name: 'Basic Website',
                description: 'Professional single-page or multi-page basic website with responsive design. Perfect for personal portfolios, small businesses, or landing pages. Includes hosting setup guidance.',
                price: 4999,
                duration: 7 * 24 * 60, // 7 days in minutes
                thumbnail: 'https://images.unsplash.com/photo-1547658719-da2b51169166?w=600&h=400&fit=crop',
                category: 'Website'
            },
            {
                name: 'Business Website',
                description: 'Complete business website with multiple pages, contact forms, Google Maps integration, and SEO optimization. Includes admin panel for easy content management.',
                price: 14999,
                duration: 14 * 24 * 60,
                thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop',
                category: 'Website'
            },
            {
                name: 'School Website (Dynamic)',
                description: 'Dynamic school management website with student portal, notice board, gallery, events calendar, and admin dashboard. Fully customizable for educational institutions.',
                price: 24999,
                duration: 21 * 24 * 60,
                thumbnail: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&h=400&fit=crop',
                category: 'Website'
            },
            {
                name: 'E-Commerce Website',
                description: 'Full-featured online store with product catalog, shopping cart, payment gateway integration, order management, and customer accounts. Ready to sell online.',
                price: 29999,
                duration: 21 * 24 * 60,
                thumbnail: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=400&fit=crop',
                category: 'Website'
            },
            {
                name: 'Portfolio Website',
                description: 'Stunning portfolio website to showcase your work. Perfect for artists, designers, photographers, and freelancers. Modern design with smooth animations.',
                price: 7999,
                duration: 7 * 24 * 60,
                thumbnail: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&h=400&fit=crop',
                category: 'Website'
            },

            // 📝 CONTENT SERVICES
            {
                name: 'Website Content Writing',
                description: 'Professional content writing for your website pages. SEO-optimized, engaging copy that converts visitors into customers. Includes up to 5 pages.',
                price: 2999,
                duration: 3 * 24 * 60,
                thumbnail: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&h=400&fit=crop',
                category: 'Content'
            },
            {
                name: 'Blog Writing',
                description: 'High-quality blog articles written by expert content writers. SEO-friendly, researched content to boost your website traffic. Per article pricing.',
                price: 999,
                duration: 2 * 24 * 60,
                thumbnail: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&h=400&fit=crop',
                category: 'Content'
            },
            {
                name: 'Product Description Writing',
                description: 'Compelling product descriptions that sell. Perfect for e-commerce stores. Includes 10 product descriptions with SEO keywords.',
                price: 1999,
                duration: 2 * 24 * 60,
                thumbnail: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=600&h=400&fit=crop',
                category: 'Content'
            },

            // 🎬 MEDIA SERVICES
            {
                name: 'Video Editing (Reels/YouTube)',
                description: 'Professional video editing for Instagram Reels, YouTube videos, or promotional content. Includes color grading, transitions, music, and captions.',
                price: 1499,
                duration: 2 * 24 * 60,
                thumbnail: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&h=400&fit=crop',
                category: 'Media'
            },
            {
                name: 'Photo Editing',
                description: 'Professional photo editing and retouching. Includes color correction, background removal, enhancement, and batch editing. Up to 20 photos.',
                price: 799,
                duration: 1 * 24 * 60,
                thumbnail: 'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=600&h=400&fit=crop',
                category: 'Media'
            },
            {
                name: 'Thumbnail Design',
                description: 'Eye-catching YouTube thumbnail designs that increase click-through rates. Custom graphics, bold text, and engaging visuals. Pack of 5 thumbnails.',
                price: 499,
                duration: 1 * 24 * 60,
                thumbnail: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=600&h=400&fit=crop',
                category: 'Media'
            },

            // 📢 MARKETING SERVICES
            {
                name: 'Social Media Post Design',
                description: 'Professional social media graphics for Instagram, Facebook, and LinkedIn. Branded templates that maintain consistency. Pack of 10 posts.',
                price: 1499,
                duration: 3 * 24 * 60,
                thumbnail: 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=600&h=400&fit=crop',
                category: 'Marketing'
            },
            {
                name: 'Basic SEO Setup',
                description: 'Essential SEO setup for your website. Includes keyword research, meta tags, sitemap, Google Search Console setup, and basic on-page optimization.',
                price: 3999,
                duration: 5 * 24 * 60,
                thumbnail: 'https://images.unsplash.com/photo-1562577309-4932fdd64cd1?w=600&h=400&fit=crop',
                category: 'Marketing'
            },
            {
                name: 'Logo Design',
                description: 'Professional logo design for your brand. Includes 3 initial concepts, revisions, and final files in all formats (PNG, SVG, PDF).',
                price: 2499,
                duration: 3 * 24 * 60,
                thumbnail: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600&h=400&fit=crop',
                category: 'Marketing'
            },
            {
                name: 'Business Card Design',
                description: 'Professional business card design that makes an impression. Includes front and back design, print-ready files, and unlimited revisions.',
                price: 499,
                duration: 1 * 24 * 60,
                thumbnail: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&h=400&fit=crop',
                category: 'Marketing'
            }
        ];

        // Insert services and link to offer
        for (const service of services) {
            const inserted = await sql`
                INSERT INTO services (name, description, price, base_price, subcategory_id, duration_minutes, thumbnail_url, is_active)
                VALUES (
                    ${service.name},
                    ${service.description},
                    ${service.price},
                    ${Math.round(service.price * 1.2)},
                    ${subcategoryId},
                    ${service.duration},
                    ${service.thumbnail},
                    true
                )
                ON CONFLICT (name) DO UPDATE SET 
                    price = ${service.price},
                    base_price = ${Math.round(service.price * 1.2)},
                    description = EXCLUDED.description,
                    thumbnail_url = EXCLUDED.thumbnail_url
                RETURNING id
            `;

            if (inserted.length > 0) {
                // Link to offer with 15% introductory discount
                await sql`
                    INSERT INTO offer_services (offer_id, service_id, discount_percent)
                    VALUES (${offerId}, ${inserted[0].id}, 15)
                    ON CONFLICT (offer_id, service_id) DO UPDATE SET discount_percent = 15
                `;
                console.log(`✅ ${service.category}: ${service.name} - ₹${service.price}`);
            }
        }

        console.log('\n✅ All professional digital services added!');

        // Verify
        const linked = await sql`
            SELECT s.name, s.price, os.discount_percent,
                   ROUND(s.price * (1 - os.discount_percent / 100.0)) as discounted_price
            FROM offer_services os
            JOIN services s ON os.service_id = s.id
            WHERE os.offer_id = ${offerId}
            ORDER BY s.name
        `;

        console.log('\n📦 Professional Services Offer:');
        console.log('================================');
        linked.forEach(l => {
            console.log(`  - ${l.name}: ₹${l.discounted_price} (was ₹${l.price}, ${l.discount_percent}% off)`);
        });

        await sql.end();
    } catch (err) {
        console.error('Error:', err.message);
        console.error(err);
        await sql.end();
    }
}

addProfessionalServices();
