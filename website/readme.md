# Zanskar Mess Info

Express + EJS portal for the hostel mess: weekly menu, announcements, and a
suggestion/complaint box with a Basic-Auth admin panel.

## Database

Runs on **Neon Postgres**, provisioned through the Vercel Marketplace and connected
to the `mess-info` project. Vercel injects `DATABASE_URL` into all environments, so
there is nothing to configure by hand.

> Previously this ran on a free MySQL instance at `sql.freedb.tech`. That provider
> deleted the database, which took the site down with 504s. Neon's free tier is used
> instead — the schema lives in `schema.sql`.

### Local setup

```bash
npm install
vercel env pull .env.local   # fetches DATABASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD
npm run init-db              # creates tables (idempotent)
npm start                    # http://localhost:3000
```

`npm run init-db` is safe to re-run: every statement in `schema.sql` uses
`IF NOT EXISTS`, and the starter announcement is only inserted when the table is empty.

### Inspecting the data

```bash
psql "$DATABASE_URL"
```

```sql
\dt                          -- list tables
\d meal_plans                -- describe a table
SELECT * FROM announcements ORDER BY id DESC;
```

Or use the Neon dashboard: `vercel integration open neon`.

## Routes

| Route                 | Auth  | Purpose                          |
| --------------------- | ----- | -------------------------------- |
| `GET /`               | –     | Public portal                    |
| `GET /healthz`        | –     | Liveness + database reachability |
| `GET /admin`          | Basic | Admin panel                      |
| `POST /update-menu`   | Basic | Upsert one day/meal menu cell    |
| `POST /add-announcement`, `/delete-announcement` | Basic | Manage announcements |
| `POST /submit-suggestion`, `/submit-complaint`   | –     | Public feedback (last 20 kept)   |

## Notes

- Timestamps are stored as naive UTC; the views add +330 minutes to render IST.
- Database calls are capped at `DB_TIMEOUT_MS` (default 7000ms), below Vercel's 10s
  function limit, so an unreachable database returns a 503 rather than a 504.
- TODO: wire up the installed `@vercel/analytics` and `@vercel/speed-insights` packages.
