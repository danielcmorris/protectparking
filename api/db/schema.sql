-- Schema for the Stop the Vallejo Street Takeover comment/contact store.
-- Apply once the Postgres instance is provisioned:
--   psql "$DATABASE_URL" -f db/schema.sql

CREATE TABLE IF NOT EXISTS comments (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT,
  address     TEXT,
  email       TEXT        NOT NULL,
  district3   BOOLEAN     NOT NULL DEFAULT FALSE,
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Speed up the running-tally count and any email-based lookups.
CREATE INDEX IF NOT EXISTS comments_created_at_idx ON comments (created_at);
CREATE INDEX IF NOT EXISTS comments_email_idx ON comments (lower(email));
