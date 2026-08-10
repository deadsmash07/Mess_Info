-- Postgres schema (Neon). Replaces the old MySQL schema in sql_table.txt.
-- Timestamps are stored as naive UTC so the views' fixed +330min IST offset keeps working.

CREATE TABLE IF NOT EXISTS announcements (
    id           SERIAL PRIMARY KEY,
    announcement TEXT      NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE TABLE IF NOT EXISTS meal_plans (
    id           SERIAL PRIMARY KEY,
    day          VARCHAR(10) NOT NULL,
    meal         VARCHAR(20) NOT NULL,
    menu         TEXT        NOT NULL,
    last_updated TIMESTAMP   NOT NULL,
    CONSTRAINT unique_day_meal UNIQUE (day, meal)
);

CREATE TABLE IF NOT EXISTS complaints (
    id         SERIAL PRIMARY KEY,
    date       TIMESTAMP    NOT NULL,
    meal       VARCHAR(20)  NOT NULL,
    name       VARCHAR(255) NOT NULL,
    mobile     VARCHAR(15)  NOT NULL,
    complaint  TEXT         NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE TABLE IF NOT EXISTS suggestions (
    id         SERIAL PRIMARY KEY,
    suggestion TEXT      NOT NULL,
    date       TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS complaints_date_idx  ON complaints (date DESC);
CREATE INDEX IF NOT EXISTS suggestions_date_idx ON suggestions (date DESC);
