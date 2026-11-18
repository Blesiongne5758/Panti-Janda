BEGIN;

-- Read receipts snapshot recipients when each message is sent. Only the sender
-- can use the API's aggregate status; a recipient can mark their own row read.
CREATE TABLE IF NOT EXISTS message_receipts (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  recipient_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, recipient_account_id)
);
CREATE INDEX IF NOT EXISTS message_receipts_recipient_unread_idx
  ON message_receipts (recipient_account_id, message_id) WHERE read_at IS NULL;
ALTER TABLE message_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Message receipts: recipient or sender read" ON message_receipts;
CREATE POLICY "Message receipts: recipient or sender read" ON message_receipts FOR SELECT USING (
  recipient_account_id = auth.uid() OR EXISTS (
    SELECT 1 FROM messages m WHERE m.id = message_id AND m.sender_account_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Message receipts: recipient marks own read" ON message_receipts;
CREATE POLICY "Message receipts: recipient marks own read" ON message_receipts FOR UPDATE
  USING (recipient_account_id = auth.uid())
  WITH CHECK (recipient_account_id = auth.uid() AND read_at IS NOT NULL);

-- Competition mode and venue validation.
ALTER TABLE esport_tournaments
  ADD COLUMN IF NOT EXISTS competition_mode text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS venue_name text,
  ADD COLUMN IF NOT EXISTS venue_address text,
  ADD COLUMN IF NOT EXISTS venue_maps_url text;
DO $$ BEGIN
  ALTER TABLE esport_tournaments ADD CONSTRAINT esport_tournaments_competition_mode_check
    CHECK (competition_mode IN ('online', 'onsite'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE esport_tournaments ADD CONSTRAINT esport_tournaments_onsite_venue_check
    CHECK (competition_mode <> 'onsite' OR (length(trim(coalesce(venue_name, ''))) > 0 AND length(trim(coalesce(venue_address, ''))) > 0));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sponsor roster and tournament committee.
CREATE TABLE IF NOT EXISTS esport_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES esport_tournaments(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  logo_url text,
  website_url text,
  is_primary boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, name)
);
CREATE UNIQUE INDEX IF NOT EXISTS esport_sponsors_one_primary_idx
  ON esport_sponsors (tournament_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS esport_sponsors_tournament_idx
  ON esport_sponsors (tournament_id, is_primary DESC, created_at);
CREATE TABLE IF NOT EXISTS esport_tournament_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES esport_tournaments(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('Ketua panitia', 'Koordinator', 'Wasit', 'Admin pertandingan', 'Operator streaming')),
  assigned_by uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, account_id)
);
CREATE INDEX IF NOT EXISTS esport_tournament_staff_account_idx
  ON esport_tournament_staff (account_id, tournament_id);

-- A competition can have exactly one private committee room. Public groups
-- remain unchanged; committee membership is managed by the authenticated app
-- handler (service role) after checking tournament ownership/staff assignment.
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS system_key text,
  ADD COLUMN IF NOT EXISTS tournament_id uuid REFERENCES esport_tournaments(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS groups_tournament_id_unique_idx
  ON groups (tournament_id) WHERE tournament_id IS NOT NULL;
DO $$ BEGIN
  ALTER TABLE groups ADD CONSTRAINT groups_tournament_private_check
    CHECK (tournament_id IS NULL OR (is_private AND system_key = 'esport_committee'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Referral attribution is single-use, self-referral-proof, and carries no reward.
CREATE TABLE IF NOT EXISTS referral_codes (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code = upper(code) AND code ~ '^[A-Z0-9]{8,16}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, code)
);
CREATE TABLE IF NOT EXISTS referral_attributions (
  referred_account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  referrer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referred_account_id <> referrer_account_id),
  FOREIGN KEY (referrer_account_id, referral_code)
    REFERENCES referral_codes(account_id, code) ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS referral_attributions_referrer_idx
  ON referral_attributions (referrer_account_id, created_at DESC);
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_attributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Referral codes: owner read" ON referral_codes;
CREATE POLICY "Referral codes: owner read" ON referral_codes FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Referral attributions: participants read" ON referral_attributions;
CREATE POLICY "Referral attributions: participants read" ON referral_attributions FOR SELECT USING (
  referred_account_id = auth.uid() OR referrer_account_id = auth.uid()
);

-- Marketplace orders are pending requests only; no payment or stock mutation.
-- Keep historical orders if a seller later removes a listing.
CREATE TABLE IF NOT EXISTS marketplace_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES marketplace_listings(id) ON DELETE RESTRICT,
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  seller_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 99),
  buyer_message text CHECK (buyer_message IS NULL OR length(buyer_message) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'fulfilled', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_account_id <> seller_account_id)
);
CREATE INDEX IF NOT EXISTS marketplace_orders_seller_status_idx
  ON marketplace_orders (seller_account_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_orders_buyer_idx
  ON marketplace_orders (buyer_account_id, created_at DESC);
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Marketplace orders: buyer or seller read" ON marketplace_orders;
CREATE POLICY "Marketplace orders: buyer or seller read" ON marketplace_orders FOR SELECT USING (
  buyer_account_id = auth.uid() OR seller_account_id = auth.uid()
);
DROP POLICY IF EXISTS "Marketplace orders: buyer creates active listing order" ON marketplace_orders;
CREATE POLICY "Marketplace orders: buyer creates active listing order" ON marketplace_orders FOR INSERT WITH CHECK (
  buyer_account_id = auth.uid() AND status = 'pending' AND EXISTS (
    SELECT 1 FROM marketplace_listings l JOIN profiles p ON p.id = l.seller_profile_id
    WHERE l.id = listing_id AND l.status = 'active' AND p.account_id = seller_account_id
      AND seller_account_id <> auth.uid()
  )
);
-- Direct table updates are intentionally disallowed; the app endpoint checks
-- seller ownership and the order-status transition before using service role.

-- Employer-created listings; candidate applications remain private.
DROP POLICY IF EXISTS "Job Listings: public read" ON job_listings;
CREATE POLICY "Job Listings: public read" ON job_listings FOR SELECT USING (
  status = 'active' OR created_by = auth.uid()
);
DROP POLICY IF EXISTS "Job Listings: insert authenticated" ON job_listings;
CREATE POLICY "Job Listings: insert authenticated" ON job_listings FOR INSERT WITH CHECK (
  created_by = auth.uid() AND auth.uid() IS NOT NULL
);
DROP POLICY IF EXISTS "Job Listings: update owner" ON job_listings;
CREATE POLICY "Job Listings: update owner" ON job_listings FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "Job Listings: delete owner" ON job_listings;
CREATE POLICY "Job Listings: delete owner" ON job_listings FOR DELETE USING (created_by = auth.uid());
DROP POLICY IF EXISTS "Job Applications: read own" ON job_applications;
CREATE POLICY "Job Applications: read own" ON job_applications FOR SELECT USING (
  account_id = auth.uid() OR EXISTS (
    SELECT 1 FROM job_listings j WHERE j.id = job_id AND j.created_by = auth.uid()
  )
);
DROP POLICY IF EXISTS "Job Applications: insert own" ON job_applications;
CREATE POLICY "Job Applications: insert own" ON job_applications FOR INSERT WITH CHECK (
  account_id = auth.uid() AND status = 'pending' AND EXISTS (
    SELECT 1 FROM job_listings j WHERE j.id = job_id AND j.status = 'active' AND j.created_by <> auth.uid()
  )
);
-- Direct updates are intentionally blocked: only the validated owner endpoint
-- can change an application status.

-- Interview schedule is attached to the exact job application and limited to
-- its employer/candidate. A composite FK prevents job/application mismatch.
DO $$ BEGIN
  ALTER TABLE job_applications ADD CONSTRAINT job_applications_id_job_unique UNIQUE (id, job_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS job_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
  application_id uuid NOT NULL UNIQUE,
  employer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  candidate_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('online', 'onsite')),
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  location text,
  note text CHECK (note IS NULL OR length(note) <= 1000),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  room_key uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (application_id, job_id) REFERENCES job_applications(id, job_id) ON DELETE CASCADE,
  CHECK (scheduled_end > scheduled_start),
  CHECK (employer_account_id <> candidate_account_id),
  CHECK (mode <> 'onsite' OR length(trim(coalesce(location, ''))) > 0)
);
CREATE INDEX IF NOT EXISTS job_interviews_employer_start_idx
  ON job_interviews (employer_account_id, scheduled_start);
CREATE INDEX IF NOT EXISTS job_interviews_candidate_start_idx
  ON job_interviews (candidate_account_id, scheduled_start);
ALTER TABLE job_interviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Job interviews: participants read" ON job_interviews;
CREATE POLICY "Job interviews: participants read" ON job_interviews FOR SELECT USING (
  employer_account_id = auth.uid() OR candidate_account_id = auth.uid()
);
DROP POLICY IF EXISTS "Job interviews: employer inserts" ON job_interviews;
CREATE POLICY "Job interviews: employer inserts" ON job_interviews FOR INSERT WITH CHECK (
  employer_account_id = auth.uid() AND EXISTS (
    SELECT 1 FROM job_listings j WHERE j.id = job_id AND j.created_by = auth.uid()
  ) AND EXISTS (
    SELECT 1 FROM job_applications a WHERE a.id = application_id AND a.job_id = job_id AND a.account_id = candidate_account_id
  )
);
-- Direct updates remain blocked; validated app endpoints own rescheduling/cancel.

-- Private committee room policies supersede the legacy public-group policies.
DROP POLICY IF EXISTS "Groups: public read" ON groups;
CREATE POLICY "Groups: public read" ON groups FOR SELECT USING (
  (NOT is_private AND tournament_id IS NULL) OR EXISTS (
    SELECT 1 FROM group_members gm WHERE gm.group_id = groups.id AND gm.account_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Groups: insert authenticated" ON groups;
CREATE POLICY "Groups: insert authenticated" ON groups FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND is_private = false AND tournament_id IS NULL
);
DROP POLICY IF EXISTS "Groups: update creator" ON groups;
CREATE POLICY "Groups: update creator" ON groups FOR UPDATE USING (
  created_by = auth.uid() AND tournament_id IS NULL
) WITH CHECK (created_by = auth.uid() AND tournament_id IS NULL);
DROP POLICY IF EXISTS "Groups: delete creator" ON groups;
CREATE POLICY "Groups: delete creator" ON groups FOR DELETE USING (
  created_by = auth.uid() AND tournament_id IS NULL
);
DROP POLICY IF EXISTS "Group Members: read members" ON group_members;
CREATE POLICY "Group Members: read members" ON group_members FOR SELECT USING (
  account_id = auth.uid() OR EXISTS (
    SELECT 1 FROM groups g WHERE g.id = group_id AND NOT g.is_private AND g.tournament_id IS NULL
  )
);
DROP POLICY IF EXISTS "Group Members: insert own" ON group_members;
CREATE POLICY "Group Members: insert own" ON group_members FOR INSERT WITH CHECK (
  account_id = auth.uid() AND EXISTS (
    SELECT 1 FROM groups g WHERE g.id = group_id AND NOT g.is_private AND g.tournament_id IS NULL
  )
);
DROP POLICY IF EXISTS "Group Members: delete own" ON group_members;
CREATE POLICY "Group Members: delete own" ON group_members FOR DELETE USING (
  account_id = auth.uid() AND EXISTS (
    SELECT 1 FROM groups g WHERE g.id = group_id AND NOT g.is_private AND g.tournament_id IS NULL
  )
);
DROP POLICY IF EXISTS "Messages: read own" ON messages;
CREATE POLICY "Messages: read own" ON messages FOR SELECT USING (
  (thread_kind = 'dm' AND (sender_account_id = auth.uid() OR recipient_account_id = auth.uid())) OR
  (thread_kind = 'group' AND group_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM group_members gm WHERE gm.group_id = messages.group_id AND gm.account_id = auth.uid()
  ))
);
DROP POLICY IF EXISTS "Messages: insert own" ON messages;
CREATE POLICY "Messages: insert own" ON messages FOR INSERT WITH CHECK (
  sender_account_id = auth.uid() AND (
    (thread_kind = 'dm' AND recipient_account_id IS NOT NULL AND group_id IS NULL) OR
    (thread_kind = 'group' AND group_id IS NOT NULL AND recipient_account_id IS NULL AND EXISTS (
      SELECT 1 FROM group_members gm WHERE gm.group_id = messages.group_id AND gm.account_id = auth.uid()
    ))
  )
);

-- Sponsors are public; mutation is restricted to competition owner.
ALTER TABLE esport_sponsors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Esport sponsors: public read" ON esport_sponsors;
CREATE POLICY "Esport sponsors: public read" ON esport_sponsors FOR SELECT USING (true);
DROP POLICY IF EXISTS "Esport sponsors: owner writes" ON esport_sponsors;
CREATE POLICY "Esport sponsors: owner insert" ON esport_sponsors FOR INSERT WITH CHECK (
  created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM esport_tournaments t WHERE t.id = tournament_id AND t.creator_id = auth.uid()
  )
);
CREATE POLICY "Esport sponsors: owner update" ON esport_sponsors FOR UPDATE USING (
  EXISTS (SELECT 1 FROM esport_tournaments t WHERE t.id = tournament_id AND t.creator_id = auth.uid())
) WITH CHECK (
  created_by = auth.uid() AND EXISTS (SELECT 1 FROM esport_tournaments t WHERE t.id = tournament_id AND t.creator_id = auth.uid())
);
CREATE POLICY "Esport sponsors: owner delete" ON esport_sponsors FOR DELETE USING (
  EXISTS (SELECT 1 FROM esport_tournaments t WHERE t.id = tournament_id AND t.creator_id = auth.uid())
);
ALTER TABLE esport_tournament_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Esport staff: tournament participants read" ON esport_tournament_staff;
CREATE POLICY "Esport staff: tournament participants read" ON esport_tournament_staff FOR SELECT USING (
  account_id = auth.uid() OR EXISTS (
    SELECT 1 FROM esport_tournaments t WHERE t.id = tournament_id AND t.creator_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Esport staff: owner writes" ON esport_tournament_staff;
CREATE POLICY "Esport staff: owner insert" ON esport_tournament_staff FOR INSERT WITH CHECK (
  assigned_by = auth.uid() AND EXISTS (
    SELECT 1 FROM esport_tournaments t WHERE t.id = tournament_id AND t.creator_id = auth.uid()
  )
);
CREATE POLICY "Esport staff: owner update" ON esport_tournament_staff FOR UPDATE USING (
  EXISTS (SELECT 1 FROM esport_tournaments t WHERE t.id = tournament_id AND t.creator_id = auth.uid())
) WITH CHECK (
  assigned_by = auth.uid() AND EXISTS (SELECT 1 FROM esport_tournaments t WHERE t.id = tournament_id AND t.creator_id = auth.uid())
);
CREATE POLICY "Esport staff: owner delete" ON esport_tournament_staff FOR DELETE USING (
  EXISTS (SELECT 1 FROM esport_tournaments t WHERE t.id = tournament_id AND t.creator_id = auth.uid())
);

COMMIT;
