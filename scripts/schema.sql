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
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expires ON sessions(expires);
CREATE INDEX IF NOT EXISTS entries_owner ON entries(json_extract(data, '$.ownerId'));
CREATE INDEX IF NOT EXISTS entries_visibility ON entries(json_extract(data, '$.visibility'));
CREATE TABLE IF NOT EXISTS ai_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL CHECK(json_valid(data)),
  encrypted_key TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS menu_shares (
  owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  entry_ids TEXT NOT NULL CHECK(json_valid(entry_ids)),
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS menu_orders (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL,
  request_id TEXT NOT NULL,
  data TEXT NOT NULL CHECK(json_valid(data)),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  UNIQUE(share_token, request_id)
);
CREATE INDEX IF NOT EXISTS menu_orders_owner ON menu_orders(owner_id,created_at DESC);
CREATE TABLE IF NOT EXISTS request_limits (
  id TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS request_limits_expires ON request_limits(expires);
CREATE TABLE IF NOT EXISTS meal_records (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  data TEXT NOT NULL CHECK(json_valid(data)),
  visited_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS meal_records_entry ON meal_records(entry_id,visited_at DESC,created_at DESC);
