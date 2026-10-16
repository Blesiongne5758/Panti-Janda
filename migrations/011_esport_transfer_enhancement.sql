-- ============================================================
-- Migration 011: Enhanced E-Sport Transfer Market
-- Fase A: Tabel statistik pemain, review, sengketa transfer,
-- riwayat roster, dan ekstensi kolom untuk profil pemain,
-- kontrak, iklan, penawaran, transfer, agen, dan jendela.
-- ============================================================

BEGIN;

-- ========== EXTEND: esport_player_profiles ==========
ALTER TABLE esport_player_profiles
  ADD COLUMN IF NOT EXISTS real_name text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS in_game_id text,
  ADD COLUMN IF NOT EXISTS game_rank text,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS secondary_role text,
  ADD COLUMN IF NOT EXISTS market_value int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buyout_clause int,
  ADD COLUMN IF NOT EXISTS salary_expectation int,
  ADD COLUMN IF NOT EXISTS avatar text,
  ADD COLUMN IF NOT EXISTS banner text,
  ADD COLUMN IF NOT EXISTS highlight_video text,
  ADD COLUMN IF NOT EXISTS achievements jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_esport_player_profiles_role ON esport_player_profiles(role);
CREATE INDEX IF NOT EXISTS idx_esport_player_profiles_market_value ON esport_player_profiles(market_value DESC);
CREATE INDEX IF NOT EXISTS idx_esport_player_profiles_verified ON esport_player_profiles(is_verified);

-- ========== EXTEND: esport_agents ==========
ALTER TABLE esport_agents
  ADD COLUMN IF NOT EXISTS agency_name text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS logo text,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS commission_rate numeric(5,2) NOT NULL DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS total_transfers int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_value int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_esport_agents_verified ON esport_agents(is_verified);

-- ========== EXTEND: esport_transfer_windows ==========
ALTER TABLE esport_transfer_windows
  ADD COLUMN IF NOT EXISTS max_transfers_per_team int,
  ADD COLUMN IF NOT EXISTS allow_loan boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_trade boolean NOT NULL DEFAULT true;

-- ========== EXTEND: esport_transfer_listings ==========
ALTER TABLE esport_transfer_listings
  ADD COLUMN IF NOT EXISTS listed_by uuid REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS negotiable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS salary_requirement int,
  ADD COLUMN IF NOT EXISTS contract_duration int,
  ADD COLUMN IF NOT EXISTS loan_option_to_buy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS view_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offer_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_esport_transfer_listings_public ON esport_transfer_listings(is_public, status);
CREATE INDEX IF NOT EXISTS idx_esport_transfer_listings_expires ON esport_transfer_listings(expires_at);

-- ========== EXTEND: esport_transfer_offers ==========
ALTER TABLE esport_transfer_offers
  ADD COLUMN IF NOT EXISTS monthly_salary int,
  ADD COLUMN IF NOT EXISTS contract_duration int,
  ADD COLUMN IF NOT EXISTS sell_on_percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS addons jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS response_note text;

-- ========== EXTEND: esport_transfers ==========
ALTER TABLE esport_transfers
  ADD COLUMN IF NOT EXISTS monthly_salary int,
  ADD COLUMN IF NOT EXISTS contract_duration int,
  ADD COLUMN IF NOT EXISTS sell_on_percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS escrow_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS announced_at timestamptz,
  ADD COLUMN IF NOT EXISTS announcement_post text;

CREATE INDEX IF NOT EXISTS idx_esport_transfers_payment ON esport_transfers(payment_status);

-- ========== EXTEND: esport_player_contracts ==========
ALTER TABLE esport_player_contracts
  ADD COLUMN IF NOT EXISTS monthly_salary int,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'koin',
  ADD COLUMN IF NOT EXISTS buyout_clause int,
  ADD COLUMN IF NOT EXISTS sell_on_percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS benefits jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_loan boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loan_from_team_id uuid REFERENCES esport_teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loan_end_date date,
  ADD COLUMN IF NOT EXISTS loan_option_to_buy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS player_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS team_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS contract_doc_url text;

CREATE INDEX IF NOT EXISTS idx_esport_player_contracts_loan ON esport_player_contracts(is_loan);

-- ========== NEW TABLE: esport_player_stats ==========
CREATE TABLE IF NOT EXISTS esport_player_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_profile_id uuid NOT NULL REFERENCES esport_player_profiles(id) ON DELETE CASCADE,
    total_matches int NOT NULL DEFAULT 0,
    win_rate numeric(5,2) NOT NULL DEFAULT 0.00,
    kda_ratio numeric(5,2) NOT NULL DEFAULT 0.00,
    game_specific jsonb DEFAULT '{}'::jsonb,
    tournaments_played int NOT NULL DEFAULT 0,
    tournaments_won int NOT NULL DEFAULT 0,
    mvp_awards int NOT NULL DEFAULT 0,
    team_win_rate numeric(5,2) NOT NULL DEFAULT 0.00,
    data_source text DEFAULT 'manual',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(player_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_esport_player_stats_profile ON esport_player_stats(player_profile_id);
CREATE INDEX IF NOT EXISTS idx_esport_player_stats_win_rate ON esport_player_stats(win_rate DESC);

-- ========== NEW TABLE: esport_player_reviews ==========
CREATE TABLE IF NOT EXISTS esport_player_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_profile_id uuid NOT NULL REFERENCES esport_player_profiles(id) ON DELETE CASCADE,
    reviewer_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    reviewer_team_id uuid REFERENCES esport_teams(id) ON DELETE SET NULL,
    rating_skill int NOT NULL CHECK (rating_skill >= 1 AND rating_skill <= 5),
    rating_teamwork int NOT NULL CHECK (rating_teamwork >= 1 AND rating_teamwork <= 5),
    rating_discipline int NOT NULL CHECK (rating_discipline >= 1 AND rating_discipline <= 5),
    rating_communication int NOT NULL CHECK (rating_communication >= 1 AND rating_communication <= 5),
    comment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(player_profile_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_esport_player_reviews_player ON esport_player_reviews(player_profile_id);
CREATE INDEX IF NOT EXISTS idx_esport_player_reviews_reviewer ON esport_player_reviews(reviewer_id);

-- ========== NEW TABLE: esport_transfer_disputes ==========
CREATE TABLE IF NOT EXISTS esport_transfer_disputes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id uuid NOT NULL REFERENCES esport_transfers(id) ON DELETE CASCADE,
    raised_by uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    reason text NOT NULL,
    description text,
    evidence jsonb DEFAULT '[]'::jsonb,
    status text NOT NULL DEFAULT 'open',
    resolved_by uuid REFERENCES accounts(id) ON DELETE SET NULL,
    resolution text,
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esport_transfer_disputes_transfer ON esport_transfer_disputes(transfer_id);
CREATE INDEX IF NOT EXISTS idx_esport_transfer_disputes_status ON esport_transfer_disputes(status);

-- ========== NEW TABLE: esport_roster_history ==========
CREATE TABLE IF NOT EXISTS esport_roster_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES esport_teams(id) ON DELETE CASCADE,
    player_profile_id uuid NOT NULL REFERENCES esport_player_profiles(id) ON DELETE CASCADE,
    joined_at timestamptz NOT NULL DEFAULT now(),
    left_at timestamptz,
    leave_reason text,
    transfer_id uuid REFERENCES esport_transfers(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esport_roster_history_team ON esport_roster_history(team_id);
CREATE INDEX IF NOT EXISTS idx_esport_roster_history_player ON esport_roster_history(player_profile_id);
CREATE INDEX IF NOT EXISTS idx_esport_roster_history_active ON esport_roster_history(team_id, left_at) WHERE left_at IS NULL;

COMMIT;
