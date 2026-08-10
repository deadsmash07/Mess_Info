const { neon } = require('@neondatabase/serverless');

// Vercel's Neon integration injects DATABASE_URL; POSTGRES_URL is the fallback name.
const CONNECTION_STRING = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let client = null;

// Lazy so that a missing connection string surfaces as a handled request error
// rather than crashing the process at import time.
function sql(strings, ...values) {
    if (!client) {
        if (!CONNECTION_STRING) {
            throw new Error('DATABASE_URL is not set');
        }
        client = neon(CONNECTION_STRING);
    }
    return client(strings, ...values);
}

module.exports = { sql };
