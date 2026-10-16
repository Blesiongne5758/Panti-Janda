-- ============================================================
-- Migration 006: Perluasan modul Kompetisi E-Sport
-- Format Battle Royale & Liga, detail hasil per-game (map,
-- ban/pick, durasi), hasil lobby BR (placement + kills), kanal
-- streaming, pembayaran pendaftaran & hadiah, peran caster,
-- status investigasi sengketa, data in-game anggota tim, dan
-- pengayaan game master.
-- ============================================================

BEGIN;

-- ---------- 1. Game master: metadata & bawaan ----------
ALTER TABLE esport_games
    ADD COLUMN developer           text,
    ADD COLUMN genre               text,
    ADD COLUMN platforms           jsonb,
    ADD COLUMN map_pool            jsonb,
    ADD COLUMN banner_data         text,
    ADD COLUMN default_format      text,
    ADD COLUMN default_roster_size int,
    ADD COLUMN min_players         int NOT NULL DEFAULT 1;

-- Katalog game awal (extensible lewat admin tanpa ubah kode)
INSERT INTO esport_games (slug, name, mode, team_size_min, team_size_max, roster_max, icon, active, sort_order, developer, genre, platforms, map_pool, default_format, default_roster_size, min_players) VALUES
  ('mobile-legends', 'Mobile Legends: Bang Bang', 'MOBA 5v5', 5, 5, 7, '⚔️', true, 1, 'Moonton', 'MOBA', '["mobile"]'::jsonb, '["Land of Dawn", "Sanctuary", "Imperial Sanctuary"]'::jsonb, 'single_elim', 5, 5),
  ('pubg-mobile', 'PUBG Mobile', 'Battle Royale Squad', 4, 4, 6, '🎯', true, 2, 'Tencent Games', 'Battle Royale', '["mobile"]'::jsonb, '["Erangel", "Miramar", "Sanhok", "Livik"]'::jsonb, 'battle_royale', 4, 4),
  ('free-fire', 'Free Fire', 'Battle Royale Squad', 4, 4, 6, '🔥', true, 3, 'Garena', 'Battle Royale', '["mobile"]'::jsonb, '["Bermuda", "Purgatory", "Kalahari"]'::jsonb, 'battle_royale', 4, 4),
  ('valorant', 'Valorant', 'Tactical FPS 5v5', 5, 5, 7, '🔫', true, 4, 'Riot Games', 'Tactical FPS', '["pc"]'::jsonb, '["Ascent", "Bind", "Haven", "Split"]'::jsonb, 'single_elim', 5, 5),
  ('dota-2', 'Dota 2', 'MOBA 5v5', 5, 5, 7, '🛡️', true, 5, 'Valve', 'MOBA', '["pc"]'::jsonb, '["Dota Map"]'::jsonb, 'double_elim', 5, 5),
  ('point-blank', 'Point Blank', 'FPS 5v5', 5, 5, 7, '💣', true, 6, 'Zepetto', 'FPS', '["pc"]'::jsonb, '["Downtown", "Red Rock", "Crackdown", "Saint Mansion"]'::jsonb, 'single_elim', 5, 5),
  ('efootball', 'eFootball', 'Sepak Bola 1v1', 1, 1, 2, '⚽', true, 7, 'Konami', 'Sports', '["pc", "console", "mobile"]'::jsonb, '[]'::jsonb, 'league', 1, 1)
ON CONFLICT (slug) DO NOTHING;

-- ---------- 2. Turnamen: mode, batas pemain, status hadiah ----------
ALTER TABLE esport_tournaments
    ADD COLUMN game_mode          text,
    ADD COLUMN min_players        int NOT NULL DEFAULT 1,
    ADD COLUMN currency           text NOT NULL DEFAULT 'IDR',
    ADD COLUMN prize_status       text NOT NULL DEFAULT 'pending',
    ADD COLUMN prize_paid_at      timestamptz,
    ADD COLUMN prize_payout_note  text;

-- ---------- 3. Pendaftaran: pelacakan pembayaran ----------
ALTER TABLE esport_registrations
    ADD COLUMN payment_status  text NOT NULL DEFAULT 'unpaid',
    ADD COLUMN paid_at         timestamptz,
    ADD COLUMN payment_note    text;

-- ---------- 4. Anggota tim: identitas in-game ----------
ALTER TABLE esport_team_members
    ADD COLUMN in_game_name  text,
    ADD COLUMN in_game_id    text,
    ADD COLUMN game_rank     text;

-- ---------- 5. Detail hasil per-game (seri BO) ----------
CREATE TABLE esport_match_games (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id         uuid NOT NULL REFERENCES esport_matches(id) ON DELETE CASCADE,
    game_index       int NOT NULL DEFAULT 1,
    map              text,
    home_score       int NOT NULL DEFAULT 0,
    away_score       int NOT NULL DEFAULT 0,
    winner_reg_id    uuid REFERENCES esport_registrations(id) ON DELETE SET NULL,
    duration_minutes int,
    bans             jsonb,
    picks            jsonb,
    notes            text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE(match_id, game_index)
);
CREATE INDEX idx_esport_match_games_match ON esport_match_games(match_id);

-- ---------- 6. Hasil lobby Battle Royale ----------
CREATE TABLE esport_br_results (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id          uuid NOT NULL REFERENCES esport_matches(id) ON DELETE CASCADE,
    registration_id   uuid NOT NULL REFERENCES esport_registrations(id) ON DELETE CASCADE,
    placement         int NOT NULL,
    kills             int NOT NULL DEFAULT 0,
    placement_points  int NOT NULL DEFAULT 0,
    kill_points       int NOT NULL DEFAULT 0,
    points            int NOT NULL DEFAULT 0,
    created_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE(match_id, registration_id)
);
CREATE INDEX idx_esport_br_results_match ON esport_br_results(match_id);
CREATE INDEX idx_esport_br_results_registration ON esport_br_results(registration_id);

-- ---------- 7. Kanal streaming turnamen ----------
CREATE TABLE esport_streams (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id     uuid NOT NULL REFERENCES esport_tournaments(id) ON DELETE CASCADE,
    name              text NOT NULL,
    platform          text NOT NULL DEFAULT 'youtube',
    url               text,
    current_match_id  uuid REFERENCES esport_matches(id) ON DELETE SET NULL,
    is_active         boolean NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esport_streams_tournament ON esport_streams(tournament_id);

-- ---------- 8. Caster: peran produksi ----------
ALTER TABLE esport_casters
    ADD COLUMN caster_role text NOT NULL DEFAULT 'main_caster';

-- ---------- 9. Sengketa: bukti jamak + investigasi ----------
ALTER TABLE esport_disputes
    ADD COLUMN evidence_urls   jsonb,
    ADD COLUMN investigated_at timestamptz;

COMMIT;
