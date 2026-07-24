require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false }
});

const promisePool = pool.promise();

async function runTest() {
    try {
        console.log("Fetching a student and a slot...");
        const [students] = await promisePool.query('SELECT * FROM students LIMIT 1');
        const [slots] = await promisePool.query('SELECT * FROM teacher_slots LIMIT 1');
        
        if (students.length === 0 || slots.length === 0) {
            console.log("Not enough data to test");
            process.exit(1);
        }

        const student = students[0];
        const slot = slots[0];

        console.log(`Trying to book slot ${slot.slot_id} for student ${student.student_id}`);
        
        const sql = 'INSERT INTO bookings (slot_id, student_id, class_size, description, status) VALUES (?, ?, ?, ?, "pending")';
        await promisePool.query(sql, [slot.slot_id, student.student_id, 1, 'Test booking']);
        
        console.log("Successfully booked slot!");
    } catch (e) {
        console.error("Booking Error:", e);
    }
    
    process.exit(0);
}

runTest();
