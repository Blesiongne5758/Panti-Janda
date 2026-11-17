ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 1;

ALTER TABLE marketplace_listings
  DROP CONSTRAINT IF EXISTS marketplace_listings_stock_nonnegative;

ALTER TABLE marketplace_listings
  ADD CONSTRAINT marketplace_listings_stock_nonnegative CHECK (stock >= 0);
