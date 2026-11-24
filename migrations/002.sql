ALTER TABLE orders ADD COLUMN lot_id TEXT;
CREATE TABLE notification_queue (id INTEGER PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), text TEXT NOT NULL, created INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, next_try INTEGER NOT NULL, UNIQUE(user_id,text));
