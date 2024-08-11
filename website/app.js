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

// Admin route with basic authentication
app.get('/admin', basicAuth, (req, res) => {
    pool.query('SELECT * FROM announcements', (err, announcementResults) => {
        if (err) throw err;
        pool.query('SELECT * FROM meal_plans', (err, mealPlanResults) => {
            if (err) throw err;
            pool.query('SELECT * FROM complaints', (err, complaintResults) => {
                if (err) throw err;
                pool.query('SELECT * FROM suggestions ORDER BY date DESC', (err, suggestionResults) => {
                    if (err) throw err;

                    // Format dates for display
                    suggestionResults.forEach(suggestion => {
                        suggestion.date = new Date(suggestion.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        });
                    });

                    complaintResults.forEach(complaint => {
                        complaint.date = new Date(complaint.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
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
    const suggestion = req.body.suggestion;
    const date = new Date().toISOString().split('T')[0]; // Get date in YYYY-MM-DD format
    pool.query('INSERT INTO suggestions (suggestion, date) VALUES (?, ?)', [suggestion, date], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Handle complaint submission
app.post('/submit-complaint', (req, res) => {
    const { date, meal, name, complaint } = req.body;
    const formattedDate = new Date(date).toISOString().split('T')[0]; // Convert selected date to YYYY-MM-DD format
    pool.query('INSERT INTO complaints (date, meal, name, complaint) VALUES (?, ?, ?, ?)', [formattedDate, meal, name, complaint], (err) => {
        if (err) throw err;
        res.redirect('/');
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
