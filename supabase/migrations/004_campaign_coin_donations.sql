-- Repair the incomplete campaign coin migration. The complete transaction RPC,
-- idempotency key, and XP logic are defined in migration 007.
BEGIN;

ALTER TABLE campaign_donations ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'idr';
ALTER TABLE campaign_donations ADD COLUMN IF NOT EXISTS coin_amount integer;
ALTER TABLE campaign_donations ADD COLUMN IF NOT EXISTS supporter_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS campaign_donations_supporter_account_id_idx
  ON campaign_donations(supporter_account_id, created_at DESC);

COMMIT;
