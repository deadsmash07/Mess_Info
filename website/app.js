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

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Home route
app.get('/', (req, res) => {
    res.render('index', { mealPlan, announcements });
});

// Admin page route
app.get('/admin', (req, res) => {
    res.render('admin', { mealPlan, complaints, suggestions, announcements });
});

// Handle menu updates
app.post('/update-menu', (req, res) => {
    const { day, meal, menu } = req.body;
    if (!mealPlan[day]) mealPlan[day] = {};
    if (mealPlan[day][meal]) {
        // Append new menu item to the existing one
        mealPlan[day][meal] += ', ' + menu;
    } else {
        // If no existing menu item, set it
        mealPlan[day][meal] = menu;
    }
    res.redirect('/admin');
});

// Handle announcement updates
app.post('/add-announcement', (req, res) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}`);

});
