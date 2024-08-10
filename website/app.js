require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Use EJS for templating
app.set('view engine', 'ejs');

// Store data in memory (for simplicity, replace with a database for production)
let mealPlan = {};
let complaints = [];
let suggestions = [];
let announcements = [];

// Basic Authentication Middleware
function basicAuth(req, res, next) {
    const auth = { login: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD };

    // Parse login and password from headers
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

    // Verify login and password are set and correct
    if (login && password && login === auth.login && password === auth.password) {
        return next();
    }

    // Access denied
    res.set('WWW-Authenticate', 'Basic realm="401"'); // Prompt for user credentials
    res.status(401).send('Authentication required.'); // Custom message for 401
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Home route
app.get('/', (req, res) => {
    res.render('index', { mealPlan, announcements });
});

// Admin page route with authentication
app.get('/admin', basicAuth, (req, res) => {
    res.render('admin', { mealPlan, complaints, suggestions, announcements });
});

// Handle menu updates
app.post('/update-menu', basicAuth, (req, res) => {
    const { day, meal, menu } = req.body;
    if (!mealPlan[day]) mealPlan[day] = {};
    mealPlan[day][meal] = menu;  // Replaces the current menu for the selected meal
    res.redirect('/admin');
});

// Handle announcement updates
app.post('/add-announcement', basicAuth, (req, res) => {
    const { announcement } = req.body;
    announcements.push(announcement);
    res.redirect('/admin');
});

// Handle suggestion submission
app.post('/submit-suggestion', (req, res) => {
    const suggestion = req.body.suggestion;
    suggestions.push(suggestion);
    res.redirect('/');
});

// Handle complaint submission
app.post('/submit-complaint', (req, res) => {
    const { date, meal, complaint } = req.body;
    complaints.push({ date, meal, complaint });
    res.redirect('/');
});

// Logout route
app.get('/logout', (req, res) => {
    res.set('WWW-Authenticate', 'Basic realm="401"'); // Force the browser to prompt for credentials
    res.status(401).send('You have been logged out. <a href="/admin">Login again</a>'); // Provide a link to log back in
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
