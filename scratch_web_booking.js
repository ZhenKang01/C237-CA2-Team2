const http = require('http');
const querystring = require('querystring');

const loginData = querystring.stringify({
    email: 'sl1pohno12345@gmail.com',
    password: 'password123'
});

const loginReq = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(loginData)
    }
}, (res) => {
    const cookie = res.headers['set-cookie'];
    if (!cookie) {
        console.error("No cookie received. Login failed?");
        process.exit(1);
    }
    
    // Now book
    const bookData = querystring.stringify({
        class_size: '1',
        education_level: 'Primary'
    });
    
    const bookReq = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/student/slots/1/book',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(bookData),
            'Cookie': cookie[0]
        }
    }, (res2) => {
        console.log(`Booking response status: ${res2.statusCode}`);
        console.log(res2.headers);
        process.exit(0);
    });
    
    bookReq.on('error', (e) => {
        console.error(`Booking problem: ${e.message}`);
    });
    bookReq.write(bookData);
    bookReq.end();
});

loginReq.on('error', (e) => {
    console.error(`Login problem: ${e.message}`);
});
loginReq.write(loginData);
loginReq.end();
