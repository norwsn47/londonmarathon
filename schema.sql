CREATE TABLE IF NOT EXISTS markers (
  id          TEXT PRIMARY KEY,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type        TEXT NOT NULL DEFAULT 'user'
);
