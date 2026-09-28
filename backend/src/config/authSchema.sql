-- Additive migration; do not merge existing accounts implicitly.
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_github_id_unique ON users (github_id);
-- Fails instead of silently merging pre-existing case-only duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id);
CREATE TABLE IF NOT EXISTS github_handoffs (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
