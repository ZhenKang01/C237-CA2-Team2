require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');

const { checkAuthenticated, checkAdmin, checkTeacher, checkStudent } = require('./middleware/auth');

const app = express();

// ---------------------------------------------------------
// Database connection - credentials now come from .env, not
// hardcoded here. Copy .env.example to .env and fill in the
// real values. Rotate the Azure password since it was
// previously committed in plaintext.
// ---------------------------------------------------------
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

db.connect((err) => {
    if (err) {
        console.error('Failed to connect to database. Did you set the environment variables in Vercel?', err.message);
        return;
    }
    console.log('Connected to database');
});

app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));

app.use(flash());

app.set('view engine', 'ejs');

// =========================================================
// PUBLIC ROUTES
// =========================================================
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user, messages: req.flash('success') });
});

app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

const validateRegistration = (req, res, next) => {
    const { username, email, password, phone_number, role } = req.body;

    if (!username || !email || !password || !phone_number || !role) {
        req.flash('error', 'All fields are required, including role.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }

    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }

    // Only allow self-registration as student or teacher.
    // Admin accounts should be seeded directly in the database,
    // not created through the public registration form.
    if (!['student', 'teacher'].includes(role)) {
        req.flash('error', 'Invalid role selected.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }

    next();
};

app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, phone_number, role } = req.body;

    const sql = 'INSERT INTO users (username, email, password, phone_number, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, phone_number, role], (err, result) => {
        if (err) {
            console.error('Database error during registration:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                req.flash('error', 'An account with that email or username already exists.');
            } else {
                req.flash('error', 'An unexpected error occurred during registration. Please try again.');
            }
            req.flash('formData', req.body);
            return res.redirect('/register');
        }
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
    res.render('login', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            console.error('Database error during login:', err);
            req.flash('error', 'An unexpected database error occurred. Please try again later.');
            return res.redirect('/login');
        }

        if (results.length > 0) {
            req.session.user = results[0];
            req.flash('success', 'Login successful!');

            // Route to the correct dashboard based on role,
            // instead of a single generic dashboard for everyone.
            const role = results[0].role;
            if (role === 'admin') return res.redirect('/admin');
            if (role === 'teacher') return res.redirect('/teacher');
            if (role === 'student') return res.redirect('/student');

            // Unknown/missing role - shouldn't happen once registration
            // enforces role, but fall back safely instead of crashing.
            req.flash('error', 'Your account has no valid role assigned. Contact an admin.');
            return res.redirect('/login');
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

// =========================================================
// ROLE-SPECIFIC DASHBOARDS
// =========================================================
app.get('/dashboard', checkAuthenticated, (req, res) => {
    // Generic fallback in case someone bookmarks /dashboard directly -
    // send them to their actual role page instead of a shared view.
    const role = req.session.user.role;
    if (role === 'admin') return res.redirect('/admin');
    if (role === 'teacher') return res.redirect('/teacher');
    if (role === 'student') return res.redirect('/student');
    res.redirect('/login');
});

app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', { user: req.session.user });
});

app.get('/teacher', checkAuthenticated, checkTeacher, (req, res) => {
    res.render('teacher', { user: req.session.user });
});

app.get('/student', checkAuthenticated, checkStudent, (req, res) => {
    res.render('student', { user: req.session.user });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// Starting the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

// Routes
// jen - Admin
// zk - Admins
// tian le - Students, Admins
// jereil - Teachers
// jayden - Students, Admins
// Hein - Teachers
