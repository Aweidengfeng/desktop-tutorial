-- Migration: add feedback table
CREATE TABLE IF NOT EXISTS "feedback" (
  "id"         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "user_id"    INTEGER,
  "type"       TEXT NOT NULL DEFAULT 'general',
  "content"    TEXT NOT NULL,
  "contact"    TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
