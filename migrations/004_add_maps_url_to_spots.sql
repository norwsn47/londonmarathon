-- Add Google Maps link to spectator spots
ALTER TABLE spectator_spots ADD COLUMN maps_url TEXT NOT NULL DEFAULT '';
