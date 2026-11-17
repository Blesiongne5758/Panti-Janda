-- Product photo URLs are stored on the listing so catalogue and detail queries
-- can return them with the existing row, while keeping a bounded gallery size.
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_photos_max_five
  CHECK (cardinality(photos) <= 5);
