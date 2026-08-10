require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { sql } = require('./db');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Security headers (CSP)
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    next();
});

// Set EJS as the templating engine and explicitly set the views directory
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Must stay below the platform's function timeout (10s on Vercel) so a slow or
// unreachable database returns a real 503 instead of the request being killed
// mid-flight and surfacing as a 504.
const DB_TIMEOUT_MS = Number(process.env.DB_TIMEOUT_MS) || 7000;

function withTimeout(promise) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`database did not respond within ${DB_TIMEOUT_MS}ms`)), DB_TIMEOUT_MS);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Wraps an async route so a rejected promise becomes a 503 response instead of an
// unhandled rejection. Previously every handler did `if (err) throw err` inside a
// callback, which killed the process and made the function hang until Vercel's
// 10s timeout returned a 504.
function route(handler) {
    return (req, res, next) => {
        withTimeout(Promise.resolve(handler(req, res, next))).catch((err) => {
            console.error(`${req.method} ${req.path} failed:`, err.message);
            if (res.headersSent) return;
            res.status(503).type('html').send(
                '<h1>Service temporarily unavailable</h1>' +
                '<p>The mess portal could not reach its database. Please try again shortly.</p>'
            );
        });
    };
}

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

// Collapse meal_plans rows into { day: { meal: menu } }
function toMealPlan(rows) {
    return rows.reduce((acc, row) => {
        if (!acc[row.day]) acc[row.day] = {};
        acc[row.day][row.meal] = row.menu;
        return acc;
    }, {});
}

// Current timestamp as naive UTC 'YYYY-MM-DD HH:MM:SS'
function utcTimestamp() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// Liveness + database reachability probe
app.get('/healthz', route(async (req, res) => {
    const rows = await sql`SELECT 1 AS ok`;
    res.json({ status: 'ok', database: rows[0].ok === 1 ? 'reachable' : 'unexpected' });
}));

// Home route
app.get('/', route(async (req, res) => {
    const [announcements, mealPlanRows, updated] = await Promise.all([
        sql`SELECT * FROM announcements ORDER BY id DESC`,
        sql`SELECT * FROM meal_plans`,
        sql`SELECT MAX(last_updated) AS "lastUpdated" FROM meal_plans`,
    ]);

    const lastUpdated = updated[0].lastUpdated
        ? new Date(updated[0].lastUpdated).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
          })
        : null;

    res.render('index', { mealPlan: toMealPlan(mealPlanRows), announcements, lastUpdated });
}));

// Admin route with basic authentication
app.get('/admin', basicAuth, route(async (req, res) => {
    const [announcements, mealPlanRows, complaints, suggestions] = await Promise.all([
        sql`SELECT * FROM announcements ORDER BY id DESC`,
        sql`SELECT * FROM meal_plans`,
        sql`SELECT * FROM complaints ORDER BY date DESC`,
        sql`SELECT * FROM suggestions ORDER BY date DESC`,
    ]);

    res.render('admin', {
        mealPlan: toMealPlan(mealPlanRows),
        complaints,
        suggestions,
        announcements,
    });
}));

// Handle menu updates
app.post('/update-menu', basicAuth, route(async (req, res) => {
    const { day, meal, menu } = req.body;
    await sql`
        INSERT INTO meal_plans (day, meal, menu, last_updated)
        VALUES (${day}, ${meal}, ${menu}, ${utcTimestamp()})
        ON CONFLICT (day, meal)
        DO UPDATE SET menu = EXCLUDED.menu, last_updated = EXCLUDED.last_updated
    `;
    res.redirect('/admin');
}));

// Handle announcement updates
app.post('/add-announcement', basicAuth, route(async (req, res) => {
    const { announcement } = req.body;
    await sql`INSERT INTO announcements (announcement) VALUES (${announcement})`;
    res.redirect('/admin');
}));

// Handle deleting an announcement
app.post('/delete-announcement', basicAuth, route(async (req, res) => {
    const { id } = req.body;
    await sql`DELETE FROM announcements WHERE id = ${id}`;
    res.redirect('/admin');
}));

// Handle suggestion submission
app.post('/submit-suggestion', route(async (req, res) => {
    const suggestion = (req.body.suggestion || '').trim();
    if (!suggestion) {
        return res.redirect('/'); // Do not submit if the suggestion is empty
    }

    await sql`INSERT INTO suggestions (suggestion, date) VALUES (${suggestion}, ${utcTimestamp()})`;

    // Keep only the 20 most recent suggestions
    await sql`
        DELETE FROM suggestions
        WHERE id NOT IN (SELECT id FROM suggestions ORDER BY date DESC LIMIT 20)
    `;
    res.redirect('/');
}));

// Handle complaint submission
app.post('/submit-complaint', route(async (req, res) => {
    const { meal, name, mobile, complaint } = req.body;

    await sql`
        INSERT INTO complaints (date, meal, name, mobile, complaint)
        VALUES (${utcTimestamp()}, ${meal}, ${name}, ${mobile}, ${complaint})
    `;

    // Keep only the 20 most recent complaints
    await sql`
        DELETE FROM complaints
        WHERE id NOT IN (SELECT id FROM complaints ORDER BY date DESC LIMIT 20)
    `;
    res.redirect('/');
}));

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
