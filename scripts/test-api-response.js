// Simple test to verify the API returns image_url
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookings',
    method: 'GET',
    headers: {
        'Cookie': 'session=test' // This won't authenticate but we'll see the response
    }
};

const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Response:', data);
    });
});

req.on('error', (e) => {
    console.error(`Problem: ${e.message}`);
});

req.end();
