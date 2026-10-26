CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK (json_valid(data)),
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS entries_updated_at ON entries(updated_at DESC);
CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS login_attempts_expires ON login_attempts(expires);
