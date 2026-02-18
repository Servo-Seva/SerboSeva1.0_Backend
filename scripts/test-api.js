// Quick script to test API endpoints
const fetch = require('node-fetch');

const API = 'http://localhost:5000/api';

async function testHealth() {
    try {
        const res = await fetch(`${API}/public/health`);
        console.log('Health check:', res.status, await res.text());
    } catch (e) {
        console.error('Server not reachable:', e.message);
    }
}

async function testAdminBookings() {
    try {
        const res = await fetch(`${API}/admin/bookings`);
        console.log('Admin bookings:', res.status);
        const data = await res.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Admin bookings error:', e.message);
    }
}

async function testUserBookings() {
    try {
        const res = await fetch(`${API}/bookings`);
        console.log('User bookings:', res.status);
        const data = await res.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('User bookings error:', e.message);
    }
}

(async () => {
    console.log('Testing API...');
    await testHealth();
    await testAdminBookings();
    await testUserBookings();
})();
