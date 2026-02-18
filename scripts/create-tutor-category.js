const postgres = require('postgres');
require('dotenv').config();

async function createTutorCategory() {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  
  try {
    // Create category
    const categoryResult = await sql`
      INSERT INTO categories (name, description) 
      VALUES ('Tutor/Teacher', 'Home tutoring and coaching services for students of all ages')
      RETURNING id, name
    `;
    const categoryId = categoryResult[0].id;
    console.log('Created category:', categoryResult[0]);

    // Create subcategories
    const subcategories = [
      { name: 'Academic Tutoring', icon: '📚' },
      { name: 'Competitive Exam Coaching', icon: '🎯' },
      { name: 'Language Classes', icon: '🗣️' },
      { name: 'Music Classes', icon: '🎵' },
      { name: 'Computer Training', icon: '💻' },
    ];

    for (const sub of subcategories) {
      const subResult = await sql`
        INSERT INTO subcategories (category_id, name, icon)
        VALUES (${categoryId}, ${sub.name}, ${sub.icon})
        RETURNING id, name
      `;
      console.log('Created subcategory:', subResult[0]);

      // Create sample services for each subcategory
      const services = getServicesForSubcategory(sub.name);
      for (const service of services) {
        const serviceResult = await sql`
          INSERT INTO services (subcategory_id, name, description, base_price, is_active, duration_minutes)
          VALUES (${subResult[0].id}, ${service.name}, ${service.description}, ${service.price}, true, ${service.duration})
          RETURNING id, name
        `;
        console.log('  Created service:', serviceResult[0]);
      }
    }

    console.log('\nTutor/Teacher category setup complete!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

function getServicesForSubcategory(subcategoryName) {
  const servicesMap = {
    'Academic Tutoring': [
      { name: 'Math Tutoring (Class 1-5)', description: 'Home tuition for primary school mathematics', price: 500, duration: 60 },
      { name: 'Math Tutoring (Class 6-10)', description: 'Home tuition for middle/high school mathematics', price: 700, duration: 60 },
      { name: 'Science Tutoring (Class 6-10)', description: 'Physics, Chemistry, Biology home tuition', price: 700, duration: 60 },
      { name: 'English Tutoring', description: 'English language and literature home tuition', price: 500, duration: 60 },
    ],
    'Competitive Exam Coaching': [
      { name: 'JEE Preparation', description: 'IIT-JEE entrance exam coaching at home', price: 1500, duration: 90 },
      { name: 'NEET Preparation', description: 'Medical entrance exam coaching at home', price: 1500, duration: 90 },
      { name: 'Board Exam Preparation', description: 'Class 10/12 board exam intensive coaching', price: 800, duration: 90 },
    ],
    'Language Classes': [
      { name: 'Spoken English Classes', description: 'Improve your English speaking skills', price: 600, duration: 60 },
      { name: 'Hindi Classes', description: 'Learn Hindi reading and writing', price: 400, duration: 60 },
      { name: 'Foreign Language Classes', description: 'French, German, Spanish classes at home', price: 800, duration: 60 },
    ],
    'Music Classes': [
      { name: 'Guitar Classes', description: 'Learn guitar from expert teachers at home', price: 700, duration: 60 },
      { name: 'Keyboard/Piano Classes', description: 'Piano and keyboard lessons at home', price: 800, duration: 60 },
      { name: 'Vocal Music Classes', description: 'Classical and western vocal training', price: 600, duration: 60 },
    ],
    'Computer Training': [
      { name: 'Basic Computer Classes', description: 'MS Office, Internet basics for beginners', price: 500, duration: 60 },
      { name: 'Programming Classes', description: 'Learn coding - Python, Java, C++', price: 1000, duration: 90 },
      { name: 'Graphic Design Training', description: 'Photoshop, Illustrator, Canva training', price: 800, duration: 60 },
    ],
  };
  return servicesMap[subcategoryName] || [];
}

createTutorCategory();
