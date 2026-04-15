-- Add source URL to spectator spots
ALTER TABLE spectator_spots ADD COLUMN url TEXT NOT NULL DEFAULT '';
