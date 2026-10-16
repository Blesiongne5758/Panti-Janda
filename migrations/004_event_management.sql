-- ============================================================
-- Migration 004: Event Management (Planning & Budgeting)
-- Lifecycle: draft -> planning -> budgeting -> pending_approval
--            -> published -> ongoing -> completed -> archived
-- ============================================================

BEGIN;

-- ---------- 1. Kolom baru pada events ----------
ALTER TABLE events ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'meetup';
ALTER TABLE events ADD COLUMN IF NOT EXISTS tags text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_image text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Jakarta';
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_type text NOT NULL DEFAULT 'physical';
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_name text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_address text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_maps_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS virtual_platform text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS virtual_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS permit_required boolean NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS live_room_status text NOT NULL DEFAULT 'idle';

-- ---------- 2. EventPlan (rencana) ----------
CREATE TABLE event_plans (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    target_audience     text,
    objectives          text,
    requirements        text,
    marketing_plan      text,
    promotion_channels  text,
    risk_assessment     text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE(event_id)
);

-- ---------- 3. EventBudgetItem (anggaran) ----------
CREATE TABLE event_budget_items (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    category        text NOT NULL DEFAULT 'OTHER',
    name            text NOT NULL,
    quantity        numeric NOT NULL DEFAULT 1,
    unit            text,
    estimated_cost  int NOT NULL DEFAULT 0,
    actual_cost     int NOT NULL DEFAULT 0,
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_budget_items_event ON event_budget_items(event_id);

-- ---------- 4. FundingSource (sumber dana) ----------
CREATE TABLE event_funding_sources (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    type        text NOT NULL DEFAULT 'SELF_FUNDED',
    name        text NOT NULL,
    amount      int NOT NULL DEFAULT 0,
    notes       text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_funding_sources_event ON event_funding_sources(event_id);

-- ---------- 5. EventSession + EventSpeaker (rundown) ----------
CREATE TABLE event_sessions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title       text NOT NULL,
    description text,
    starts_at   timestamptz,
    ends_at     timestamptz,
    room        text,
    order_index int NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_sessions_event ON event_sessions(event_id);

CREATE TABLE event_speakers (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    session_id  uuid REFERENCES event_sessions(id) ON DELETE CASCADE,
    account_id  uuid REFERENCES accounts(id) ON DELETE SET NULL,
    name        text NOT NULL,
    topic       text,
    bio         text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_speakers_event ON event_speakers(event_id);

-- ---------- 6. EventChecklist (persiapan) ----------
CREATE TABLE event_checklists (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title               text NOT NULL,
    category            text,
    status              text NOT NULL DEFAULT 'pending',
    priority            text NOT NULL DEFAULT 'medium',
    due_at              timestamptz,
    assignee_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
    order_index         int NOT NULL DEFAULT 0,
    reminder_stage      text,
    completed_at        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_checklists_event ON event_checklists(event_id);

-- ---------- 7. EventApproval (workflow approval) ----------
CREATE TABLE event_approvals (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    status          text NOT NULL DEFAULT 'pending',
    requested_by    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    reviewed_by     uuid REFERENCES accounts(id) ON DELETE SET NULL,
    reason          text,
    decision_note   text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    decided_at      timestamptz
);
CREATE INDEX idx_event_approvals_event ON event_approvals(event_id);

-- ---------- 8. TicketTier (ticketing bertingkat) ----------
CREATE TABLE event_ticket_tiers (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name        text NOT NULL,
    price       int NOT NULL DEFAULT 0,
    quota       int NOT NULL DEFAULT 0,
    benefits    text,
    sale_start  timestamptz,
    sale_end    timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_ticket_tiers_event ON event_ticket_tiers(event_id);

ALTER TABLE event_tickets ADD COLUMN IF NOT EXISTS tier_id uuid REFERENCES event_ticket_tiers(id) ON DELETE SET NULL;

-- ---------- 9. EventExpense (realisasi biaya) ----------
CREATE TABLE event_expenses (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    budget_item_id  uuid REFERENCES event_budget_items(id) ON DELETE SET NULL,
    category        text NOT NULL DEFAULT 'OTHER',
    description     text NOT NULL,
    amount          int NOT NULL DEFAULT 0,
    spent_at        timestamptz,
    recorded_by     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    status          text NOT NULL DEFAULT 'approved',
    reviewed_by     uuid REFERENCES accounts(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_expenses_event ON event_expenses(event_id);

-- ---------- 10. EventReport (snapshot laporan) ----------
CREATE TABLE event_reports (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    kind            text NOT NULL DEFAULT 'financial',
    generated_by    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    payload         text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_reports_event ON event_reports(event_id);

-- ---------- 11. EventAuditLog (jejak perubahan anggaran) ----------
CREATE TABLE event_audit_logs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    actor_id    uuid REFERENCES accounts(id) ON DELETE SET NULL,
    action      text NOT NULL,
    detail      text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_audit_logs_event ON event_audit_logs(event_id);

-- ---------- 12. EventLiveStream (ruang live virtual/hybrid) ----------
CREATE TABLE event_live_streams (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    provider    text NOT NULL DEFAULT 'internal',
    status      text NOT NULL DEFAULT 'idle',
    started_at  timestamptz,
    ended_at    timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(event_id)
);

COMMIT;
