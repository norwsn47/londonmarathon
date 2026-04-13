CREATE TABLE IF NOT EXISTS official_markers (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  distance_km REAL NOT NULL DEFAULT 0,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_official_markers_sort ON official_markers(sort_order);

CREATE TABLE IF NOT EXISTS spectator_spots (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  distance_km       REAL NOT NULL DEFAULT 0,
  distance_mile     REAL NOT NULL DEFAULT 0,
  lat               REAL NOT NULL,
  lng               REAL NOT NULL,
  nearest_stations  TEXT NOT NULL DEFAULT '[]',
  crowd_notes       TEXT NOT NULL DEFAULT '',
  sort_order        INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_spectator_spots_sort ON spectator_spots(sort_order);
CREATE INDEX IF NOT EXISTS idx_spectator_spots_dist ON spectator_spots(distance_km);
