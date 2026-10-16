-- Panti Janda: Event Invitation Attendance Migration
-- Adds 1 table tracking check-in of invited guests via invitation QR scan
-- PostgreSQL / Supabase compatible

BEGIN;

-- ============================================================
-- 1. event_invite_attendance — Daftar hadir tamu undangan
-- ============================================================
CREATE TABLE event_invite_attendance (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    invite_id       uuid NOT NULL REFERENCES event_invites(id) ON DELETE CASCADE,
    account_id      uuid REFERENCES accounts(id) ON DELETE SET NULL,
    scanned_by      uuid REFERENCES accounts(id) ON DELETE SET NULL,
    checked_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(invite_id)
);

CREATE INDEX idx_event_invite_attendance_event ON event_invite_attendance(event_id);

COMMIT;
