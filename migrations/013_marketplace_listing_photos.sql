-- Product photo URLs are stored on the listing so catalogue and detail queries
-- can return them with the existing row, while keeping a bounded gallery size.
ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'marketplace_listings'::regclass
      AND conname = 'marketplace_listings_photos_max_five'
  ) THEN
    ALTER TABLE marketplace_listings
      ADD CONSTRAINT marketplace_listings_photos_max_five
      CHECK (cardinality(photos) <= 5);
  END IF;
END $$;
