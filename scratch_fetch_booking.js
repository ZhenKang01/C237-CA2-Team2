async function run() {
    try {
        const loginRes = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                email: 'sl1pohno12345@gmail.com',
                password: 'password123'
            }),
            redirect: 'manual'
        });
        
        const cookie = loginRes.headers.get('set-cookie');
        
        const bookRes = await fetch('http://localhost:3000/student/slots/1/book', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookie
            },
            body: new URLSearchParams({
                class_size: '1'
            }),
            redirect: 'manual'
        });
        
        console.log('Book status:', bookRes.status);
        console.log('Book headers:', bookRes.headers);
    } catch (e) {
        console.error(e);
    }
}
run();
