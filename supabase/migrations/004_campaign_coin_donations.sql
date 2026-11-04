-- Store campaign donation currency and its coin equivalent for transparent reporting.
ALTER TABLE public.campaign_donations
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'idr',
  ADD COLUMN IF NOT EXISTS coin_amount integer,
  ADD COLUMN IF NOT EXISTS supporter_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaign_donations_currency_check'
      AND conrelid = 'public.campaign_donations'::regclass
  ) THEN
    ALTER TABLE public.campaign_donations
      ADD CONSTRAINT campaign_donations_currency_check
      CHECK (currency IN ('idr', 'coins'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_campaign_donations_supporter
  ON public.campaign_donations(supporter_account_id);

CREATE OR REPLACE FUNCTION public.donate_campaign_with_coins(
  p_account_id uuid,
  p_campaign_id uuid,
  p_coin_amount integer,
  p_rupiah_amount integer,
  p_order_id text,
  p_supporter_name text,
  p_supporter_email text,
  p_message text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
  v_lifetime_spent integer;
  v_new_balance integer;
  v_campaign_title text;
BEGIN
  IF p_coin_amount <= 0 OR p_rupiah_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT title INTO v_campaign_title
  FROM campaigns
  WHERE id = p_campaign_id AND status = 'open'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign_not_open'; END IF;

  SELECT balance, lifetime_spent INTO v_balance, v_lifetime_spent
  FROM coin_balances
  WHERE account_id = p_account_id
  FOR UPDATE;
  IF NOT FOUND OR v_balance < p_coin_amount THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  v_new_balance := v_balance - p_coin_amount;
  UPDATE coin_balances
  SET balance = v_new_balance,
      lifetime_spent = COALESCE(v_lifetime_spent, 0) + p_coin_amount,
      updated_at = now()
  WHERE account_id = p_account_id;

  INSERT INTO campaign_donations (
    campaign_id, order_id, amount, currency, coin_amount, supporter_account_id,
    supporter_name, supporter_email, message, status, created_at
  ) VALUES (
    p_campaign_id, p_order_id, p_rupiah_amount, 'coins', p_coin_amount, p_account_id,
    p_supporter_name, p_supporter_email, p_message, 'settled', now()
  );

  INSERT INTO coin_transactions (
    account_id, type, amount, balance_after, description, reference_id, created_at
  ) VALUES (
    p_account_id, 'spend', p_coin_amount, v_new_balance,
    'Donasi kampanye: ' || v_campaign_title, p_order_id, now()
  );

  UPDATE campaigns
  SET collected_amount = collected_amount + p_rupiah_amount,
      donor_count = donor_count + 1
  WHERE id = p_campaign_id;

  RETURN jsonb_build_object('newBalance', v_new_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.donate_campaign_with_coins(uuid, uuid, integer, integer, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.donate_campaign_with_coins(uuid, uuid, integer, integer, text, text, text, text) TO service_role;
