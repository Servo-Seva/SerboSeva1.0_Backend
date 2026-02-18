const postgres = require('postgres');

async function run() {
    const sqlUrl = process.env.DATABASE_URL;
    if (!sqlUrl) {
        console.error('DATABASE_URL not set');
        process.exit(1);
    }

    const adminUids = (process.env.ADMIN_FIREBASE_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (adminUids.length === 0) {
        console.error('ADMIN_FIREBASE_UIDS not set or empty');
        process.exit(1);
    }

    const client = postgres(sqlUrl, { ssl: 'require' });
    for (const uid of adminUids) {
        console.log('Marking admin for', uid);
        await client`
      update users
      set is_admin = true
      where firebase_uid = ${uid}
    `;
    }

    await client.end();
    console.log('Done');
}

run().catch(err => { console.error(err); process.exit(1); });
