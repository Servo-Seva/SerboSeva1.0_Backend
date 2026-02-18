const http = require('http');

const req = http.get('http://localhost:5000/', (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.log(`problem with request: ${e.message}`);
});
