-- ============================================================
-- Migration 008: Anggaran turnamen E-Sport
-- Rincian anggaran per turnamen (hadiah, produksi, talent,
-- pemasaran, panitia, peralatan, venue, perizinan, dana
-- cadangan). Disusun dari template bawaan lalu bisa diedit
-- penyelenggara. Total item non-hadiah disinkronkan ke kolom
-- esport_tournaments.operational_budget.
-- ============================================================

BEGIN;

CREATE TABLE esport_budget_items (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id   uuid NOT NULL REFERENCES esport_tournaments(id) ON DELETE CASCADE,
    category        text NOT NULL DEFAULT 'OTHER',
    item_name       text NOT NULL,
    quantity        int NOT NULL DEFAULT 1,
    estimated_cost  int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esport_budget_items_tournament ON esport_budget_items(tournament_id);

COMMIT;
