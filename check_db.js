require('dotenv').config({ path: '.env.example' });
const mysql = require('mysql2');

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected.');
    db.query('DESCRIBE users', (err, results) => {
        if (err) console.error(err);
        else console.log(results);
        db.end();
    });
});
