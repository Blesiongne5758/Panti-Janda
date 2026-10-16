-- ============================================================
-- Migration 010: Bursa Transfer E-Sport (Transfer Market)
-- Kartu pemain per game, iklan jual/pinjam/free agent,
-- penawaran + negosiasi, transfer final dengan escrow koin,
-- kontrak digital, jendela transfer per game, dan agen pemain.
-- Transfer fee disimpan dalam koin (mata uang platform).
-- ============================================================

BEGIN;

-- ---------- 1. Kartu pemain (per akun per game) ----------
CREATE TABLE esport_player_profiles (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    game_id      uuid NOT NULL REFERENCES esport_games(id) ON DELETE CASCADE,
    ign          text NOT NULL,
    main_role    text,
    region       text,
    rank_tier    text,
    rank_points  int,
    bio          text,
    stats        jsonb,
    status       text NOT NULL DEFAULT 'free_agent',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE(account_id, game_id)
);
CREATE INDEX idx_esport_player_profiles_game ON esport_player_profiles(game_id, status);
CREATE INDEX idx_esport_player_profiles_account ON esport_player_profiles(account_id);

-- ---------- 2. Agen pemain (opsional) ----------
CREATE TABLE esport_agents (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_profile_id   uuid NOT NULL REFERENCES esport_player_profiles(id) ON DELETE CASCADE,
    name                text NOT NULL,
    contact             text,
    commission_percent  int NOT NULL DEFAULT 10,
    active              boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE(player_profile_id)
);
CREATE INDEX idx_esport_agents_profile ON esport_agents(player_profile_id);

-- ---------- 3. Jendela transfer per game ----------
CREATE TABLE esport_transfer_windows (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id     uuid NOT NULL REFERENCES esport_games(id) ON DELETE CASCADE,
    name        text NOT NULL,
    opens_at    timestamptz NOT NULL,
    closes_at   timestamptz NOT NULL,
    created_by  uuid REFERENCES accounts(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esport_transfer_windows_game ON esport_transfer_windows(game_id);

-- ---------- 4. Iklan jual / pinjam / free agent ----------
CREATE TABLE esport_transfer_listings (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_profile_id  uuid NOT NULL REFERENCES esport_player_profiles(id) ON DELETE CASCADE,
    team_id            uuid REFERENCES esport_teams(id) ON DELETE CASCADE,
    created_by         uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    listing_type       text NOT NULL,
    asking_price       int NOT NULL DEFAULT 0,
    loan_days          int,
    option_price       int,
    description        text,
    status             text NOT NULL DEFAULT 'open',
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esport_transfer_listings_profile ON esport_transfer_listings(player_profile_id, status);
CREATE INDEX idx_esport_transfer_listings_team ON esport_transfer_listings(team_id);

-- ---------- 5. Penawaran dari tim pembeli ----------
CREATE TABLE esport_transfer_offers (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id     uuid NOT NULL REFERENCES esport_transfer_listings(id) ON DELETE CASCADE,
    from_team_id   uuid NOT NULL REFERENCES esport_teams(id) ON DELETE CASCADE,
    created_by     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    offer_type     text NOT NULL,
    fee            int NOT NULL DEFAULT 0,
    loan_days      int,
    option_price   int,
    message        text,
    status         text NOT NULL DEFAULT 'pending',
    counter_of     uuid REFERENCES esport_transfer_offers(id) ON DELETE SET NULL,
    expires_at     timestamptz,
    responded_at   timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esport_transfer_offers_listing ON esport_transfer_offers(listing_id, status);
CREATE INDEX idx_esport_transfer_offers_team ON esport_transfer_offers(from_team_id);

-- ---------- 6. Transfer final (escrow koin) ----------
CREATE TABLE esport_transfers (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id           uuid REFERENCES esport_transfer_offers(id) ON DELETE SET NULL,
    listing_id         uuid REFERENCES esport_transfer_listings(id) ON DELETE SET NULL,
    player_profile_id  uuid NOT NULL REFERENCES esport_player_profiles(id) ON DELETE CASCADE,
    from_team_id       uuid REFERENCES esport_teams(id) ON DELETE SET NULL,
    to_team_id         uuid NOT NULL REFERENCES esport_teams(id) ON DELETE CASCADE,
    transfer_type      text NOT NULL,
    fee                int NOT NULL DEFAULT 0,
    loan_days          int,
    option_price       int,
    status             text NOT NULL DEFAULT 'pending_payment',
    escrow_coins       int NOT NULL DEFAULT 0,
    paid_by            uuid REFERENCES accounts(id) ON DELETE SET NULL,
    paid_at            timestamptz,
    completed_at       timestamptz,
    cancelled_at       timestamptz,
    cancel_reason      text,
    created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esport_transfers_profile ON esport_transfers(player_profile_id);
CREATE INDEX idx_esport_transfers_to_team ON esport_transfers(to_team_id, status);
CREATE INDEX idx_esport_transfers_from_team ON esport_transfers(from_team_id, status);

-- ---------- 7. Kontrak digital pemain ----------
CREATE TABLE esport_player_contracts (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_profile_id  uuid NOT NULL REFERENCES esport_player_profiles(id) ON DELETE CASCADE,
    team_id            uuid NOT NULL REFERENCES esport_teams(id) ON DELETE CASCADE,
    transfer_id        uuid REFERENCES esport_transfers(id) ON DELETE SET NULL,
    contract_type      text NOT NULL,
    start_date         date NOT NULL,
    end_date           date,
    salary             int NOT NULL DEFAULT 0,
    option_price       int,
    option_team_id     uuid REFERENCES esport_teams(id) ON DELETE SET NULL,
    status             text NOT NULL DEFAULT 'active',
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esport_player_contracts_profile ON esport_player_contracts(player_profile_id, status);
CREATE INDEX idx_esport_player_contracts_team ON esport_player_contracts(team_id, status);

COMMIT;
