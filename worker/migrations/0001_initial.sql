PRAGMA foreign_keys = ON;

CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  price REAL CHECK (price IS NULL OR price >= 0),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  agreed_by TEXT NOT NULL CHECK (json_valid(agreed_by) AND json_type(agreed_by) = 'array'),
  is_purchased_at TEXT,
  is_purchased_by TEXT,
  archived_at TEXT,
  archived_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  CHECK ((is_purchased_at IS NULL) = (is_purchased_by IS NULL)),
  CHECK ((archived_at IS NULL) = (archived_by IS NULL))
);

CREATE TABLE purchase_comments (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL,
  comment_type TEXT NOT NULL CHECK (comment_type IN ('user', 'action')),
  action_type TEXT,
  content TEXT NOT NULL,
  details_json TEXT CHECK (details_json IS NULL OR json_valid(details_json)),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE RESTRICT,
  CHECK (
    (comment_type = 'user' AND action_type IS NULL AND details_json IS NULL) OR
    (comment_type = 'action' AND action_type IS NOT NULL AND details_json IS NOT NULL)
  )
);

CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE telegram_updates (
  update_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  received_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  failed_at TEXT,
  error TEXT
);

CREATE TABLE pending_purchase_additions (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  candidate_json TEXT NOT NULL CHECK (json_valid(candidate_json) AND json_type(candidate_json) = 'object'),
  similar_purchase_ids TEXT NOT NULL CHECK (json_valid(similar_purchase_ids) AND json_type(similar_purchase_ids) = 'array'),
  status TEXT NOT NULL CHECK (status IN ('awaiting_confirmation', 'confirmed', 'cancelled', 'completed', 'expired')),
  created_update_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE application_locks (
  name TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TRIGGER purchases_agreed_by_insert
BEFORE INSERT ON purchases
BEGIN
  SELECT CASE WHEN NOT json_valid(NEW.agreed_by) THEN RAISE(ABORT, 'agreed_by must be valid JSON') END;
  SELECT CASE WHEN json_type(NEW.agreed_by) <> 'array' THEN RAISE(ABORT, 'agreed_by must be an array') END;
  SELECT CASE WHEN json_array_length(NEW.agreed_by) < 1 THEN RAISE(ABORT, 'agreed_by must not be empty') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM json_each(NEW.agreed_by) WHERE type <> 'text' OR trim(CAST(value AS TEXT)) = ''
  ) THEN RAISE(ABORT, 'agreed_by entries must be non-empty text') END;
  SELECT CASE WHEN (
    SELECT count(*) FROM json_each(NEW.agreed_by)
  ) <> (
    SELECT count(DISTINCT CAST(value AS TEXT)) FROM json_each(NEW.agreed_by)
  ) THEN RAISE(ABORT, 'agreed_by entries must be unique') END;
END;

CREATE TRIGGER purchases_agreed_by_update
BEFORE UPDATE OF agreed_by ON purchases
BEGIN
  SELECT CASE WHEN NOT json_valid(NEW.agreed_by) THEN RAISE(ABORT, 'agreed_by must be valid JSON') END;
  SELECT CASE WHEN json_type(NEW.agreed_by) <> 'array' THEN RAISE(ABORT, 'agreed_by must be an array') END;
  SELECT CASE WHEN json_array_length(NEW.agreed_by) < 1 THEN RAISE(ABORT, 'agreed_by must not be empty') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM json_each(NEW.agreed_by) WHERE type <> 'text' OR trim(CAST(value AS TEXT)) = ''
  ) THEN RAISE(ABORT, 'agreed_by entries must be non-empty text') END;
  SELECT CASE WHEN (
    SELECT count(*) FROM json_each(NEW.agreed_by)
  ) <> (
    SELECT count(DISTINCT CAST(value AS TEXT)) FROM json_each(NEW.agreed_by)
  ) THEN RAISE(ABORT, 'agreed_by entries must be unique') END;
END;

CREATE INDEX idx_purchases_archive_purchase ON purchases(archived_at, is_purchased_at, updated_at DESC);
CREATE INDEX idx_purchase_comments_purchase_created ON purchase_comments(purchase_id, created_at, id);
CREATE INDEX idx_chat_messages_chat_recent ON chat_messages(chat_id, id DESC);
CREATE INDEX idx_telegram_updates_status_updated ON telegram_updates(status, updated_at);
CREATE INDEX idx_pending_additions_owner_status ON pending_purchase_additions(chat_id, user_id, status, expires_at);
CREATE INDEX idx_pending_additions_expiry ON pending_purchase_additions(status, expires_at);
