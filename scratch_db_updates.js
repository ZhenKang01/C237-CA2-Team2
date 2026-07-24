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

async function runUpdates() {
    try {
        console.log("Adding reject_reason column...");
        await promisePool.query('ALTER TABLE bookings ADD COLUMN reject_reason TEXT');
        console.log("Successfully added reject_reason column.");
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log("Column reject_reason already exists.");
        } else {
            console.error("Error adding column:", e);
        }
    }

    try {
        console.log("Deleting specified bookings for Diliaious Ho and jenita...");
        await promisePool.query(`
            DELETE b FROM bookings b
            JOIN students s ON b.student_id = s.student_id
            WHERE s.full_name IN ('Diliaious Ho', 'jenita') AND b.status = 'approved'
        `);
        console.log("Successfully deleted bookings.");
    } catch (e) {
        console.error("Error deleting bookings:", e);
    }
    
    process.exit(0);
}

runUpdates();
