function checkAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    req.flash('error', 'Please log in to view that page.');
    return res.redirect('/login');
}

function requireRole(role) {
    return (req, res, next) => {
        if (req.session && req.session.user && req.session.user.role === role) {
            return next();
        }
        req.flash('error', 'Access denied. This page is for ' + role + 's only.');
        return res.redirect('/dashboard');
    };
}

const checkAdmin = requireRole('admin');
const checkTeacher = requireRole('teacher');
const checkStudent = requireRole('student');

module.exports = {
    checkAuthenticated,
    checkAdmin,
    checkTeacher,
    checkStudent
};
