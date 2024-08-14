require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Set EJS as the templating engine and explicitly set the views directory
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

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

// Home route
app.get('/', (req, res) => {
    pool.query('SELECT * FROM announcements ORDER BY id DESC', (err, announcementResults) => { // Latest announcements first
        if (err) throw err;
        pool.query('SELECT * FROM meal_plans', (err, mealPlanResults) => {
            if (err) throw err;
            pool.query('SELECT MAX(last_updated) as lastUpdated FROM meal_plans', (err, result) => {
                if (err) throw err;
                const lastUpdated = result[0].lastUpdated ? new Date(result[0].lastUpdated).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                }) : null;
                const mealPlan = mealPlanResults.reduce((acc, row) => {
                    if (!acc[row.day]) acc[row.day] = {};
                    acc[row.day][row.meal] = row.menu;
                    return acc;
                }, {});
                res.render('index', { mealPlan, announcements: announcementResults, lastUpdated });
            });
        });
    });
});

// Admin route with basic authentication
app.get('/admin', basicAuth, (req, res) => {
    pool.query('SELECT * FROM announcements ORDER BY id DESC', (err, announcementResults) => { // Latest announcements first
        if (err) throw err;
        pool.query('SELECT * FROM meal_plans', (err, mealPlanResults) => {
            if (err) throw err;
            pool.query('SELECT * FROM complaints ORDER BY date DESC', (err, complaintResults) => { // Order by date
                if (err) throw err;
                pool.query('SELECT * FROM suggestions ORDER BY date DESC', (err, suggestionResults) => { // Order by date
                    if (err) throw err;

                    // Format dates for display
                    suggestionResults.forEach(suggestion => {
                        suggestion.date = new Date(suggestion.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                        });
                    });

                    complaintResults.forEach(complaint => {
                        complaint.date = new Date(complaint.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                        });
                    });

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
    const lastUpdated = new Date().toISOString().slice(0, 19).replace('T', ' '); // Current timestamp in YYYY-MM-DD HH:MM:SS format
    pool.query('REPLACE INTO meal_plans (day, meal, menu, last_updated) VALUES (?, ?, ?, ?)', [day, meal, menu, lastUpdated], (err) => {
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

// Handle deleting an announcement
app.post('/delete-announcement', basicAuth, (req, res) => {
    const { id } = req.body;
    pool.query('DELETE FROM announcements WHERE id = ?', [id], (err) => {
        if (err) throw err;
        res.redirect('/admin');
    });
});

// Handle suggestion submission
app.post('/submit-suggestion', (req, res) => {
    const suggestion = req.body.suggestion.trim();
    if (!suggestion) {
        return res.redirect('/'); // Do not submit if the suggestion is empty
    }
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' '); // Current timestamp in YYYY-MM-DD HH:MM:SS format

    pool.query('INSERT INTO suggestions (suggestion, date) VALUES (?, ?)', [suggestion, timestamp], (err) => {
        if (err) throw err;

        // Clean up old suggestions if more than 10
        pool.query('SELECT id FROM suggestions ORDER BY date DESC', (err, results) => {
            if (err) throw err;

            if (results.length > 10) {
                const idsToDelete = results.slice(10).map(result => result.id);
                pool.query('DELETE FROM suggestions WHERE id IN (?)', [idsToDelete], (err) => {
                    if (err) throw err;
                    res.redirect('/');
                });
            } else {
                res.redirect('/');
            }
        });
    });
});

// Handle complaint submission
app.post('/submit-complaint', (req, res) => {
    const { date, meal, name, mobile, complaint } = req.body;
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' '); // Current timestamp in YYYY-MM-DD HH:MM:SS format

    pool.query('INSERT INTO complaints (date, meal, name, mobile, complaint) VALUES (?, ?, ?, ?, ?)', [timestamp, meal, name, mobile, complaint], (err) => {
        if (err) throw err;

        // Clean up old complaints if more than 10
        pool.query('SELECT id FROM complaints ORDER BY date DESC', (err, results) => {
            if (err) throw err;

            if (results.length > 10) {
                const idsToDelete = results.slice(10).map(result => result.id);
                pool.query('DELETE FROM complaints WHERE id IN (?)', [idsToDelete], (err) => {
                    if (err) throw err;
                    res.redirect('/');
                });
            } else {
                res.redirect('/');
            }
        });
    });
});

// Logout route
app.get('/logout', (req, res) => {
    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('You have been logged out. <a href="/admin">Login again</a>');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
