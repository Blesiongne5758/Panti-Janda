-- ============================================================
-- Migration 007: Siklus hidup pertandingan E-Sport
-- Status pertandingan kini memiliki tahap check-in (checkin_open),
-- jeda (paused), sengketa (disputed), dan walkover. Kolom baru
-- menyimpan waktu jeda dan catatan alasan jeda.
--
-- Alur: scheduled -> checkin_open (H-window) -> live -> finished;
-- cabang: paused (live <-> paused), disputed (live -> disputed ->
-- live), walkover (checkin_open, pemenang = tim yang hadir).
-- ============================================================

BEGIN;

ALTER TABLE esport_matches
    ADD COLUMN paused_at   timestamptz,
    ADD COLUMN pause_note  text;

COMMIT;
