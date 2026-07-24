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

async function run() {
    try {
        const [rows] = await promisePool.query('SHOW CREATE TABLE bookings');
        console.log(rows[0]['Create Table']);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
