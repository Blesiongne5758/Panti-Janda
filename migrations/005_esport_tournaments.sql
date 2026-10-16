-- ============================================================
-- Migration 005: Kompetisi E-Sport (Tournament Module)
-- Fitur tersendiri (bukan kategori event): game master extensible,
-- format turnamen, tim + roster, bracket otomatis, jadwal, hadiah,
-- aturan, lapor skor, check-in, live streaming, sengketa, caster,
-- klasemen/statistik.
-- ============================================================

BEGIN;

-- ---------- 1. Game master (extensible tanpa code change) ----------
CREATE TABLE esport_games (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            text NOT NULL UNIQUE,
    name            text NOT NULL,
    mode            text NOT NULL,
    team_size_min   int NOT NULL DEFAULT 1,
    team_size_max   int NOT NULL DEFAULT 5,
    roster_max      int NOT NULL DEFAULT 7,
    icon            text,
    active          boolean NOT NULL DEFAULT true,
    sort_order      int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------- 2. Turnamen ----------
CREATE TABLE esport_tournaments (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id              uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    game_id                 uuid NOT NULL REFERENCES esport_games(id) ON DELETE CASCADE,
    title                   text NOT NULL,
    description             text,
    format                  text NOT NULL DEFAULT 'single_elim',
    status                  text NOT NULL DEFAULT 'draft',
    max_teams               int NOT NULL DEFAULT 8,
    roster_min              int,
    roster_max              int,
    best_of                 int NOT NULL DEFAULT 1,
    entry_fee               int NOT NULL DEFAULT 0,
    prize_total             int NOT NULL DEFAULT 0,
    rules                   text,
    stream_url              text,
    registration_close_at   timestamptz,
    start_at                timestamptz,
    checkin_window_minutes  int NOT NULL DEFAULT 30,
    -- Langkah 1: platform & mode (mode tim melekat pada esport_games)
    platform                text NOT NULL DEFAULT 'mobile',
    -- Langkah 2: informasi dasar
    banner_data             text,
    tags                    text,
    category                text NOT NULL DEFAULT 'amateur',
    -- Langkah 3: jadwal turnamen
    registration_open_at    timestamptz,
    technical_meeting_at    timestamptz,
    qualifier_start_at      timestamptz,
    main_event_start_at     timestamptz,
    grand_final_at          timestamptz,
    timezone                text NOT NULL DEFAULT 'Asia/Jakarta',
    -- Langkah 4: pengaturan tim & peserta
    substitute_max          int NOT NULL DEFAULT 0,
    requirements            jsonb,
    -- Langkah 5: prize pool & anggaran
    funding_source          text,
    operational_budget      int NOT NULL DEFAULT 0,
    sponsorship_slots       jsonb,
    -- Langkah 6: peraturan detail
    rules_detail            jsonb,
    -- Langkah 7: streaming & produksi
    streaming_config        jsonb,
    -- Langkah 8: review & publish (approval hadiah di atas ambang)
    approval_status         text NOT NULL DEFAULT 'none',
    approval_note           text,
    approved_by             uuid REFERENCES accounts(id) ON DELETE SET NULL,
    approved_at             timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esport_tournaments_creator ON esport_tournaments(creator_id);
CREATE INDEX idx_esport_tournaments_game ON esport_tournaments(game_id);
CREATE INDEX idx_esport_tournaments_status ON esport_tournaments(status);

-- ---------- 3. Hadiah per juara ----------
CREATE TABLE esport_prizes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id   uuid NOT NULL REFERENCES esport_tournaments(id) ON DELETE CASCADE,
    placement       int NOT NULL DEFAULT 1,
    label           text NOT NULL,
    amount          int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esport_prizes_tournament ON esport_prizes(tournament_id);

-- ---------- 4. Tim + anggota ----------
CREATE TABLE esport_teams (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    tag         text,
    logo_data   text,
    captain_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esport_teams_captain ON esport_teams(captain_id);

CREATE TABLE esport_team_members (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     uuid NOT NULL REFERENCES esport_teams(id) ON DELETE CASCADE,
    account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    member_role text NOT NULL DEFAULT 'member',
    game_role   text,
    joined_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE(team_id, account_id)
);
CREATE INDEX idx_esport_team_members_team ON esport_team_members(team_id);
CREATE INDEX idx_esport_team_members_account ON esport_team_members(account_id);

-- ---------- 5. Registrasi tim ke turnamen ----------
CREATE TABLE esport_registrations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id   uuid NOT NULL REFERENCES esport_tournaments(id) ON DELETE CASCADE,
    team_id         uuid NOT NULL REFERENCES esport_teams(id) ON DELETE CASCADE,
    seed            int,
    status          text NOT NULL DEFAULT 'registered',
    roster          text,
    group_label     text,
    registered_at   timestamptz NOT NULL DEFAULT now(),
    checked_in_at   timestamptz,
    UNIQUE(tournament_id, team_id)
);
CREATE INDEX idx_esport_registrations_tournament ON esport_registrations(tournament_id);

-- ---------- 6. Pertandingan (match) ----------
CREATE TABLE esport_matches (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id       uuid NOT NULL REFERENCES esport_tournaments(id) ON DELETE CASCADE,
    stage               text NOT NULL DEFAULT 'main',
    round               int NOT NULL DEFAULT 1,
    group_label         text,
    match_index         int NOT NULL DEFAULT 1,
    best_of             int NOT NULL DEFAULT 1,
    home_reg_id         uuid REFERENCES esport_registrations(id) ON DELETE SET NULL,
    away_reg_id         uuid REFERENCES esport_registrations(id) ON DELETE SET NULL,
    home_score          int,
    away_score          int,
    winner_reg_id       uuid REFERENCES esport_registrations(id) ON DELETE SET NULL,
    loser_reg_id        uuid REFERENCES esport_registrations(id) ON DELETE SET NULL,
    status              text NOT NULL DEFAULT 'scheduled',
    scheduled_at        timestamptz,
    started_at          timestamptz,
    finished_at         timestamptz,
    stream_url          text,
    caster_name         text,
    checkin_home_at     timestamptz,
    checkin_away_at     timestamptz,
    next_match_id       uuid,
    next_slot           text,
    loser_next_match_id uuid,
    loser_next_slot     text,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esport_matches_tournament ON esport_matches(tournament_id);
CREATE INDEX idx_esport_matches_status ON esport_matches(status);

-- ---------- 7. Sengketa / protes ----------
CREATE TABLE esport_disputes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id   uuid NOT NULL REFERENCES esport_tournaments(id) ON DELETE CASCADE,
    match_id        uuid NOT NULL REFERENCES esport_matches(id) ON DELETE CASCADE,
    filed_by        uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    registration_id uuid NOT NULL REFERENCES esport_registrations(id) ON DELETE CASCADE,
    reason          text NOT NULL,
    evidence_url    text,
    status          text NOT NULL DEFAULT 'open',
    resolution      text,
    resolved_by     uuid REFERENCES accounts(id) ON DELETE SET NULL,
    resolved_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esport_disputes_tournament ON esport_disputes(tournament_id);
CREATE INDEX idx_esport_disputes_match ON esport_disputes(match_id);

-- ---------- 8. Slot caster / komentator ----------
CREATE TABLE esport_casters (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id       uuid NOT NULL REFERENCES esport_tournaments(id) ON DELETE CASCADE,
    name                text NOT NULL,
    slot_label          text,
    contact             text,
    assigned_match_id   uuid REFERENCES esport_matches(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esport_casters_tournament ON esport_casters(tournament_id);

COMMIT;
