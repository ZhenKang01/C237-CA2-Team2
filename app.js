require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const {
    checkAuthenticated,
    checkAdmin,
    checkTeacher,
    checkStudent
} = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const REGISTRATION_ROLES = ['student', 'teacher'];
const DASHBOARDS = {
    admin: '/admin',
    teacher: '/teacher',
    student: '/student'
};

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false }
});

db.connect((error) => {
    if (error) {
        console.error('Database connection failed:', error.message);
        return;
    }
    console.log('Connected to database');
});

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'development-only-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));
app.use(flash());
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.successMessages = req.flash('success');
    res.locals.errorMessages = req.flash('error');
    next();
});

function dashboardFor(role) {
    return DASHBOARDS[role] || '/login';
}

function validateRegistration(req, res, next) {
    const username = (req.body.username || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    const address = (req.body.address || '').trim();
    const contact = (req.body.contact || '').trim();
    const role = (req.body.role || '').trim().toLowerCase();

    req.body = { username, email, password, address, contact, role };

    if (!username || !email || !password || !address || !contact || !role) {
        req.flash('error', 'All fields are required.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        req.flash('error', 'Enter a valid email address.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    if (password.length < 6) {
        req.flash('error', 'Password must contain at least 6 characters.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    if (!REGISTRATION_ROLES.includes(role)) {
        req.flash('error', 'Choose either Student or Teacher.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    return next();
}

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/register', (req, res) => {
    res.render('register', { formData: req.flash('formData')[0] || {} });
});

app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body;
    const sql = [
        'INSERT INTO users (username, email, password, address, contact, role)',
        'VALUES (?, ?, SHA1(?), ?, ?, ?)'
    ].join(' ');

    db.query(sql, [username, email, password, address, contact, role], (error) => {
        if (error) {
            console.error('Registration failed:', error.message);
            const message = error.code === 'ER_DUP_ENTRY'
                ? 'An account with that email or name already exists.'
                : 'Registration is unavailable right now. Please try again.';
            req.flash('error', message);
            req.flash('formData', req.body);
            return res.redirect('/register');
        }

        req.flash('success', 'Registration successful. You can now log in.');
        return res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect(dashboardFor(req.session.user.role));
    }
    return res.render('login');
});

app.post('/login', (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!email || !password) {
        req.flash('error', 'Email and password are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?) LIMIT 1';
    db.query(sql, [email, password], (error, results) => {
        if (error) {
            console.error('Login failed:', error.message);
            req.flash('error', 'Login is unavailable right now. Please try again.');
            return res.redirect('/login');
        }
        if (results.length === 0) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }

        const databaseUser = results[0];
        const role = String(databaseUser.role || '').toLowerCase();
        if (!DASHBOARDS[role]) {
            req.flash('error', 'Your account has no valid role. Contact an administrator.');
            return res.redirect('/login');
        }

        const { password: passwordHash, ...safeUser } = databaseUser;
        safeUser.role = role;

        return req.session.regenerate((sessionError) => {
            if (sessionError) {
                console.error('Session creation failed:', sessionError.message);
                return res.status(500).send('Unable to create a login session.');
            }
            req.session.user = safeUser;
            req.flash('success', 'Welcome back, ' + safeUser.username + '.');
            return req.session.save(() => res.redirect(dashboardFor(role)));
        });
    });
});

app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.redirect(dashboardFor(req.session.user.role));
});

app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    const sql = 'SELECT username, email, address, contact, role FROM users ORDER BY role, username';
    db.query(sql, (error, users) => {
        if (error) {
            console.error('Unable to load users:', error.message);
            return res.render('admin', {
                users: [],
                loadError: 'The user directory could not be loaded.'
            });
        }
        return res.render('admin', { users, loadError: null });
    });
});

app.get('/teacher', checkAuthenticated, checkTeacher, (req, res) => {
    res.render('teacher');
});

app.get('/student', checkAuthenticated, checkStudent, (req, res) => {
    res.render('student');
});

// --- ADMIN SESSIONS ROUTES ---

app.get('/admin/sessions', checkAuthenticated, checkAdmin, (req, res) => {
    const sql = 'SELECT * FROM sessions ORDER BY session_date DESC, session_time DESC';
    db.query(sql, (error, sessions) => {
        if (error) {
            console.error('Failed to load sessions:', error.message);
            req.flash('error', 'Could not load sessions.');
            return res.redirect('/admin');
        }
        res.render('admin_sessions', { sessions });
    });
});

app.get('/admin/sessions/new', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin_session_form', { session: {}, formAction: '/admin/sessions', submitLabel: 'Create Session' });
});

app.post('/admin/sessions', checkAuthenticated, checkAdmin, (req, res) => {
    const { subject, location, session_date, session_time, capacity } = req.body;
    const sql = 'INSERT INTO sessions (created_by, subject, location, session_date, session_time, capacity) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [req.session.user.id, subject, location, session_date, session_time, capacity], (error) => {
        if (error) {
            console.error('Failed to create session:', error.message);
            req.flash('error', 'Failed to create session.');
            return res.redirect('/admin/sessions/new');
        }
        req.flash('success', 'Session created successfully.');
        res.redirect('/admin/sessions');
    });
});

app.get('/admin/sessions/:id/edit', checkAuthenticated, checkAdmin, (req, res) => {
    const sql = 'SELECT * FROM sessions WHERE session_id = ?';
    db.query(sql, [req.params.id], (error, results) => {
        if (error || results.length === 0) {
            req.flash('error', 'Session not found.');
            return res.redirect('/admin/sessions');
        }
        res.render('admin_session_form', { session: results[0], formAction: `/admin/sessions/${req.params.id}`, submitLabel: 'Update Session' });
    });
});

app.post('/admin/sessions/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const { subject, location, session_date, session_time, capacity } = req.body;
    const sql = 'UPDATE sessions SET subject = ?, location = ?, session_date = ?, session_time = ?, capacity = ? WHERE session_id = ?';
    db.query(sql, [subject, location, session_date, session_time, capacity, req.params.id], (error) => {
        if (error) {
            req.flash('error', 'Failed to update session.');
            return res.redirect(`/admin/sessions/${req.params.id}/edit`);
        }
        req.flash('success', 'Session updated successfully.');
        res.redirect('/admin/sessions');
    });
});

app.post('/admin/sessions/:id/delete', checkAuthenticated, checkAdmin, (req, res) => {
    const sql = 'DELETE FROM sessions WHERE session_id = ?';
    db.query(sql, [req.params.id], (error) => {
        if (error) {
            req.flash('error', 'Failed to delete session. It may have existing applications or bookings.');
        } else {
            req.flash('success', 'Session deleted successfully.');
        }
        res.redirect('/admin/sessions');
    });
});

// --- TEACHER SESSIONS ROUTES ---

app.get('/teacher/sessions', checkAuthenticated, checkTeacher, (req, res) => {
    const sql = `
        SELECT s.*, 
               (SELECT COUNT(*) FROM teacher_applications ta WHERE ta.session_id = s.session_id AND ta.status = 'approved') as approved_teachers,
               (SELECT status FROM teacher_applications ta WHERE ta.session_id = s.session_id AND ta.teacher_id = ?) as my_status
        FROM sessions s
        ORDER BY s.session_date, s.session_time
    `;
    db.query(sql, [req.session.user.id], (error, sessions) => {
        if (error) {
            req.flash('error', 'Could not load sessions.');
            return res.redirect('/teacher');
        }
        res.render('teacher_sessions', { sessions });
    });
});

app.post('/teacher/sessions/:id/apply', checkAuthenticated, checkTeacher, (req, res) => {
    const sessionId = req.params.id;
    const teacherId = req.session.user.id;
    
    db.query('SELECT COUNT(*) as count FROM teacher_applications WHERE session_id = ? AND status = "approved"', [sessionId], (err, results) => {
        if (err) return res.redirect('/teacher/sessions');
        
        const status = results[0].count === 0 ? 'approved' : 'applied';
        const sql = 'INSERT INTO teacher_applications (session_id, teacher_id, status) VALUES (?, ?, ?)';
        
        db.query(sql, [sessionId, teacherId, status], (error) => {
            if (error) {
                if (error.code === 'ER_DUP_ENTRY') req.flash('error', 'You already applied for this session.');
                else req.flash('error', 'Failed to apply.');
            } else {
                req.flash('success', status === 'approved' ? 'You are approved to teach this session!' : 'Application submitted.');
            }
            res.redirect('/teacher/my-applications');
        });
    });
});

app.get('/teacher/my-applications', checkAuthenticated, checkTeacher, (req, res) => {
    const sql = `
        SELECT ta.*, s.subject, s.location, s.session_date, s.session_time 
        FROM teacher_applications ta 
        JOIN sessions s ON ta.session_id = s.session_id 
        WHERE ta.teacher_id = ?
        ORDER BY ta.applied_at DESC
    `;
    db.query(sql, [req.session.user.id], (error, applications) => {
        if (error) {
            req.flash('error', 'Could not load your applications.');
            return res.redirect('/teacher');
        }
        res.render('teacher_applications', { applications });
    });
});

app.post('/teacher/applications/:id/optout', checkAuthenticated, checkTeacher, (req, res) => {
    const sql = 'DELETE FROM teacher_applications WHERE application_id = ? AND teacher_id = ?';
    db.query(sql, [req.params.id, req.session.user.id], (error) => {
        if (error) req.flash('error', 'Failed to opt out.');
        else req.flash('success', 'You have opted out of the session.');
        res.redirect('/teacher/my-applications');
    });
});

// --- STUDENT SESSIONS ROUTES ---

app.get('/student/sessions', checkAuthenticated, checkStudent, (req, res) => {
    const sql = `
        SELECT s.*, 
               (SELECT COUNT(*) FROM student_bookings sb WHERE sb.session_id = s.session_id AND sb.status = 'booked') as booked_count,
               (SELECT status FROM student_bookings sb WHERE sb.session_id = s.session_id AND sb.student_id = ?) as my_status
        FROM sessions s
        ORDER BY s.session_date, s.session_time
    `;
    db.query(sql, [req.session.user.id], (error, sessions) => {
        if (error) {
            req.flash('error', 'Could not load sessions.');
            return res.redirect('/student');
        }
        res.render('student_sessions', { sessions });
    });
});

app.post('/student/sessions/:id/apply', checkAuthenticated, checkStudent, (req, res) => {
    const sessionId = req.params.id;
    const studentId = req.session.user.id;
    
    const checkSql = `
        SELECT s.capacity, 
               (SELECT COUNT(*) FROM student_bookings sb WHERE sb.session_id = s.session_id AND sb.status = 'booked') as booked_count
        FROM sessions s WHERE s.session_id = ?
    `;
    db.query(checkSql, [sessionId], (err, results) => {
        if (err || results.length === 0) return res.redirect('/student/sessions');
        
        if (results[0].booked_count >= results[0].capacity) {
            req.flash('error', 'This session is fully booked.');
            return res.redirect('/student/sessions');
        }
        
        const sql = 'INSERT INTO student_bookings (session_id, student_id, status) VALUES (?, ?, "booked")';
        db.query(sql, [sessionId, studentId], (error) => {
            if (error) req.flash('error', 'Failed to book session (you might have already booked).');
            else req.flash('success', 'Session booked successfully!');
            res.redirect('/student/my-bookings');
        });
    });
});

app.get('/student/my-bookings', checkAuthenticated, checkStudent, (req, res) => {
    const sql = `
        SELECT sb.*, s.subject, s.location, s.session_date, s.session_time 
        FROM student_bookings sb 
        JOIN sessions s ON sb.session_id = s.session_id 
        WHERE sb.student_id = ?
        ORDER BY sb.booked_at DESC
    `;
    db.query(sql, [req.session.user.id], (error, bookings) => {
        if (error) {
            req.flash('error', 'Could not load your bookings.');
            return res.redirect('/student');
        }
        res.render('student_bookings', { bookings });
    });
});

app.post('/student/bookings/:id/optout', checkAuthenticated, checkStudent, (req, res) => {
    const sql = 'DELETE FROM student_bookings WHERE booking_id = ? AND student_id = ?';
    db.query(sql, [req.params.id, req.session.user.id], (error) => {
        if (error) req.flash('error', 'Failed to opt out.');
        else req.flash('success', 'You have opted out of the booking.');
        res.redirect('/student/my-bookings');
    });
});

function logout(req, res) {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
}

app.get('/logout', logout);
app.post('/logout', logout);

app.use((req, res) => {
    res.status(404).render('404');
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log('TutorLink is running on http://localhost:' + PORT);
    });
}

module.exports = app;
