BEGIN;

-- Account category is independent of the role/level ladder. Existing rows are
-- backfilled once; new non-janda registrations use account_kind='non_janda'.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_kind text;
UPDATE accounts
SET account_kind = CASE
  WHEN role IN ('wonder_woman', 'sosialita', 'high_society', 'the_ceo') THEN 'janda'
  WHEN role = 'admin' THEN 'admin'
  ELSE 'non_janda'
END
WHERE account_kind IS NULL;
ALTER TABLE accounts ALTER COLUMN account_kind SET DEFAULT 'non_janda';
ALTER TABLE accounts ALTER COLUMN account_kind SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'accounts'::regclass AND conname = 'accounts_account_kind_check'
  ) THEN
    ALTER TABLE accounts ADD CONSTRAINT accounts_account_kind_check
      CHECK (account_kind IN ('janda', 'non_janda', 'admin'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION sync_account_kind_from_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    NEW.account_kind := 'admin';
  ELSIF NEW.role IN ('wonder_woman', 'sosialita', 'high_society', 'the_ceo') THEN
    NEW.account_kind := 'janda';
  ELSE
    NEW.account_kind := 'non_janda';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS accounts_sync_account_kind ON accounts;
CREATE TRIGGER accounts_sync_account_kind
BEFORE INSERT OR UPDATE OF role, account_kind ON accounts
FOR EACH ROW EXECUTE FUNCTION sync_account_kind_from_role();

INSERT INTO profiles(id, account_id, nickname, tier, full_name, status, verified_at, created_at, updated_at)
SELECT gen_random_uuid(), a.id,
       COALESCE(NULLIF(trim(a.display_name), ''), split_part(a.email, '@', 1)),
       NULL, NULL, 'verified', NULL, now(), now()
FROM accounts a
LEFT JOIN profiles p ON p.account_id = a.id
WHERE a.account_kind = 'non_janda' AND p.id IS NULL
ON CONFLICT (account_id) DO NOTHING;

-- Campaign donations and marketplace prices keep IDR and coin amounts separate.
ALTER TABLE campaign_donations ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'idr';
ALTER TABLE campaign_donations ADD COLUMN IF NOT EXISTS coin_amount integer;
ALTER TABLE campaign_donations ADD COLUMN IF NOT EXISTS supporter_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE campaign_donations ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS campaign_donations_request_id_uidx
  ON campaign_donations(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS campaign_donations_supporter_account_id_idx
  ON campaign_donations(supporter_account_id, created_at DESC);

ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS coin_price integer;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'marketplace_listings'::regclass AND conname = 'marketplace_listings_coin_price_check'
  ) THEN
    ALTER TABLE marketplace_listings ADD CONSTRAINT marketplace_listings_coin_price_check
      CHECK (coin_price IS NULL OR coin_price > 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS coin_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key uuid NOT NULL UNIQUE,
  sender_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  recipient_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount integer NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_account_id <> recipient_account_id)
);
CREATE INDEX IF NOT EXISTS coin_gifts_sender_created_idx
  ON coin_gifts(sender_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS coin_gifts_recipient_created_idx
  ON coin_gifts(recipient_account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_coin_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key uuid NOT NULL UNIQUE,
  listing_id uuid NOT NULL UNIQUE REFERENCES marketplace_listings(id) ON DELETE RESTRICT,
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  seller_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount_coins integer NOT NULL CHECK (amount_coins > 0),
  status text NOT NULL DEFAULT 'completed' CHECK (status = 'completed'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_account_id <> seller_account_id)
);
CREATE INDEX IF NOT EXISTS marketplace_coin_orders_buyer_created_idx
  ON marketplace_coin_orders(buyer_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_coin_orders_seller_created_idx
  ON marketplace_coin_orders(seller_account_id, created_at DESC);

-- A dedicated claim table makes the new XP sources idempotent without imposing
-- uniqueness on legacy event/attendance logs, which may contain duplicates.
CREATE TABLE IF NOT EXISTS contribution_xp_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  points integer NOT NULL CHECK (points > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, source_type, source_id)
);

ALTER TABLE coin_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_coin_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_xp_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE coin_gifts, marketplace_coin_orders, contribution_xp_claims FROM anon, authenticated;
GRANT ALL ON TABLE coin_gifts, marketplace_coin_orders, contribution_xp_claims TO service_role;

CREATE OR REPLACE FUNCTION contribution_level_from_xp(p_xp bigint)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_level integer;
  v_threshold bigint;
BEGIN
  FOR v_level IN REVERSE 50..2 LOOP
    v_threshold := 100::bigint * (v_level - 1) * v_level * (2 * v_level - 1) / 6;
    IF p_xp >= v_threshold THEN
      RETURN v_level;
    END IF;
  END LOOP;
  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION record_contribution_xp(
  p_account_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_points integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claim_id uuid;
  v_account record;
  v_total_points bigint;
  v_next_xp bigint;
  v_next_level integer;
  v_suggested_role text;
  v_suggested_rank integer;
  v_current_rank integer;
BEGIN
  IF p_points IS NULL OR p_points <= 0 OR p_source_type IS NULL OR p_source_id IS NULL THEN
    RAISE EXCEPTION 'invalid_xp_award';
  END IF;

  INSERT INTO contribution_xp_claims(account_id, source_type, source_id, points)
  VALUES (p_account_id, p_source_type, p_source_id, p_points)
  ON CONFLICT (account_id, source_type, source_id) DO NOTHING
  RETURNING id INTO v_claim_id;
  IF v_claim_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id, account_kind, role, level, xp
  INTO v_account
  FROM accounts
  WHERE id = p_account_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found';
  END IF;

  INSERT INTO kpi_logs(account_id, source_type, source_id, points, created_at)
  VALUES (p_account_id, p_source_type, p_source_id, p_points, now());

  SELECT COALESCE(SUM(points), 0)::bigint
  INTO v_total_points
  FROM kpi_logs
  WHERE account_id = p_account_id;
  v_next_xp := GREATEST(v_total_points, COALESCE(v_account.xp, 0)::bigint);
  v_next_level := GREATEST(contribution_level_from_xp(v_next_xp), COALESCE(v_account.level, 1));

  IF v_account.account_kind = 'janda' THEN
    v_suggested_role := CASE
      WHEN v_next_level >= 46 THEN 'the_ceo'
      WHEN v_next_level >= 36 THEN 'high_society'
      WHEN v_next_level >= 21 THEN 'sosialita'
      ELSE 'wonder_woman'
    END;
  ELSIF v_account.account_kind = 'non_janda' THEN
    v_suggested_role := CASE
      WHEN v_next_level >= 50 THEN 'presiden'
      WHEN v_next_level >= 45 THEN 'panglima'
      WHEN v_next_level >= 35 THEN 'gubernur'
      WHEN v_next_level >= 25 THEN 'walikota'
      WHEN v_next_level >= 15 THEN 'kades'
      ELSE 'public'
    END;
  ELSE
    v_suggested_role := v_account.role;
  END IF;

  v_current_rank := CASE v_account.role
    WHEN 'public' THEN 1
    WHEN 'kades' THEN 2
    WHEN 'wonder_woman' THEN 2
    WHEN 'walikota' THEN 3
    WHEN 'sosialita' THEN 3
    WHEN 'gubernur' THEN 4
    WHEN 'high_society' THEN 4
    WHEN 'panglima' THEN 5
    WHEN 'the_ceo' THEN 5
    WHEN 'presiden' THEN 6
    WHEN 'sultan' THEN 6
    WHEN 'ceo' THEN 7
    WHEN 'admin' THEN 8
    ELSE 0
  END;
  v_suggested_rank := CASE v_suggested_role
    WHEN 'public' THEN 1
    WHEN 'kades' THEN 2
    WHEN 'wonder_woman' THEN 2
    WHEN 'walikota' THEN 3
    WHEN 'sosialita' THEN 3
    WHEN 'gubernur' THEN 4
    WHEN 'high_society' THEN 4
    WHEN 'panglima' THEN 5
    WHEN 'the_ceo' THEN 5
    WHEN 'presiden' THEN 6
    WHEN 'sultan' THEN 6
    WHEN 'ceo' THEN 7
    WHEN 'admin' THEN 8
    ELSE 0
  END;

  UPDATE accounts
  SET xp = v_next_xp::integer,
      level = v_next_level,
      role = CASE WHEN v_suggested_rank > v_current_rank THEN v_suggested_role ELSE role END
  WHERE id = p_account_id;

  INSERT INTO kpi_summary(account_id, total_points, level, updated_at)
  VALUES (p_account_id, v_next_xp::integer, v_next_level, now())
  ON CONFLICT (account_id) DO UPDATE
    SET total_points = EXCLUDED.total_points,
        level = EXCLUDED.level,
        updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION gift_coins(
  p_sender_account_id uuid,
  p_recipient_account_id uuid,
  p_amount integer,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gift coin_gifts%ROWTYPE;
  v_sender_balance integer;
  v_recipient_balance integer;
  v_sender_status text;
  v_recipient_status text;
  v_sender_after integer;
  v_recipient_after integer;
  v_gift_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF p_sender_account_id = p_recipient_account_id THEN
    RAISE EXCEPTION 'cannot_gift_self';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gift:' || p_idempotency_key::text));
  SELECT * INTO v_gift FROM coin_gifts WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_gift.sender_account_id <> p_sender_account_id
       OR v_gift.recipient_account_id <> p_recipient_account_id
       OR v_gift.amount <> p_amount THEN
      RAISE EXCEPTION 'idempotency_conflict';
    END IF;
    SELECT balance INTO v_sender_after FROM coin_balances WHERE account_id = p_sender_account_id;
    RETURN jsonb_build_object('gift_id', v_gift.id, 'amount', v_gift.amount,
      'new_balance', COALESCE(v_sender_after, 0), 'replayed', true);
  END IF;

  SELECT status INTO v_sender_status FROM accounts WHERE id = p_sender_account_id;
  SELECT status INTO v_recipient_status FROM accounts WHERE id = p_recipient_account_id;
  IF v_sender_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'account_inactive'; END IF;
  IF v_recipient_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'recipient_not_found'; END IF;

  INSERT INTO coin_balances(account_id, balance, lifetime_purchased, lifetime_spent, updated_at)
  VALUES (LEAST(p_sender_account_id, p_recipient_account_id), 0, 0, 0, now())
  ON CONFLICT (account_id) DO NOTHING;
  INSERT INTO coin_balances(account_id, balance, lifetime_purchased, lifetime_spent, updated_at)
  VALUES (GREATEST(p_sender_account_id, p_recipient_account_id), 0, 0, 0, now())
  ON CONFLICT (account_id) DO NOTHING;
  PERFORM 1 FROM coin_balances
  WHERE account_id IN (p_sender_account_id, p_recipient_account_id)
  ORDER BY account_id FOR UPDATE;

  SELECT balance INTO v_sender_balance FROM coin_balances WHERE account_id = p_sender_account_id;
  SELECT balance INTO v_recipient_balance FROM coin_balances WHERE account_id = p_recipient_account_id;
  IF v_sender_balance < p_amount THEN RAISE EXCEPTION 'insufficient_coins'; END IF;

  INSERT INTO coin_gifts(idempotency_key, sender_account_id, recipient_account_id, amount)
  VALUES (p_idempotency_key, p_sender_account_id, p_recipient_account_id, p_amount)
  RETURNING id INTO v_gift_id;
  v_sender_after := v_sender_balance - p_amount;
  v_recipient_after := v_recipient_balance + p_amount;
  UPDATE coin_balances
  SET balance = CASE WHEN account_id = p_sender_account_id THEN v_sender_after ELSE v_recipient_after END,
      lifetime_spent = CASE WHEN account_id = p_sender_account_id THEN lifetime_spent + p_amount ELSE lifetime_spent END,
      updated_at = now()
  WHERE account_id IN (p_sender_account_id, p_recipient_account_id);

  INSERT INTO coin_transactions(account_id, type, amount, balance_after, description, reference_id, created_at)
  VALUES
    (p_sender_account_id, 'gift_sent', -p_amount, v_sender_after, 'Gift koin dikirim', v_gift_id::text, now()),
    (p_recipient_account_id, 'gift_received', p_amount, v_recipient_after, 'Gift koin diterima', v_gift_id::text, now());
  PERFORM record_contribution_xp(p_sender_account_id, 'gift_send', v_gift_id, 20);

  RETURN jsonb_build_object('gift_id', v_gift_id, 'amount', p_amount,
    'new_balance', v_sender_after, 'replayed', false);
END;
$$;

CREATE OR REPLACE FUNCTION donate_campaign_with_coins(
  p_account_id uuid,
  p_campaign_id uuid,
  p_coin_amount integer,
  p_rupiah_amount integer,
  p_order_id text,
  p_idempotency_key uuid,
  p_supporter_name text,
  p_supporter_email text,
  p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_campaign campaigns%ROWTYPE;
  v_donation campaign_donations%ROWTYPE;
  v_balance integer;
  v_balance_after integer;
  v_donation_id uuid;
  v_account_status text;
BEGIN
  IF p_coin_amount IS NULL OR p_coin_amount <= 0 OR p_rupiah_amount IS NULL OR p_rupiah_amount <= 0
     OR p_idempotency_key IS NULL OR p_order_id IS NULL OR length(p_order_id) > 100 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('campaign-donate:' || p_idempotency_key::text));
  SELECT * INTO v_donation FROM campaign_donations WHERE request_id = p_idempotency_key;
  IF FOUND THEN
    IF v_donation.supporter_account_id <> p_account_id
       OR v_donation.campaign_id <> p_campaign_id
       OR v_donation.coin_amount <> p_coin_amount THEN
      RAISE EXCEPTION 'idempotency_conflict';
    END IF;
    SELECT balance INTO v_balance_after FROM coin_balances WHERE account_id = p_account_id;
    RETURN jsonb_build_object('donation_id', v_donation.id, 'order_id', v_donation.order_id,
      'new_balance', COALESCE(v_balance_after, 0), 'replayed', true);
  END IF;

  SELECT status INTO v_account_status FROM accounts WHERE id = p_account_id;
  IF v_account_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'account_inactive'; END IF;
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR v_campaign.status <> 'open' THEN RAISE EXCEPTION 'campaign_not_open'; END IF;

  INSERT INTO coin_balances(account_id, balance, lifetime_purchased, lifetime_spent, updated_at)
  VALUES (p_account_id, 0, 0, 0, now()) ON CONFLICT (account_id) DO NOTHING;
  SELECT balance INTO v_balance FROM coin_balances WHERE account_id = p_account_id FOR UPDATE;
  IF v_balance < p_coin_amount THEN RAISE EXCEPTION 'insufficient_coins'; END IF;

  INSERT INTO campaign_donations(
    campaign_id, order_id, amount, supporter_name, supporter_email, message, status,
    currency, coin_amount, supporter_account_id, request_id, created_at
  ) VALUES (
    p_campaign_id, p_order_id, p_rupiah_amount,
    COALESCE(NULLIF(trim(p_supporter_name), ''), 'Sahabat Panti Janda'),
    NULLIF(trim(p_supporter_email), ''), NULLIF(trim(p_message), ''), 'settled',
    'coins', p_coin_amount, p_account_id, p_idempotency_key, now()
  ) RETURNING id INTO v_donation_id;

  v_balance_after := v_balance - p_coin_amount;
  UPDATE coin_balances
  SET balance = v_balance_after, lifetime_spent = lifetime_spent + p_coin_amount, updated_at = now()
  WHERE account_id = p_account_id;
  INSERT INTO coin_transactions(account_id, type, amount, balance_after, description, reference_id, created_at)
  VALUES (p_account_id, 'campaign_donation', -p_coin_amount, v_balance_after,
    'Donasi kampanye dengan koin', v_donation_id::text, now());
  UPDATE campaigns
  SET collected_amount = collected_amount + p_rupiah_amount,
      donor_count = donor_count + 1
  WHERE id = p_campaign_id;
  PERFORM record_contribution_xp(p_account_id, 'campaign_coin_donate', v_donation_id, 20);

  RETURN jsonb_build_object('donation_id', v_donation_id, 'order_id', p_order_id,
    'amount', p_rupiah_amount, 'coin_amount', p_coin_amount,
    'new_balance', v_balance_after, 'replayed', false);
END;
$$;

CREATE OR REPLACE FUNCTION buy_marketplace_listing_with_coins(
  p_buyer_account_id uuid,
  p_listing_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_listing marketplace_listings%ROWTYPE;
  v_order marketplace_coin_orders%ROWTYPE;
  v_seller_account_id uuid;
  v_buyer_balance integer;
  v_seller_balance integer;
  v_buyer_after integer;
  v_seller_after integer;
  v_order_id uuid;
  v_buyer_status text;
  v_seller_status text;
BEGIN
  IF p_buyer_account_id IS NULL OR p_listing_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('marketplace-buy:' || p_idempotency_key::text));
  SELECT * INTO v_order FROM marketplace_coin_orders WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_order.buyer_account_id <> p_buyer_account_id OR v_order.listing_id <> p_listing_id THEN
      RAISE EXCEPTION 'idempotency_conflict';
    END IF;
    SELECT balance INTO v_buyer_after FROM coin_balances WHERE account_id = p_buyer_account_id;
    RETURN jsonb_build_object('order_id', v_order.id, 'coin_amount', v_order.amount_coins,
      'new_balance', COALESCE(v_buyer_after, 0), 'replayed', true);
  END IF;

  SELECT status INTO v_buyer_status FROM accounts WHERE id = p_buyer_account_id;
  IF v_buyer_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'account_inactive'; END IF;
  SELECT * INTO v_listing FROM marketplace_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND OR v_listing.status <> 'active' THEN RAISE EXCEPTION 'listing_unavailable'; END IF;
  IF v_listing.coin_price IS NULL OR v_listing.coin_price <= 0 THEN RAISE EXCEPTION 'coin_price_unavailable'; END IF;
  SELECT account_id INTO v_seller_account_id FROM profiles WHERE id = v_listing.seller_profile_id;
  IF v_seller_account_id IS NULL THEN RAISE EXCEPTION 'seller_not_found'; END IF;
  IF v_seller_account_id = p_buyer_account_id THEN RAISE EXCEPTION 'cannot_buy_own_listing'; END IF;
  SELECT status INTO v_seller_status FROM accounts WHERE id = v_seller_account_id;
  IF v_seller_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'listing_unavailable'; END IF;

  INSERT INTO coin_balances(account_id, balance, lifetime_purchased, lifetime_spent, updated_at)
  VALUES (LEAST(p_buyer_account_id, v_seller_account_id), 0, 0, 0, now())
  ON CONFLICT (account_id) DO NOTHING;
  INSERT INTO coin_balances(account_id, balance, lifetime_purchased, lifetime_spent, updated_at)
  VALUES (GREATEST(p_buyer_account_id, v_seller_account_id), 0, 0, 0, now())
  ON CONFLICT (account_id) DO NOTHING;
  PERFORM 1 FROM coin_balances
  WHERE account_id IN (p_buyer_account_id, v_seller_account_id)
  ORDER BY account_id FOR UPDATE;
  SELECT balance INTO v_buyer_balance FROM coin_balances WHERE account_id = p_buyer_account_id;
  SELECT balance INTO v_seller_balance FROM coin_balances WHERE account_id = v_seller_account_id;
  IF v_buyer_balance < v_listing.coin_price THEN RAISE EXCEPTION 'insufficient_coins'; END IF;

  INSERT INTO marketplace_coin_orders(idempotency_key, listing_id, buyer_account_id, seller_account_id, amount_coins, status, created_at)
  VALUES (p_idempotency_key, p_listing_id, p_buyer_account_id, v_seller_account_id, v_listing.coin_price, 'completed', now())
  RETURNING id INTO v_order_id;
  v_buyer_after := v_buyer_balance - v_listing.coin_price;
  v_seller_after := v_seller_balance + v_listing.coin_price;
  UPDATE coin_balances
  SET balance = CASE WHEN account_id = p_buyer_account_id THEN v_buyer_after ELSE v_seller_after END,
      lifetime_spent = CASE WHEN account_id = p_buyer_account_id THEN lifetime_spent + v_listing.coin_price ELSE lifetime_spent END,
      updated_at = now()
  WHERE account_id IN (p_buyer_account_id, v_seller_account_id);
  INSERT INTO coin_transactions(account_id, type, amount, balance_after, description, reference_id, created_at)
  VALUES
    (p_buyer_account_id, 'marketplace_purchase', -v_listing.coin_price, v_buyer_after,
      'Pembelian marketplace: ' || left(v_listing.title, 100), v_order_id::text, now()),
    (v_seller_account_id, 'marketplace_sale', v_listing.coin_price, v_seller_after,
      'Penjualan marketplace: ' || left(v_listing.title, 100), v_order_id::text, now());
  UPDATE marketplace_listings SET status = 'sold', updated_at = now() WHERE id = p_listing_id;
  PERFORM record_contribution_xp(p_buyer_account_id, 'marketplace_purchase', v_order_id, 20);

  RETURN jsonb_build_object('order_id', v_order_id, 'coin_amount', v_listing.coin_price,
    'new_balance', v_buyer_after, 'replayed', false);
END;
$$;

REVOKE ALL ON FUNCTION record_contribution_xp(uuid, text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION gift_coins(uuid, uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION donate_campaign_with_coins(uuid, uuid, integer, integer, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION buy_marketplace_listing_with_coins(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION gift_coins(uuid, uuid, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION donate_campaign_with_coins(uuid, uuid, integer, integer, text, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION buy_marketplace_listing_with_coins(uuid, uuid, uuid) TO service_role;

COMMIT;
