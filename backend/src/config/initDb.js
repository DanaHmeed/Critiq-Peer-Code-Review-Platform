// src/config/initDb.js
require('dotenv').config()
const { pool } = require('./db')

const schema = `
-- ── Extensions ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── users ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100)        NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255)        NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'requester'
                  CHECK (role IN ('requester', 'reviewer', 'admin', 'suspended')),
  bio           TEXT,
  avg_response_time INTERVAL,
  review_count  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('requester', 'reviewer', 'admin', 'suspended'));

-- ── review_requests ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  language      VARCHAR(50)  NOT NULL,
  code          TEXT         NOT NULL,
  urgency       VARCHAR(20)  NOT NULL DEFAULT 'normal'
                  CHECK (urgency IN ('low', 'normal', 'high')),
  status        VARCHAR(20)  NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'in-review', 'completed', 'rejected')),
  author_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_id   UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── comments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id    UUID NOT NULL REFERENCES review_requests(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES users(id)           ON DELETE CASCADE,
  line_number   INTEGER NOT NULL,
  text          TEXT    NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── notifications ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(50) NOT NULL,
  message       TEXT        NOT NULL,
  reference_id  UUID,
  is_read       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_requests_author   ON review_requests(author_id);
CREATE INDEX IF NOT EXISTS idx_requests_reviewer ON review_requests(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_requests_status   ON review_requests(status);
CREATE INDEX IF NOT EXISTS idx_comments_request  ON comments(request_id);
CREATE INDEX IF NOT EXISTS idx_notifs_user       ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifs_read       ON notifications(user_id, is_read);

-- ── updated_at trigger ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at           ON users;
DROP TRIGGER IF EXISTS trg_requests_updated_at        ON review_requests;
DROP TRIGGER IF EXISTS trg_comments_updated_at        ON comments;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_requests_updated_at
  BEFORE UPDATE ON review_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
`

async function initDb() {
  try {
    console.log('⏳  Initialising database schema...')
    await pool.query(schema)
    console.log('✅  All tables created successfully.')
  } catch (err) {
    console.error('❌  Schema init failed:', err.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

initDb()
