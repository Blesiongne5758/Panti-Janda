-- Panti Janda: Initial Schema Migration
-- Creates all 32 tables for the application
-- PostgreSQL / Supabase compatible

BEGIN;

-- ============================================================
-- 1. accounts
-- ============================================================
CREATE TABLE accounts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email           text UNIQUE NOT NULL,
    password_hash   text NOT NULL,
    role            text NOT NULL DEFAULT 'public',
    status          text NOT NULL DEFAULT 'active',
    display_name    text NOT NULL,
    level           int NOT NULL DEFAULT 1,
    xp              int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. sessions
-- ============================================================
CREATE TABLE sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    token_hash      text NOT NULL,
    expires_at      timestamptz NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. profiles
-- ============================================================
CREATE TABLE profiles (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id              uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    nickname                text NOT NULL,
    tier                    text,
    full_name               text,
    verification_doc_type   text,
    verification_doc_name   text,
    verification_doc_data   text,
    city                    text,
    age                     int,
    dependents              int,
    employment_status       text,
    skills                  text[],
    trainings               text[],
    needs_target            text,
    main_target             text,
    interests               text[],
    bio                     text,
    funding_info            text,
    status                  text NOT NULL DEFAULT 'pending',
    reject_reason           text,
    verified_at             timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    photo_data              text,
    education               text,
    insurance               text,
    height_cm               int,
    weight_kg               int,
    birth_place             text,
    birth_date              date,
    sim_classes             text[],
    passport                bool DEFAULT false,
    bank_name               text,
    bank_account_name       text,
    bank_account_number     text,
    whatsapp                text,
    address                 text
);

-- ============================================================
-- 4. kpi_logs
-- ============================================================
CREATE TABLE kpi_logs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    source_type     text NOT NULL,
    source_id       uuid,
    points          int NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. kpi_summary
-- ============================================================
CREATE TABLE kpi_summary (
    account_id      uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    total_points    int NOT NULL DEFAULT 0,
    level           int NOT NULL DEFAULT 1,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. badges
-- ============================================================
CREATE TABLE badges (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    badge_type      text NOT NULL,
    label           text NOT NULL,
    tier            int NOT NULL,
    awarded_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. updates
-- ============================================================
CREATE TABLE updates (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title           text NOT NULL,
    body            text NOT NULL,
    status          text NOT NULL DEFAULT 'visible',
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. comments
-- ============================================================
CREATE TABLE comments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    update_id       uuid NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    author_name     text NOT NULL,
    body            text NOT NULL,
    status          text NOT NULL DEFAULT 'visible',
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 9. reports
-- ============================================================
CREATE TABLE reports (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    target_type     text NOT NULL,
    target_id       uuid NOT NULL,
    reason          text NOT NULL,
    detail          text,
    status          text NOT NULL DEFAULT 'open',
    created_at      timestamptz NOT NULL DEFAULT now(),
    resolved_at     timestamptz
);

-- ============================================================
-- 10. pledges
-- ============================================================
CREATE TABLE pledges (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    account_id      uuid REFERENCES accounts(id) ON DELETE SET NULL,
    supporter_name  text NOT NULL,
    contact         text NOT NULL,
    support_type    text NOT NULL,
    amount          int NOT NULL DEFAULT 0,
    message         text,
    status          text NOT NULL DEFAULT 'baru',
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 11. donations
-- ============================================================
CREATE TABLE donations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    order_id        text UNIQUE NOT NULL,
    gross_amount    int NOT NULL,
    supporter_name  text NOT NULL,
    supporter_email text,
    status          text NOT NULL DEFAULT 'pending',
    gateway         text,
    redirect_url    text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 18. groups  (created before events because events references groups)
-- ============================================================
CREATE TABLE groups (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text NOT NULL,
    description         text NOT NULL,
    audience_min_role   text NOT NULL,
    capacity            int NOT NULL DEFAULT 0,
    created_by          uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 19. group_members
-- ============================================================
CREATE TABLE group_members (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(group_id, account_id)
);

-- ============================================================
-- 12. events
-- ============================================================
CREATE TABLE events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text NOT NULL,
    description     text NOT NULL,
    audience        text NOT NULL DEFAULT 'umum',
    location        text NOT NULL,
    starts_at       timestamptz NOT NULL,
    ends_at         timestamptz,
    capacity        int NOT NULL DEFAULT 0,
    funding_target  int NOT NULL DEFAULT 0,
    ticket_price    int,
    group_id        uuid REFERENCES groups(id) ON DELETE SET NULL,
    status          text NOT NULL DEFAULT 'published',
    created_by      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 13. event_rsvps
-- ============================================================
CREATE TABLE event_rsvps (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    status          text NOT NULL DEFAULT 'going',
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(event_id, account_id)
);

-- ============================================================
-- 14. event_invites
-- ============================================================
CREATE TABLE event_invites (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(event_id, account_id)
);

-- ============================================================
-- 15. event_committees
-- ============================================================
CREATE TABLE event_committees (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    role            text NOT NULL DEFAULT 'panitia',
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(event_id, account_id)
);

-- ============================================================
-- 16. event_tickets
-- ============================================================
CREATE TABLE event_tickets (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    account_id      uuid REFERENCES accounts(id) ON DELETE SET NULL,
    code            text UNIQUE NOT NULL,
    ticket_type     text NOT NULL DEFAULT 'free',
    price           int NOT NULL DEFAULT 0,
    order_id        text,
    payment_status  text,
    status          text NOT NULL DEFAULT 'valid',
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 17. event_attendance
-- ============================================================
CREATE TABLE event_attendance (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       uuid NOT NULL REFERENCES event_tickets(id) ON DELETE CASCADE,
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    scanned_by      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    checked_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 20. messages
-- ============================================================
CREATE TABLE messages (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_kind             text NOT NULL,
    sender_account_id       uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    recipient_account_id    uuid REFERENCES accounts(id) ON DELETE CASCADE,
    group_id                uuid REFERENCES groups(id) ON DELETE CASCADE,
    body                    text NOT NULL,
    created_at              timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 21. follows
-- ============================================================
CREATE TABLE follows (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    followed_account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE(follower_account_id, followed_account_id)
);

-- ============================================================
-- 22. programs
-- ============================================================
CREATE TABLE programs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text NOT NULL,
    category        text NOT NULL,
    description     text NOT NULL,
    schedule        text NOT NULL,
    seats           int NOT NULL DEFAULT 0,
    status          text NOT NULL DEFAULT 'published',
    created_by      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 23. program_participants
-- ============================================================
CREATE TABLE program_participants (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(program_id, account_id)
);

-- ============================================================
-- 24. notifications
-- ============================================================
CREATE TABLE notifications (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type                    text NOT NULL,
    actor_account_id        uuid REFERENCES accounts(id) ON DELETE SET NULL,
    message                 text NOT NULL,
    link                    text,
    read                    bool NOT NULL DEFAULT false,
    created_at              timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 25. campaigns
-- ============================================================
CREATE TABLE campaigns (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title           text NOT NULL,
    description     text NOT NULL,
    target_amount   int NOT NULL DEFAULT 0,
    collected_amount int NOT NULL DEFAULT 0,
    deadline        date,
    status          text NOT NULL DEFAULT 'open',
    donor_count     int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 26. campaign_donations
-- ============================================================
CREATE TABLE campaign_donations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    order_id        text UNIQUE NOT NULL,
    amount          int NOT NULL,
    supporter_name  text NOT NULL,
    supporter_email text,
    message         text,
    status          text NOT NULL DEFAULT 'pending',
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 27. businesses
-- ============================================================
CREATE TABLE businesses (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    business_type   text NOT NULL,
    title           text NOT NULL,
    description     text NOT NULL,
    proposal        text,
    capital_needed  int NOT NULL DEFAULT 0,
    status          text NOT NULL DEFAULT 'draft',
    reject_reason   text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 28. business_rab
-- ============================================================
CREATE TABLE business_rab (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    description     text NOT NULL,
    quantity        int NOT NULL,
    unit            text NOT NULL,
    unit_price      int NOT NULL,
    total           int NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 29. marketplace_listings
-- ============================================================
CREATE TABLE marketplace_listings (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    kind                text NOT NULL,
    title               text NOT NULL,
    description         text NOT NULL,
    price               int,
    category            text NOT NULL,
    status              text NOT NULL DEFAULT 'active',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 30. subscriptions
-- ============================================================
CREATE TABLE subscriptions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    tier            text NOT NULL,
    status          text NOT NULL DEFAULT 'pending',
    monthly_amount  int NOT NULL DEFAULT 0,
    started_at      timestamptz,
    expires_at      timestamptz,
    cancelled_at    timestamptz,
    order_id        text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 31. coin_balances
-- ============================================================
CREATE TABLE coin_balances (
    account_id              uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    balance                 int NOT NULL DEFAULT 0,
    lifetime_purchased      int NOT NULL DEFAULT 0,
    lifetime_spent          int NOT NULL DEFAULT 0,
    updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 32. coin_transactions
-- ============================================================
CREATE TABLE coin_transactions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type            text NOT NULL,
    amount          int NOT NULL,
    balance_after   int NOT NULL,
    description     text NOT NULL,
    reference_id    text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- accounts
CREATE INDEX idx_accounts_email ON accounts(email);

-- profiles
CREATE UNIQUE INDEX idx_profiles_account_id ON profiles(account_id);

-- sessions
CREATE INDEX idx_sessions_account_id ON sessions(account_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);

-- kpi_logs
CREATE INDEX idx_kpi_logs_account_id ON kpi_logs(account_id);
CREATE INDEX idx_kpi_logs_account_id_source_type ON kpi_logs(account_id, source_type);

-- badges
CREATE INDEX idx_badges_account_id ON badges(account_id);

-- updates
CREATE INDEX idx_updates_profile_id ON updates(profile_id);

-- comments
CREATE INDEX idx_comments_update_id ON comments(update_id);

-- reports
CREATE INDEX idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX idx_reports_target_type_target_id ON reports(target_type, target_id);

-- pledges
CREATE INDEX idx_pledges_profile_id ON pledges(profile_id);

-- donations
CREATE INDEX idx_donations_profile_id ON donations(profile_id);
CREATE INDEX idx_donations_order_id ON donations(order_id);

-- events
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_group_id ON events(group_id);

-- event_rsvps — UNIQUE constraint already provides an index

-- event_invites — UNIQUE constraint already provides an index

-- event_committees — UNIQUE constraint already provides an index

-- event_tickets
CREATE INDEX idx_event_tickets_event_id ON event_tickets(event_id);
-- code is already UNIQUE

-- event_attendance
CREATE UNIQUE INDEX idx_event_attendance_ticket_id ON event_attendance(ticket_id);
CREATE INDEX idx_event_attendance_event_id_account_id ON event_attendance(event_id, account_id);

-- group_members — UNIQUE constraint already provides an index

-- messages
CREATE INDEX idx_messages_sender_account_id ON messages(sender_account_id);
CREATE INDEX idx_messages_group_id_created_at ON messages(group_id, created_at);

-- follows — (follower_account_id, followed_account_id) is already UNIQUE
CREATE INDEX idx_follows_followed_account_id ON follows(followed_account_id);

-- programs
CREATE INDEX idx_programs_created_by ON programs(created_by);

-- program_participants — UNIQUE constraint already provides an index

-- notifications
CREATE INDEX idx_notifications_recipient_account_id_read ON notifications(recipient_account_id, read);
CREATE INDEX idx_notifications_recipient_account_id_created_at ON notifications(recipient_account_id, created_at);

-- campaigns
CREATE INDEX idx_campaigns_profile_id ON campaigns(profile_id);

-- campaign_donations
CREATE INDEX idx_campaign_donations_campaign_id ON campaign_donations(campaign_id);
-- order_id is already UNIQUE

-- businesses
CREATE INDEX idx_businesses_profile_id ON businesses(profile_id);

-- business_rab
CREATE INDEX idx_business_rab_business_id ON business_rab(business_id);

-- marketplace_listings
CREATE INDEX idx_marketplace_listings_seller_profile_id ON marketplace_listings(seller_profile_id);
CREATE INDEX idx_marketplace_listings_kind_status ON marketplace_listings(kind, status);

-- subscriptions
CREATE INDEX idx_subscriptions_account_id ON subscriptions(account_id);

-- coin_transactions
CREATE INDEX idx_coin_transactions_account_id_created_at ON coin_transactions(account_id, created_at);

COMMIT;
