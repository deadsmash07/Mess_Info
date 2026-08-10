// Creates the Postgres schema and seeds a starter announcement.
// Usage: node scripts/init-db.js   (needs DATABASE_URL in the environment or .env)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

const CONNECTION_STRING = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!CONNECTION_STRING) {
    console.error('DATABASE_URL is not set. Run `vercel env pull .env` first.');
    process.exit(1);
}

const sql = neon(CONNECTION_STRING);

(async () => {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');

    // The HTTP driver runs one statement per call, so apply the schema statement by statement.
    const statements = schema
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s && !s.split('\n').every((line) => line.trim().startsWith('--')));

    for (const statement of statements) {
        await sql.query(statement);
        console.log('OK:', statement.split('\n')[0].slice(0, 70));
    }

    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM announcements`;
    if (count === 0) {
        await sql`
            INSERT INTO announcements (announcement)
            VALUES (${'Portal restored on a new database. The previous menu and feedback history could not be recovered — please re-enter the weekly menu from the admin panel.'})
        `;
        console.log('Seeded starter announcement.');
    }

    const tables = await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name
    `;
    console.log('Tables now present:', tables.map((t) => t.table_name).join(', '));
})().catch((err) => {
    console.error('init-db failed:', err);
    process.exit(1);
});
