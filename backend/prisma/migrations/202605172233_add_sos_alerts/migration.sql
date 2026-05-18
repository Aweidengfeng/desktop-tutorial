CREATE TABLE IF NOT EXISTS "sos_alerts" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER,
  "lat" REAL,
  "lng" REAL,
  "accuracy" REAL,
  "timestamp" DATETIME NOT NULL,
  "phone" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sos_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
