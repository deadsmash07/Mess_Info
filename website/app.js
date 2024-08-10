require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Use EJS for templating
app.set('view engine', 'ejs');

// Create MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Basic Authentication Middleware
function basicAuth(req, res, next) {
    const auth = { login: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD };
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
    if (login && password && login === auth.login && password === auth.password) {
        return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('Authentication required.');
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Home route
app.get('/', (req, res) => {
    pool.query('SELECT * FROM announcements', (err, announcementResults) => {
        if (err) throw err;
        pool.query('SELECT * FROM meal_plans', (err, mealPlanResults) => {
            if (err) throw err;
            const mealPlan = mealPlanResults.reduce((acc, row) => {
                if (!acc[row.day]) acc[row.day] = {};
                acc[row.day][row.meal] = row.menu;
                return acc;
            }, {});
            res.render('index', { mealPlan, announcements: announcementResults });
        });
    });
});

// Admin page route with authentication
app.get('/admin', basicAuth, (req, res) => {
    pool.query('SELECT * FROM announcements', (err, announcementResults) => {
        if (err) throw err;
        pool.query('SELECT * FROM meal_plans', (err, mealPlanResults) => {
            if (err) throw err;
            pool.query('SELECT * FROM complaints', (err, complaintResults) => {
                if (err) throw err;
                pool.query('SELECT * FROM suggestions', (err, suggestionResults) => {
                    if (err) throw err;
                    const mealPlan = mealPlanResults.reduce((acc, row) => {
                        if (!acc[row.day]) acc[row.day] = {};
                        acc[row.day][row.meal] = row.menu;
                        return acc;
                    }, {});
                    res.render('admin', {
                        mealPlan,
                        complaints: complaintResults,
                        suggestions: suggestionResults,
                        announcements: announcementResults
                    });
                });
            });
        });
    });
});

// Handle menu updates
app.post('/update-menu', basicAuth, (req, res) => {
    const { day, meal, menu } = req.body;
    pool.query('REPLACE INTO meal_plans (day, meal, menu) VALUES (?, ?, ?)', [day, meal, menu], (err) => {
        if (err) throw err;
        res.redirect('/admin');
    });
});

// Handle announcement updates
app.post('/add-announcement', basicAuth, (req, res) => {
    const { announcement } = req.body;
    pool.query('INSERT INTO announcements (announcement) VALUES (?)', [announcement], (err) => {
        if (err) throw err;
        res.redirect('/admin');
    });
});

// Handle suggestion submission
app.post('/submit-suggestion', (req, res) => {
    const { suggestion } = req.body;
    pool.query('INSERT INTO suggestions (suggestion) VALUES (?)', [suggestion], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Handle complaint submission
app.post('/submit-complaint', (req, res) => {
    const { date, meal, complaint } = req.body;
    pool.query('INSERT INTO complaints (date, meal, complaint) VALUES (?, ?, ?)', [date, meal, complaint], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Logout route
app.get('/logout', (req, res) => {
    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('You have been logged out. <a href="/admin">Login again</a>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
