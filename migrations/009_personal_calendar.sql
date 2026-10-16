-- ============================================================
-- Migration 009: Jadwal pribadi pada kalender dasbor
-- Rencana kegiatan anggota di luar kegiatan platform (event,
-- turnamen, program, dsb.). Bersifat privat: hanya pemilik
-- yang dapat melihat, mengubah, dan menghapus.
-- ============================================================

BEGIN;

CREATE TABLE personal_calendar_items (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title       text NOT NULL,
    note        text,
    location    text,
    date        date NOT NULL,
    start_time  text,
    end_time    text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_personal_calendar_items_account ON personal_calendar_items(account_id, date);

COMMIT;
