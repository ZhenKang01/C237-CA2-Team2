require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
    multipleStatements: true
});

const sql = `
CREATE TABLE IF NOT EXISTS sessions (
  session_id    INT AUTO_INCREMENT PRIMARY KEY,
  created_by    INT NOT NULL,
  subject       VARCHAR(100) NOT NULL,
  location      VARCHAR(150) NOT NULL,
  session_date  DATE NOT NULL,
  session_time  TIME NOT NULL,
  capacity      INT NOT NULL DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS teacher_applications (
  application_id INT AUTO_INCREMENT PRIMARY KEY,
  session_id     INT NOT NULL,
  teacher_id     INT NOT NULL,
  status         ENUM('applied','approved','rejected','withdrawn') DEFAULT 'applied',
  applied_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id),
  FOREIGN KEY (teacher_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS student_bookings (
  booking_id  INT AUTO_INCREMENT PRIMARY KEY,
  session_id  INT NOT NULL,
  student_id  INT NOT NULL,
  status      ENUM('booked','cancelled') DEFAULT 'booked',
  booked_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id),
  FOREIGN KEY (student_id) REFERENCES users(id)
);
`;

db.connect((err) => {
    if (err) throw err;
    console.log('Connected.');
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log('Tables created.');
        process.exit();
    });
});
