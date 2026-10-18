-- ============================================================
-- Panti Janda: Supabase Migration Script
-- Consolidated from migrations 001-011 (32+ tables)
-- PostgreSQL / Supabase compatible with RLS, Storage, Triggers
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. CORE TABLES (from migration 001)
-- ============================================================

-- Accounts (integrate with Supabase Auth)
CREATE TABLE IF NOT EXISTS accounts (
    id              uuid PRIMARY KEY DEFAULT auth.uid(),
    email           text UNIQUE NOT NULL,
    password_hash   text,
    role            text NOT NULL DEFAULT 'public',
    status          text NOT NULL DEFAULT 'active',
    display_name    text NOT NULL,
    level           int NOT NULL DEFAULT 1,
    xp              int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    token_hash      text NOT NULL,
    expires_at      timestamptz NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id              uuid UNIQUE NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
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

-- KPI Logs
CREATE TABLE IF NOT EXISTS kpi_logs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    source_type     text NOT NULL,
    source_id       uuid,
    points          int NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- KPI Summary
CREATE TABLE IF NOT EXISTS kpi_summary (
    account_id      uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    total_points    int NOT NULL DEFAULT 0,
    level           int NOT NULL DEFAULT 1,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Badges
CREATE TABLE IF NOT EXISTS badges (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    badge_type      text NOT NULL,
    label           text NOT NULL,
    tier            int NOT NULL,
    awarded_at      timestamptz NOT NULL DEFAULT now()
);

-- Updates (feed posts)
CREATE TABLE IF NOT EXISTS updates (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title           text NOT NULL,
    body            text NOT NULL,
    status          text NOT NULL DEFAULT 'visible',
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    update_id       uuid NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    author_name     text NOT NULL,
    body            text NOT NULL,
    status          text NOT NULL DEFAULT 'visible',
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
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

-- Pledges
CREATE TABLE IF NOT EXISTS pledges (
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

-- Donations
CREATE TABLE IF NOT EXISTS donations (
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

-- Groups
CREATE TABLE IF NOT EXISTS groups (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text NOT NULL,
    description         text NOT NULL,
    audience_min_role   text NOT NULL,
    capacity            int NOT NULL DEFAULT 0,
    created_by          uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- Group Members
CREATE TABLE IF NOT EXISTS group_members (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(group_id, account_id)
);

-- Events
CREATE TABLE IF NOT EXISTS events (
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
    created_at      timestamptz NOT NULL DEFAULT now(),
    -- Migration 004 additions
    category        text NOT NULL DEFAULT 'meetup',
    tags            text,
    cover_image     text,
    timezone        text NOT NULL DEFAULT 'Asia/Jakarta',
    location_type   text NOT NULL DEFAULT 'physical',
    venue_name      text,
    venue_address   text,
    venue_maps_url  text,
    virtual_platform text,
    virtual_url     text,
    permit_required boolean NOT NULL DEFAULT false,
    requires_approval boolean NOT NULL DEFAULT false,
    live_room_status text NOT NULL DEFAULT 'idle'
);

-- Event RSVPs
CREATE TABLE IF NOT EXISTS event_rsvps (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    status          text NOT NULL DEFAULT 'going',
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(event_id, account_id)
);

-- Event Invites
CREATE TABLE IF NOT EXISTS event_invites (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(event_id, account_id)
);

-- Event Committees
CREATE TABLE IF NOT EXISTS event_committees (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    role            text NOT NULL DEFAULT 'panitia',
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(event_id, account_id)
);

-- Event Tickets
CREATE TABLE IF NOT EXISTS event_tickets (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    account_id      uuid REFERENCES accounts(id) ON DELETE SET NULL,
    code            text UNIQUE NOT NULL,
    ticket_type     text NOT NULL DEFAULT 'free',
    price           int NOT NULL DEFAULT 0,
    order_id        text,
    payment_status  text,
    status          text NOT NULL DEFAULT 'valid',
    created_at      timestamptz NOT NULL DEFAULT now(),
    tier_id         uuid
);

-- Event Attendance
CREATE TABLE IF NOT EXISTS event_attendance (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       uuid NOT NULL REFERENCES event_tickets(id) ON DELETE CASCADE,
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    scanned_by      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    checked_at      timestamptz NOT NULL DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_kind             text NOT NULL,
    sender_account_id       uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    recipient_account_id    uuid REFERENCES accounts(id) ON DELETE CASCADE,
    group_id                uuid REFERENCES groups(id) ON DELETE CASCADE,
    body                    text NOT NULL,
    created_at              timestamptz NOT NULL DEFAULT now()
);

-- Follows
CREATE TABLE IF NOT EXISTS follows (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    followed_account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE(follower_account_id, followed_account_id)
);

-- Programs
CREATE TABLE IF NOT EXISTS programs (
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

-- Program Participants
CREATE TABLE IF NOT EXISTS program_participants (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(program_id, account_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type                    text NOT NULL,
    actor_account_id        uuid REFERENCES accounts(id) ON DELETE SET NULL,
    message                 text NOT NULL,
    link                    text,
    read                    bool NOT NULL DEFAULT false,
    created_at              timestamptz NOT NULL DEFAULT now()
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
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

-- Campaign Donations
CREATE TABLE IF NOT EXISTS campaign_donations (
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

-- Businesses
CREATE TABLE IF NOT EXISTS businesses (
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

-- Business RAB
CREATE TABLE IF NOT EXISTS business_rab (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    description     text NOT NULL,
    quantity        int NOT NULL,
    unit            text NOT NULL,
    unit_price      int NOT NULL,
    total           int NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Marketplace Listings
CREATE TABLE IF NOT EXISTS marketplace_listings (
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

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
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

-- Coin Balances
CREATE TABLE IF NOT EXISTS coin_balances (
    account_id              uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    balance                 int NOT NULL DEFAULT 0,
    lifetime_purchased      int NOT NULL DEFAULT 0,
    lifetime_spent          int NOT NULL DEFAULT 0,
    updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Coin Transactions
CREATE TABLE IF NOT EXISTS coin_transactions (
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
-- 2. LEARNING CENTER TABLES (from migration 002)
-- ============================================================

CREATE TABLE IF NOT EXISTS learning_modules (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text NOT NULL,
    slug            text UNIQUE NOT NULL,
    category        text NOT NULL DEFAULT 'umum',
    description     text,
    duration_minutes int NOT NULL DEFAULT 10,
    total_lessons   int NOT NULL DEFAULT 1,
    icon            text,
    color           text,
    bg_color        text,
    monetizable     boolean NOT NULL DEFAULT false,
    downloadable    boolean NOT NULL DEFAULT true,
    status          text NOT NULL DEFAULT 'active',
    created_by      uuid REFERENCES accounts(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_lessons (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id       uuid NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
    position        int NOT NULL DEFAULT 0,
    title           text NOT NULL,
    description     text,
    content_type    text NOT NULL DEFAULT 'video',
    content_url     text,
    content_data    text,
    duration_seconds int NOT NULL DEFAULT 0,
    downloadable    boolean NOT NULL DEFAULT true,
    status          text NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_progress (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    module_id       uuid NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
    lesson_id       uuid NOT NULL REFERENCES learning_lessons(id) ON DELETE CASCADE,
    status          text NOT NULL DEFAULT 'not_started',
    completed_at    timestamptz,
    time_spent_seconds int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(account_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS learning_downloads (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    lesson_id       uuid NOT NULL REFERENCES learning_lessons(id) ON DELETE CASCADE,
    file_path       text,
    file_size_bytes bigint NOT NULL DEFAULT 0,
    downloaded_at   timestamptz NOT NULL DEFAULT now(),
    expires_at      timestamptz,
    UNIQUE(account_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS podcasts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text NOT NULL,
    description     text,
    host_name       text NOT NULL,
    host_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
    audio_url       text,
    audio_data      text,
    duration_seconds int NOT NULL DEFAULT 0,
    category        text NOT NULL DEFAULT 'umum',
    downloadable    boolean NOT NULL DEFAULT true,
    status          text NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS podcast_plays (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    podcast_id      uuid NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
    played_seconds  int NOT NULL DEFAULT 0,
    completed       boolean NOT NULL DEFAULT false,
    last_played_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(account_id, podcast_id)
);

CREATE TABLE IF NOT EXISTS success_stories (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title           text NOT NULL,
    story           text NOT NULL,
    achievement     text,
    photo_data      text,
    featured        boolean NOT NULL DEFAULT false,
    status          text NOT NULL DEFAULT 'active',
    approved_by     uuid REFERENCES accounts(id) ON DELETE SET NULL,
    approved_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forum_categories (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    slug            text UNIQUE NOT NULL,
    description     text,
    icon            text,
    color           text,
    is_private      boolean NOT NULL DEFAULT false,
    moderated       boolean NOT NULL DEFAULT true,
    position        int NOT NULL DEFAULT 0,
    status          text NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forum_topics (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     uuid NOT NULL REFERENCES forum_categories(id) ON DELETE CASCADE,
    author_id       uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title           text NOT NULL,
    body            text NOT NULL,
    is_anonymous    boolean NOT NULL DEFAULT false,
    display_name    text,
    pinned          boolean NOT NULL DEFAULT false,
    locked          boolean NOT NULL DEFAULT false,
    status          text NOT NULL DEFAULT 'active',
    view_count      int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forum_posts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id        uuid NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
    author_id       uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    body            text NOT NULL,
    is_anonymous    boolean NOT NULL DEFAULT false,
    display_name    text,
    parent_post_id  uuid REFERENCES forum_posts(id) ON DELETE CASCADE,
    status          text NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS peer_mentoring (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id       uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    mentee_id       uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    status          text NOT NULL DEFAULT 'pending',
    matched_at      timestamptz NOT NULL DEFAULT now(),
    started_at      timestamptz,
    ended_at        timestamptz,
    notes           text,
    UNIQUE(mentor_id, mentee_id)
);

CREATE TABLE IF NOT EXISTS counseling_bookings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    counselor_name  text NOT NULL,
    counselor_type  text NOT NULL DEFAULT 'psychologist',
    session_type    text NOT NULL DEFAULT 'free',
    scheduled_at    timestamptz NOT NULL,
    duration_minutes int NOT NULL DEFAULT 60,
    status          text NOT NULL DEFAULT 'pending',
    notes           text,
    meeting_url     text,
    completed_at    timestamptz,
    cancelled_at    timestamptz,
    order_id        text,
    amount          int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financial_modules (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text NOT NULL,
    slug            text UNIQUE NOT NULL,
    content_type    text NOT NULL DEFAULT 'article',
    description     text,
    body            text,
    tool_data       jsonb,
    position        int NOT NULL DEFAULT 0,
    status          text NOT NULL DEFAULT 'active',
    created_by      uuid REFERENCES accounts(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legal_modules (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text NOT NULL,
    slug            text UNIQUE NOT NULL,
    content_type    text NOT NULL DEFAULT 'article',
    description     text,
    body            text,
    position        int NOT NULL DEFAULT 0,
    status          text NOT NULL DEFAULT 'active',
    created_by      uuid REFERENCES accounts(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_listings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text NOT NULL,
    company         text NOT NULL,
    description     text,
    job_type        text NOT NULL DEFAULT 'freelance',
    salary_min      int,
    salary_max      int,
    salary_currency text NOT NULL DEFAULT 'IDR',
    remote          boolean NOT NULL DEFAULT true,
    location        text,
    requirements    text,
    skills          text[],
    contact_email   text,
    contact_url     text,
    status          text NOT NULL DEFAULT 'active',
    expires_at      timestamptz,
    created_by      uuid REFERENCES accounts(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_applications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          uuid NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    cover_letter    text,
    resume_url      text,
    status          text NOT NULL DEFAULT 'pending',
    reviewed_at     timestamptz,
    reviewed_by     uuid REFERENCES accounts(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(job_id, account_id)
);

CREATE TABLE IF NOT EXISTS incubation_programs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text NOT NULL,
    description     text,
    total_steps     int NOT NULL DEFAULT 5,
    status          text NOT NULL DEFAULT 'active',
    created_by      uuid REFERENCES accounts(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incubation_steps (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      uuid NOT NULL REFERENCES incubation_programs(id) ON DELETE CASCADE,
    position        int NOT NULL DEFAULT 0,
    title           text NOT NULL,
    description     text,
    content         text,
    milestone       text,
    status          text NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incubation_progress (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    program_id      uuid NOT NULL REFERENCES incubation_programs(id) ON DELETE CASCADE,
    step_id         uuid NOT NULL REFERENCES incubation_steps(id) ON DELETE CASCADE,
    status          text NOT NULL DEFAULT 'not_started',
    completed_at    timestamptz,
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(account_id, step_id)
);

CREATE TABLE IF NOT EXISTS learning_badges (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    slug            text UNIQUE NOT NULL,
    description     text,
    icon            text,
    emoji           text,
    category        text NOT NULL DEFAULT 'learning',
    requirement     text,
    xp_reward       int NOT NULL DEFAULT 0,
    status          text NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_badge_earnings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    badge_id        uuid NOT NULL REFERENCES learning_badges(id) ON DELETE CASCADE,
    earned_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE(account_id, badge_id)
);

CREATE TABLE IF NOT EXISTS anonymous_profiles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid UNIQUE NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    display_name    text NOT NULL,
    avatar_url      text,
    is_active       boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. CRYPTO WALLETS (from migration 003)
-- ============================================================

CREATE TABLE IF NOT EXISTS crypto_supported_coins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol text NOT NULL UNIQUE,
    name text NOT NULL,
    network text NOT NULL,
    contract_address text,
    decimals int NOT NULL DEFAULT 18,
    icon text,
    color text,
    is_active boolean NOT NULL DEFAULT true,
    coin_conversion_rate numeric(20, 4) NOT NULL DEFAULT 0,
    min_deposit numeric(20, 8) NOT NULL DEFAULT 0,
    min_withdraw numeric(20, 8) NOT NULL DEFAULT 0,
    withdraw_fee_percent numeric(5, 2) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crypto_wallets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    coin_symbol text NOT NULL,
    network text NOT NULL,
    wallet_address text NOT NULL,
    balance numeric(20, 8) NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(account_id, coin_symbol, network)
);

CREATE TABLE IF NOT EXISTS crypto_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id uuid NOT NULL REFERENCES crypto_wallets(id) ON DELETE CASCADE,
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('deposit', 'withdraw', 'swap_to_coins', 'swap_from_coins', 'transfer')),
    coin_symbol text NOT NULL,
    amount_crypto numeric(20, 8) NOT NULL,
    amount_coins int NOT NULL DEFAULT 0,
    tx_hash text,
    from_address text,
    to_address text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled')),
    description text NOT NULL DEFAULT '',
    block_number bigint,
    gas_fee numeric(20, 8),
    created_at timestamptz NOT NULL DEFAULT now(),
    confirmed_at timestamptz
);

-- ============================================================
-- 4. EVENT MANAGEMENT (from migration 004)
-- ============================================================

CREATE TABLE IF NOT EXISTS event_plans (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    target_audience     text,
    objectives          text,
    requirements        text,
    marketing_plan      text,
    promotion_channels  text,
    risk_assessment     text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_budget_items (
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

CREATE TABLE IF NOT EXISTS event_funding_sources (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    type        text NOT NULL DEFAULT 'SELF_FUNDED',
    name        text NOT NULL,
    amount      int NOT NULL DEFAULT 0,
    notes       text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_sessions (
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

CREATE TABLE IF NOT EXISTS event_speakers (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    session_id  uuid REFERENCES event_sessions(id) ON DELETE CASCADE,
    account_id  uuid REFERENCES accounts(id) ON DELETE SET NULL,
    name        text NOT NULL,
    topic       text,
    bio         text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_checklists (
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

CREATE TABLE IF NOT EXISTS event_approvals (
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

CREATE TABLE IF NOT EXISTS event_ticket_tiers (
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

CREATE TABLE IF NOT EXISTS event_expenses (
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

CREATE TABLE IF NOT EXISTS event_reports (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    kind            text NOT NULL DEFAULT 'financial',
    generated_by    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    payload         text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_audit_logs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    actor_id    uuid REFERENCES accounts(id) ON DELETE SET NULL,
    action      text NOT NULL,
    detail      text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_live_streams (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    uuid UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    provider    text NOT NULL DEFAULT 'internal',
    status      text NOT NULL DEFAULT 'idle',
    started_at  timestamptz,
    ended_at    timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. ESPORT TOURNAMENTS (from migrations 005, 006, 007, 008)
-- ============================================================

CREATE TABLE IF NOT EXISTS esport_games (
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
    created_at      timestamptz NOT NULL DEFAULT now(),
    developer       text,
    genre           text,
    platforms       jsonb,
    map_pool        jsonb,
    banner_data     text,
    default_format  text,
    default_roster_size int,
    min_players     int NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS esport_tournaments (
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
    platform                text NOT NULL DEFAULT 'mobile',
    banner_data             text,
    tags                    text,
    category                text NOT NULL DEFAULT 'amateur',
    registration_open_at    timestamptz,
    technical_meeting_at    timestamptz,
    qualifier_start_at      timestamptz,
    main_event_start_at     timestamptz,
    grand_final_at          timestamptz,
    timezone                text NOT NULL DEFAULT 'Asia/Jakarta',
    substitute_max          int NOT NULL DEFAULT 0,
    requirements            jsonb,
    funding_source          text,
    operational_budget      int NOT NULL DEFAULT 0,
    sponsorship_slots       jsonb,
    rules_detail            jsonb,
    streaming_config        jsonb,
    approval_status         text NOT NULL DEFAULT 'none',
    approval_note           text,
    approved_by             uuid REFERENCES accounts(id) ON DELETE SET NULL,
    approved_at             timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    game_mode               text,
    min_players             int NOT NULL DEFAULT 1,
    currency                text NOT NULL DEFAULT 'IDR',
    prize_status            text NOT NULL DEFAULT 'pending',
    prize_paid_at           timestamptz,
    prize_payout_note       text
);

CREATE TABLE IF NOT EXISTS esport_prizes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id   uuid NOT NULL REFERENCES esport_tournaments(id) ON DELETE CASCADE,
    placement       int NOT NULL DEFAULT 1,
    label           text NOT NULL,
    amount          int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS esport_teams (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    tag         text,
    logo_data   text,
    captain_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS esport_team_members (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     uuid NOT NULL REFERENCES esport_teams(id) ON DELETE CASCADE,
    account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    member_role text NOT NULL DEFAULT 'member',
    game_role   text,
    joined_at   timestamptz NOT NULL DEFAULT now(),
    in_game_name  text,
    in_game_id    text,
    game_rank     text,
    UNIQUE(team_id, account_id)
);

CREATE TABLE IF NOT EXISTS esport_registrations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id   uuid NOT NULL REFERENCES esport_tournaments(id) ON DELETE CASCADE,
    team_id         uuid NOT NULL REFERENCES esport_teams(id) ON DELETE CASCADE,
    seed            int,
    status          text NOT NULL DEFAULT 'registered',
    roster          text,
    group_label     text,
    registered_at   timestamptz NOT NULL DEFAULT now(),
    checked_in_at   timestamptz,
    payment_status  text NOT NULL DEFAULT 'unpaid',
    paid_at         timestamptz,
    payment_note    text,
    UNIQUE(tournament_id, team_id)
);

CREATE TABLE IF NOT EXISTS esport_matches (
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
    created_at          timestamptz NOT NULL DEFAULT now(),
    paused_at           timestamptz,
    pause_note          text
);

CREATE TABLE IF NOT EXISTS esport_disputes (
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
    created_at      timestamptz NOT NULL DEFAULT now(),
    evidence_urls   jsonb,
    investigated_at timestamptz
);

CREATE TABLE IF NOT EXISTS esport_casters (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id       uuid NOT NULL REFERENCES esport_tournaments(id) ON DELETE CASCADE,
    name                text NOT NULL,
    slot_label          text,
    contact             text,
    assigned_match_id   uuid REFERENCES esport_matches(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    caster_role         text NOT NULL DEFAULT 'main_caster'
);

CREATE TABLE IF NOT EXISTS esport_match_games (
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

CREATE TABLE IF NOT EXISTS esport_br_results (
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

CREATE TABLE IF NOT EXISTS esport_streams (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id     uuid NOT NULL REFERENCES esport_tournaments(id) ON DELETE CASCADE,
    name              text NOT NULL,
    platform          text NOT NULL DEFAULT 'youtube',
    url               text,
    current_match_id  uuid REFERENCES esport_matches(id) ON DELETE SET NULL,
    is_active         boolean NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS esport_budget_items (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id   uuid NOT NULL REFERENCES esport_tournaments(id) ON DELETE CASCADE,
    category        text NOT NULL DEFAULT 'OTHER',
    item_name       text NOT NULL,
    quantity        int NOT NULL DEFAULT 1,
    estimated_cost  int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. PERSONAL CALENDAR (from migration 009)
-- ============================================================

CREATE TABLE IF NOT EXISTS personal_calendar_items (
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

-- ============================================================
-- 7. ESPORT TRANSFER MARKET (from migrations 010, 011)
-- ============================================================

CREATE TABLE IF NOT EXISTS esport_player_profiles (
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
    real_name    text,
    birth_date   date,
    nationality  text,
    in_game_id   text,
    game_rank    text,
    role         text,
    secondary_role text,
    market_value int NOT NULL DEFAULT 0,
    buyout_clause int,
    salary_expectation int,
    avatar       text,
    banner       text,
    highlight_video text,
    achievements jsonb DEFAULT '[]'::jsonb,
    is_verified  boolean NOT NULL DEFAULT false,
    verified_at  timestamptz,
    UNIQUE(account_id, game_id)
);

CREATE TABLE IF NOT EXISTS esport_agents (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_profile_id   uuid UNIQUE NOT NULL REFERENCES esport_player_profiles(id) ON DELETE CASCADE,
    name                text NOT NULL,
    contact             text,
    commission_percent  int NOT NULL DEFAULT 10,
    active              boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    agency_name         text,
    bio                 text,
    logo                text,
    is_verified         boolean NOT NULL DEFAULT false,
    verified_at         timestamptz,
    commission_rate     numeric(5,2) NOT NULL DEFAULT 10.00,
    total_transfers     int NOT NULL DEFAULT 0,
    total_value         int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS esport_transfer_windows (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id     uuid NOT NULL REFERENCES esport_games(id) ON DELETE CASCADE,
    name        text NOT NULL,
    opens_at    timestamptz NOT NULL,
    closes_at   timestamptz NOT NULL,
    created_by  uuid REFERENCES accounts(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    max_transfers_per_team int,
    allow_loan  boolean NOT NULL DEFAULT true,
    allow_trade boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS esport_transfer_listings (
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
    updated_at         timestamptz NOT NULL DEFAULT now(),
    listed_by          uuid REFERENCES accounts(id) ON DELETE SET NULL,
    negotiable         boolean NOT NULL DEFAULT true,
    salary_requirement int,
    contract_duration  int,
    loan_option_to_buy boolean NOT NULL DEFAULT false,
    title              text,
    tags               jsonb DEFAULT '[]'::jsonb,
    is_public          boolean NOT NULL DEFAULT true,
    view_count         int NOT NULL DEFAULT 0,
    offer_count        int NOT NULL DEFAULT 0,
    expires_at         timestamptz
);

CREATE TABLE IF NOT EXISTS esport_transfer_offers (
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
    created_at     timestamptz NOT NULL DEFAULT now(),
    monthly_salary int,
    contract_duration int,
    sell_on_percentage numeric(5,2),
    addons         jsonb DEFAULT '{}'::jsonb,
    response_note  text
);

CREATE TABLE IF NOT EXISTS esport_transfers (
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
    created_at         timestamptz NOT NULL DEFAULT now(),
    monthly_salary     int,
    contract_duration  int,
    sell_on_percentage numeric(5,2),
    payment_status     text DEFAULT 'unpaid',
    escrow_status      text DEFAULT 'none',
    agreed_at          timestamptz,
    payment_deadline   timestamptz,
    announced_at       timestamptz,
    announcement_post  text
);

CREATE TABLE IF NOT EXISTS esport_player_contracts (
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
    updated_at         timestamptz NOT NULL DEFAULT now(),
    monthly_salary     int,
    currency           text DEFAULT 'koin',
    buyout_clause      int,
    sell_on_percentage numeric(5,2),
    benefits           jsonb DEFAULT '{}'::jsonb,
    is_loan            boolean NOT NULL DEFAULT false,
    loan_from_team_id  uuid REFERENCES esport_teams(id) ON DELETE SET NULL,
    loan_end_date      date,
    loan_option_to_buy boolean NOT NULL DEFAULT false,
    player_signed_at   timestamptz,
    team_signed_at     timestamptz,
    contract_doc_url   text
);

CREATE TABLE IF NOT EXISTS esport_player_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_profile_id uuid UNIQUE NOT NULL REFERENCES esport_player_profiles(id) ON DELETE CASCADE,
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
    updated_at timestamptz NOT NULL DEFAULT now()
);

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

COMMIT;

-- ============================================================
-- INDEXES
-- ============================================================

BEGIN;

-- Core tables
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
CREATE INDEX IF NOT EXISTS idx_profiles_account_id ON profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_account_id ON sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_kpi_logs_account_id ON kpi_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_kpi_logs_account_id_source_type ON kpi_logs(account_id, source_type);
CREATE INDEX IF NOT EXISTS idx_badges_account_id ON badges(account_id);
CREATE INDEX IF NOT EXISTS idx_updates_profile_id ON updates(profile_id);
CREATE INDEX IF NOT EXISTS idx_comments_update_id ON comments(update_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_target_type_target_id ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_pledges_profile_id ON pledges(profile_id);
CREATE INDEX IF NOT EXISTS idx_donations_profile_id ON donations(profile_id);
CREATE INDEX IF NOT EXISTS idx_donations_order_id ON donations(order_id);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_group_id ON events(group_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_event_id ON event_tickets(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_attendance_ticket_id ON event_attendance(ticket_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_event_id_account_id ON event_attendance(event_id, account_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_account_id ON messages(sender_account_id);
CREATE INDEX IF NOT EXISTS idx_messages_group_id_created_at ON messages(group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_follows_followed_account_id ON follows(followed_account_id);
CREATE INDEX IF NOT EXISTS idx_programs_created_by ON programs(created_by);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_account_id_read ON notifications(recipient_account_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_account_id_created_at ON notifications(recipient_account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_profile_id ON campaigns(profile_id);
CREATE INDEX IF NOT EXISTS idx_campaign_donations_campaign_id ON campaign_donations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_businesses_profile_id ON businesses(profile_id);
CREATE INDEX IF NOT EXISTS idx_business_rab_business_id ON business_rab(business_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller_profile_id ON marketplace_listings(seller_profile_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_kind_status ON marketplace_listings(kind, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_account_id ON subscriptions(account_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_account_id_created_at ON coin_transactions(account_id, created_at);

-- Learning Center
CREATE INDEX IF NOT EXISTS idx_learning_modules_category ON learning_modules(category);
CREATE INDEX IF NOT EXISTS idx_learning_modules_status ON learning_modules(status);
CREATE INDEX IF NOT EXISTS idx_learning_lessons_module ON learning_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_learning_lessons_position ON learning_lessons(module_id, position);
CREATE INDEX IF NOT EXISTS idx_learning_progress_account ON learning_progress(account_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_module ON learning_progress(account_id, module_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_status ON learning_progress(account_id, status);
CREATE INDEX IF NOT EXISTS idx_learning_downloads_account ON learning_downloads(account_id);
CREATE INDEX IF NOT EXISTS idx_podcasts_category ON podcasts(category);
CREATE INDEX IF NOT EXISTS idx_podcasts_status ON podcasts(status);
CREATE INDEX IF NOT EXISTS idx_podcast_plays_account ON podcast_plays(account_id);
CREATE INDEX IF NOT EXISTS idx_success_stories_profile ON success_stories(profile_id);
CREATE INDEX IF NOT EXISTS idx_success_stories_featured ON success_stories(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_success_stories_status ON success_stories(status);
CREATE INDEX IF NOT EXISTS idx_forum_categories_slug ON forum_categories(slug);
CREATE INDEX IF NOT EXISTS idx_forum_topics_category ON forum_topics(category_id);
CREATE INDEX IF NOT EXISTS idx_forum_topics_author ON forum_topics(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_topics_status ON forum_topics(status);
CREATE INDEX IF NOT EXISTS idx_forum_topics_created ON forum_topics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_topic ON forum_posts(topic_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON forum_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_status ON forum_posts(status);
CREATE INDEX IF NOT EXISTS idx_peer_mentoring_mentor ON peer_mentoring(mentor_id);
CREATE INDEX IF NOT EXISTS idx_peer_mentoring_mentee ON peer_mentoring(mentee_id);
CREATE INDEX IF NOT EXISTS idx_peer_mentoring_status ON peer_mentoring(status);
CREATE INDEX IF NOT EXISTS idx_counseling_bookings_account ON counseling_bookings(account_id);
CREATE INDEX IF NOT EXISTS idx_counseling_bookings_scheduled ON counseling_bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_counseling_bookings_status ON counseling_bookings(status);
CREATE INDEX IF NOT EXISTS idx_financial_modules_slug ON financial_modules(slug);
CREATE INDEX IF NOT EXISTS idx_legal_modules_slug ON legal_modules(slug);
CREATE INDEX IF NOT EXISTS idx_job_listings_type ON job_listings(job_type);
CREATE INDEX IF NOT EXISTS idx_job_listings_status ON job_listings(status);
CREATE INDEX IF NOT EXISTS idx_job_listings_remote ON job_listings(remote) WHERE remote = true;
CREATE INDEX IF NOT EXISTS idx_job_listings_expires ON job_listings(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_applications_job ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_account ON job_applications(account_id);
CREATE INDEX IF NOT EXISTS idx_incubation_steps_program ON incubation_steps(program_id);
CREATE INDEX IF NOT EXISTS idx_incubation_progress_account ON incubation_progress(account_id);
CREATE INDEX IF NOT EXISTS idx_incubation_progress_program ON incubation_progress(account_id, program_id);
CREATE INDEX IF NOT EXISTS idx_learning_badges_slug ON learning_badges(slug);
CREATE INDEX IF NOT EXISTS idx_learning_badge_earnings_account ON learning_badge_earnings(account_id);
CREATE INDEX IF NOT EXISTS idx_anonymous_profiles_account ON anonymous_profiles(account_id);

-- Crypto
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_account_id ON crypto_wallets(account_id);
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_address ON crypto_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_wallet_id ON crypto_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_account_id ON crypto_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_tx_hash ON crypto_transactions(tx_hash);

-- Event Management
CREATE INDEX IF NOT EXISTS idx_event_budget_items_event ON event_budget_items(event_id);
CREATE INDEX IF NOT EXISTS idx_event_funding_sources_event ON event_funding_sources(event_id);
CREATE INDEX IF NOT EXISTS idx_event_sessions_event ON event_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_event_speakers_event ON event_speakers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_checklists_event ON event_checklists(event_id);
CREATE INDEX IF NOT EXISTS idx_event_approvals_event ON event_approvals(event_id);
CREATE INDEX IF NOT EXISTS idx_event_ticket_tiers_event ON event_ticket_tiers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_expenses_event ON event_expenses(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reports_event ON event_reports(event_id);
CREATE INDEX IF NOT EXISTS idx_event_audit_logs_event ON event_audit_logs(event_id);

-- Esport
CREATE INDEX IF NOT EXISTS idx_esport_tournaments_creator ON esport_tournaments(creator_id);
CREATE INDEX IF NOT EXISTS idx_esport_tournaments_game ON esport_tournaments(game_id);
CREATE INDEX IF NOT EXISTS idx_esport_tournaments_status ON esport_tournaments(status);
CREATE INDEX IF NOT EXISTS idx_esport_prizes_tournament ON esport_prizes(tournament_id);
CREATE INDEX IF NOT EXISTS idx_esport_teams_captain ON esport_teams(captain_id);
CREATE INDEX IF NOT EXISTS idx_esport_team_members_team ON esport_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_esport_team_members_account ON esport_team_members(account_id);
CREATE INDEX IF NOT EXISTS idx_esport_registrations_tournament ON esport_registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_esport_matches_tournament ON esport_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_esport_matches_status ON esport_matches(status);
CREATE INDEX IF NOT EXISTS idx_esport_disputes_tournament ON esport_disputes(tournament_id);
CREATE INDEX IF NOT EXISTS idx_esport_disputes_match ON esport_disputes(match_id);
CREATE INDEX IF NOT EXISTS idx_esport_casters_tournament ON esport_casters(tournament_id);
CREATE INDEX IF NOT EXISTS idx_esport_match_games_match ON esport_match_games(match_id);
CREATE INDEX IF NOT EXISTS idx_esport_br_results_match ON esport_br_results(match_id);
CREATE INDEX IF NOT EXISTS idx_esport_br_results_registration ON esport_br_results(registration_id);
CREATE INDEX IF NOT EXISTS idx_esport_streams_tournament ON esport_streams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_esport_budget_items_tournament ON esport_budget_items(tournament_id);

-- Personal Calendar
CREATE INDEX IF NOT EXISTS idx_personal_calendar_items_account ON personal_calendar_items(account_id, date);

-- Transfer Market
CREATE INDEX IF NOT EXISTS idx_esport_player_profiles_game ON esport_player_profiles(game_id, status);
CREATE INDEX IF NOT EXISTS idx_esport_player_profiles_account ON esport_player_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_esport_player_profiles_role ON esport_player_profiles(role);
CREATE INDEX IF NOT EXISTS idx_esport_player_profiles_market_value ON esport_player_profiles(market_value DESC);
CREATE INDEX IF NOT EXISTS idx_esport_player_profiles_verified ON esport_player_profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_esport_agents_profile ON esport_agents(player_profile_id);
CREATE INDEX IF NOT EXISTS idx_esport_agents_verified ON esport_agents(is_verified);
CREATE INDEX IF NOT EXISTS idx_esport_transfer_windows_game ON esport_transfer_windows(game_id);
CREATE INDEX IF NOT EXISTS idx_esport_transfer_listings_profile ON esport_transfer_listings(player_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_esport_transfer_listings_team ON esport_transfer_listings(team_id);
CREATE INDEX IF NOT EXISTS idx_esport_transfer_listings_public ON esport_transfer_listings(is_public, status);
CREATE INDEX IF NOT EXISTS idx_esport_transfer_listings_expires ON esport_transfer_listings(expires_at);
CREATE INDEX IF NOT EXISTS idx_esport_transfer_offers_listing ON esport_transfer_offers(listing_id, status);
CREATE INDEX IF NOT EXISTS idx_esport_transfer_offers_team ON esport_transfer_offers(from_team_id);
CREATE INDEX IF NOT EXISTS idx_esport_transfers_profile ON esport_transfers(player_profile_id);
CREATE INDEX IF NOT EXISTS idx_esport_transfers_to_team ON esport_transfers(to_team_id, status);
CREATE INDEX IF NOT EXISTS idx_esport_transfers_from_team ON esport_transfers(from_team_id, status);
CREATE INDEX IF NOT EXISTS idx_esport_transfers_payment ON esport_transfers(payment_status);
CREATE INDEX IF NOT EXISTS idx_esport_player_contracts_profile ON esport_player_contracts(player_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_esport_player_contracts_team ON esport_player_contracts(team_id, status);
CREATE INDEX IF NOT EXISTS idx_esport_player_contracts_loan ON esport_player_contracts(is_loan);
CREATE INDEX IF NOT EXISTS idx_esport_player_stats_profile ON esport_player_stats(player_profile_id);
CREATE INDEX IF NOT EXISTS idx_esport_player_stats_win_rate ON esport_player_stats(win_rate DESC);
CREATE INDEX IF NOT EXISTS idx_esport_player_reviews_player ON esport_player_reviews(player_profile_id);
CREATE INDEX IF NOT EXISTS idx_esport_player_reviews_reviewer ON esport_player_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_esport_transfer_disputes_transfer ON esport_transfer_disputes(transfer_id);
CREATE INDEX IF NOT EXISTS idx_esport_transfer_disputes_status ON esport_transfer_disputes(status);
CREATE INDEX IF NOT EXISTS idx_esport_roster_history_team ON esport_roster_history(team_id);
CREATE INDEX IF NOT EXISTS idx_esport_roster_history_player ON esport_roster_history(player_profile_id);
CREATE INDEX IF NOT EXISTS idx_esport_roster_history_active ON esport_roster_history(team_id, left_at) WHERE left_at IS NULL;

COMMIT;

-- ============================================================
-- TRIGGERS FOR updated_at
-- ============================================================

BEGIN;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_donations_updated_at ON donations;
CREATE TRIGGER update_donations_updated_at BEFORE UPDATE ON donations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_marketplace_listings_updated_at ON marketplace_listings;
CREATE TRIGGER update_marketplace_listings_updated_at BEFORE UPDATE ON marketplace_listings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_learning_modules_updated_at ON learning_modules;
CREATE TRIGGER update_learning_modules_updated_at BEFORE UPDATE ON learning_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_success_stories_updated_at ON success_stories;
CREATE TRIGGER update_success_stories_updated_at BEFORE UPDATE ON success_stories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_forum_topics_updated_at ON forum_topics;
CREATE TRIGGER update_forum_topics_updated_at BEFORE UPDATE ON forum_topics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_forum_posts_updated_at ON forum_posts;
CREATE TRIGGER update_forum_posts_updated_at BEFORE UPDATE ON forum_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_anonymous_profiles_updated_at ON anonymous_profiles;
CREATE TRIGGER update_anonymous_profiles_updated_at BEFORE UPDATE ON anonymous_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_crypto_wallets_updated_at ON crypto_wallets;
CREATE TRIGGER update_crypto_wallets_updated_at BEFORE UPDATE ON crypto_wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_event_plans_updated_at ON event_plans;
CREATE TRIGGER update_event_plans_updated_at BEFORE UPDATE ON event_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_esport_tournaments_updated_at ON esport_tournaments;
CREATE TRIGGER update_esport_tournaments_updated_at BEFORE UPDATE ON esport_tournaments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_esport_teams_updated_at ON esport_teams;
CREATE TRIGGER update_esport_teams_updated_at BEFORE UPDATE ON esport_teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_personal_calendar_items_updated_at ON personal_calendar_items;
CREATE TRIGGER update_personal_calendar_items_updated_at BEFORE UPDATE ON personal_calendar_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_esport_player_profiles_updated_at ON esport_player_profiles;
CREATE TRIGGER update_esport_player_profiles_updated_at BEFORE UPDATE ON esport_player_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_esport_agents_updated_at ON esport_agents;
CREATE TRIGGER update_esport_agents_updated_at BEFORE UPDATE ON esport_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_esport_transfer_listings_updated_at ON esport_transfer_listings;
CREATE TRIGGER update_esport_transfer_listings_updated_at BEFORE UPDATE ON esport_transfer_listings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_esport_player_contracts_updated_at ON esport_player_contracts;
CREATE TRIGGER update_esport_player_contracts_updated_at BEFORE UPDATE ON esport_player_contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_esport_player_stats_updated_at ON esport_player_stats;
CREATE TRIGGER update_esport_player_stats_updated_at BEFORE UPDATE ON esport_player_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

BEGIN;

-- Enable RLS on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_rab ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE podcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE podcast_plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE success_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_mentoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE counseling_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE incubation_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE incubation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE incubation_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_badge_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE anonymous_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_supported_coins ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_funding_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_ticket_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_casters ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_match_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_br_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_calendar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_transfer_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_transfer_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_transfer_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_player_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_player_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_transfer_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE esport_roster_history ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounts WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Accounts: users can read own profile, admins can read all
DROP POLICY IF EXISTS "Accounts: read own" ON accounts;
CREATE POLICY "Accounts: read own" ON accounts FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS "Accounts: read all for admin" ON accounts;
CREATE POLICY "Accounts: read all for admin" ON accounts FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "Accounts: insert own" ON accounts;
CREATE POLICY "Accounts: insert own" ON accounts FOR INSERT WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "Accounts: update own" ON accounts;
CREATE POLICY "Accounts: update own" ON accounts FOR UPDATE USING (id = auth.uid());

-- Profiles: public read, users can update own
DROP POLICY IF EXISTS "Profiles: public read" ON profiles;
CREATE POLICY "Profiles: public read" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Profiles: insert own" ON profiles;
CREATE POLICY "Profiles: insert own" ON profiles FOR INSERT WITH CHECK (account_id = auth.uid());
DROP POLICY IF EXISTS "Profiles: update own" ON profiles;
CREATE POLICY "Profiles: update own" ON profiles FOR UPDATE USING (account_id = auth.uid());

-- Sessions: users can read own
DROP POLICY IF EXISTS "Sessions: read own" ON sessions;
CREATE POLICY "Sessions: read own" ON sessions FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Sessions: insert own" ON sessions;
CREATE POLICY "Sessions: insert own" ON sessions FOR INSERT WITH CHECK (account_id = auth.uid());
DROP POLICY IF EXISTS "Sessions: delete own" ON sessions;
CREATE POLICY "Sessions: delete own" ON sessions FOR DELETE USING (account_id = auth.uid());

-- KPI Logs: users can read own
DROP POLICY IF EXISTS "KPI Logs: read own" ON kpi_logs;
CREATE POLICY "KPI Logs: read own" ON kpi_logs FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "KPI Logs: insert own" ON kpi_logs;
CREATE POLICY "KPI Logs: insert own" ON kpi_logs FOR INSERT WITH CHECK (account_id = auth.uid());

-- KPI Summary: users can read own
DROP POLICY IF EXISTS "KPI Summary: read own" ON kpi_summary;
CREATE POLICY "KPI Summary: read own" ON kpi_summary FOR SELECT USING (account_id = auth.uid());

-- Badges: public read, users can insert own
DROP POLICY IF EXISTS "Badges: public read" ON badges;
CREATE POLICY "Badges: public read" ON badges FOR SELECT USING (true);
DROP POLICY IF EXISTS "Badges: insert own" ON badges;
CREATE POLICY "Badges: insert own" ON badges FOR INSERT WITH CHECK (account_id = auth.uid());

-- Updates: public read, users can insert/update own
DROP POLICY IF EXISTS "Updates: public read" ON updates;
CREATE POLICY "Updates: public read" ON updates FOR SELECT USING (true);
DROP POLICY IF EXISTS "Updates: insert own" ON updates;
CREATE POLICY "Updates: insert own" ON updates FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = updates.profile_id AND account_id = auth.uid()));
DROP POLICY IF EXISTS "Updates: update own" ON updates;
CREATE POLICY "Updates: update own" ON updates FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = updates.profile_id AND account_id = auth.uid()));
DROP POLICY IF EXISTS "Updates: delete own" ON updates;
CREATE POLICY "Updates: delete own" ON updates FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = updates.profile_id AND account_id = auth.uid()));

-- Comments: public read, authenticated can insert
DROP POLICY IF EXISTS "Comments: public read" ON comments;
CREATE POLICY "Comments: public read" ON comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Comments: insert authenticated" ON comments;
CREATE POLICY "Comments: insert authenticated" ON comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Comments: update own" ON comments;
CREATE POLICY "Comments: update own" ON comments FOR UPDATE USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Comments: delete own" ON comments;
CREATE POLICY "Comments: delete own" ON comments FOR DELETE USING (account_id = auth.uid());

-- Reports: users can read own, authenticated can insert
DROP POLICY IF EXISTS "Reports: read own" ON reports;
CREATE POLICY "Reports: read own" ON reports FOR SELECT USING (reporter_id = auth.uid());
DROP POLICY IF EXISTS "Reports: insert authenticated" ON reports;
CREATE POLICY "Reports: insert authenticated" ON reports FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Pledges: public read, authenticated can insert
DROP POLICY IF EXISTS "Pledges: public read" ON pledges;
CREATE POLICY "Pledges: public read" ON pledges FOR SELECT USING (true);
DROP POLICY IF EXISTS "Pledges: insert authenticated" ON pledges;
CREATE POLICY "Pledges: insert authenticated" ON pledges FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Donations: users can read own, authenticated can insert
DROP POLICY IF EXISTS "Donations: read own" ON donations;
CREATE POLICY "Donations: read own" ON donations FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = donations.profile_id AND account_id = auth.uid()));
DROP POLICY IF EXISTS "Donations: insert authenticated" ON donations;
CREATE POLICY "Donations: insert authenticated" ON donations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Groups: public read, authenticated can insert
DROP POLICY IF EXISTS "Groups: public read" ON groups;
CREATE POLICY "Groups: public read" ON groups FOR SELECT USING (true);
DROP POLICY IF EXISTS "Groups: insert authenticated" ON groups;
CREATE POLICY "Groups: insert authenticated" ON groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Groups: update creator" ON groups;
CREATE POLICY "Groups: update creator" ON groups FOR UPDATE USING (created_by = auth.uid());
DROP POLICY IF EXISTS "Groups: delete creator" ON groups;
CREATE POLICY "Groups: delete creator" ON groups FOR DELETE USING (created_by = auth.uid());

-- Group Members: members can read, authenticated can join
DROP POLICY IF EXISTS "Group Members: read members" ON group_members;
CREATE POLICY "Group Members: read members" ON group_members FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Group Members: insert own" ON group_members;
CREATE POLICY "Group Members: insert own" ON group_members FOR INSERT WITH CHECK (account_id = auth.uid());
DROP POLICY IF EXISTS "Group Members: delete own" ON group_members;
CREATE POLICY "Group Members: delete own" ON group_members FOR DELETE USING (account_id = auth.uid());

-- Events: public read, authenticated can insert
DROP POLICY IF EXISTS "Events: public read" ON events;
CREATE POLICY "Events: public read" ON events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Events: insert authenticated" ON events;
CREATE POLICY "Events: insert authenticated" ON events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Events: update creator" ON events;
CREATE POLICY "Events: update creator" ON events FOR UPDATE USING (created_by = auth.uid());
DROP POLICY IF EXISTS "Events: delete creator" ON events;
CREATE POLICY "Events: delete creator" ON events FOR DELETE USING (created_by = auth.uid());

-- Event RSVPs: users can read own, authenticated can insert
DROP POLICY IF EXISTS "Event RSVPs: read own" ON event_rsvps;
CREATE POLICY "Event RSVPs: read own" ON event_rsvps FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Event RSVPs: insert own" ON event_rsvps;
CREATE POLICY "Event RSVPs: insert own" ON event_rsvps FOR INSERT WITH CHECK (account_id = auth.uid());
DROP POLICY IF EXISTS "Event RSVPs: delete own" ON event_rsvps;
CREATE POLICY "Event RSVPs: delete own" ON event_rsvps FOR DELETE USING (account_id = auth.uid());

-- Event Invites: invited users can read
DROP POLICY IF EXISTS "Event Invites: read own" ON event_invites;
CREATE POLICY "Event Invites: read own" ON event_invites FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Event Invites: insert authenticated" ON event_invites;
CREATE POLICY "Event Invites: insert authenticated" ON event_invites FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Event Committees: committee members can read
DROP POLICY IF EXISTS "Event Committees: read own" ON event_committees;
CREATE POLICY "Event Committees: read own" ON event_committees FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Event Committees: insert authenticated" ON event_committees;
CREATE POLICY "Event Committees: insert authenticated" ON event_committees FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Event Tickets: users can read own
DROP POLICY IF EXISTS "Event Tickets: read own" ON event_tickets;
CREATE POLICY "Event Tickets: read own" ON event_tickets FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Event Tickets: insert authenticated" ON event_tickets;
CREATE POLICY "Event Tickets: insert authenticated" ON event_tickets FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Event Attendance: users can read own
DROP POLICY IF EXISTS "Event Attendance: read own" ON event_attendance;
CREATE POLICY "Event Attendance: read own" ON event_attendance FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Event Attendance: insert authenticated" ON event_attendance;
CREATE POLICY "Event Attendance: insert authenticated" ON event_attendance FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Messages: users can read sent/received
DROP POLICY IF EXISTS "Messages: read own" ON messages;
CREATE POLICY "Messages: read own" ON messages FOR SELECT USING (sender_account_id = auth.uid() OR recipient_account_id = auth.uid());
DROP POLICY IF EXISTS "Messages: insert own" ON messages;
CREATE POLICY "Messages: insert own" ON messages FOR INSERT WITH CHECK (sender_account_id = auth.uid());

-- Follows: public read, authenticated can follow
DROP POLICY IF EXISTS "Follows: public read" ON follows;
CREATE POLICY "Follows: public read" ON follows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Follows: insert own" ON follows;
CREATE POLICY "Follows: insert own" ON follows FOR INSERT WITH CHECK (follower_account_id = auth.uid());
DROP POLICY IF EXISTS "Follows: delete own" ON follows;
CREATE POLICY "Follows: delete own" ON follows FOR DELETE USING (follower_account_id = auth.uid());

-- Programs: public read, authenticated can insert
DROP POLICY IF EXISTS "Programs: public read" ON programs;
CREATE POLICY "Programs: public read" ON programs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Programs: insert authenticated" ON programs;
CREATE POLICY "Programs: insert authenticated" ON programs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Program Participants: users can read own
DROP POLICY IF EXISTS "Program Participants: read own" ON program_participants;
CREATE POLICY "Program Participants: read own" ON program_participants FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Program Participants: insert own" ON program_participants;
CREATE POLICY "Program Participants: insert own" ON program_participants FOR INSERT WITH CHECK (account_id = auth.uid());

-- Notifications: users can read own
DROP POLICY IF EXISTS "Notifications: read own" ON notifications;
CREATE POLICY "Notifications: read own" ON notifications FOR SELECT USING (recipient_account_id = auth.uid());
DROP POLICY IF EXISTS "Notifications: update own" ON notifications;
CREATE POLICY "Notifications: update own" ON notifications FOR UPDATE USING (recipient_account_id = auth.uid());

-- Campaigns: public read, authenticated can insert
DROP POLICY IF EXISTS "Campaigns: public read" ON campaigns;
CREATE POLICY "Campaigns: public read" ON campaigns FOR SELECT USING (true);
DROP POLICY IF EXISTS "Campaigns: insert authenticated" ON campaigns;
CREATE POLICY "Campaigns: insert authenticated" ON campaigns FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Campaigns: update creator" ON campaigns;
CREATE POLICY "Campaigns: update creator" ON campaigns FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = campaigns.profile_id AND account_id = auth.uid()));

-- Campaign Donations: public read, authenticated can insert
DROP POLICY IF EXISTS "Campaign Donations: public read" ON campaign_donations;
CREATE POLICY "Campaign Donations: public read" ON campaign_donations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Campaign Donations: insert authenticated" ON campaign_donations;
CREATE POLICY "Campaign Donations: insert authenticated" ON campaign_donations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Businesses: public read, users can insert own
DROP POLICY IF EXISTS "Businesses: public read" ON businesses;
CREATE POLICY "Businesses: public read" ON businesses FOR SELECT USING (true);
DROP POLICY IF EXISTS "Businesses: insert own" ON businesses;
CREATE POLICY "Businesses: insert own" ON businesses FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = businesses.profile_id AND account_id = auth.uid()));
DROP POLICY IF EXISTS "Businesses: update own" ON businesses;
CREATE POLICY "Businesses: update own" ON businesses FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = businesses.profile_id AND account_id = auth.uid()));

-- Business RAB: public read
DROP POLICY IF EXISTS "Business RAB: public read" ON business_rab;
CREATE POLICY "Business RAB: public read" ON business_rab FOR SELECT USING (true);

-- Marketplace Listings: public read, authenticated can insert
DROP POLICY IF EXISTS "Marketplace Listings: public read" ON marketplace_listings;
CREATE POLICY "Marketplace Listings: public read" ON marketplace_listings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Marketplace Listings: insert authenticated" ON marketplace_listings;
CREATE POLICY "Marketplace Listings: insert authenticated" ON marketplace_listings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Marketplace Listings: update seller" ON marketplace_listings;
CREATE POLICY "Marketplace Listings: update seller" ON marketplace_listings FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = marketplace_listings.seller_profile_id AND account_id = auth.uid()));

-- Subscriptions: users can read own
DROP POLICY IF EXISTS "Subscriptions: read own" ON subscriptions;
CREATE POLICY "Subscriptions: read own" ON subscriptions FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Subscriptions: insert own" ON subscriptions;
CREATE POLICY "Subscriptions: insert own" ON subscriptions FOR INSERT WITH CHECK (account_id = auth.uid());

-- Coin Balances: users can read own
DROP POLICY IF EXISTS "Coin Balances: read own" ON coin_balances;
CREATE POLICY "Coin Balances: read own" ON coin_balances FOR SELECT USING (account_id = auth.uid());

-- Coin Transactions: users can read own
DROP POLICY IF EXISTS "Coin Transactions: read own" ON coin_transactions;
CREATE POLICY "Coin Transactions: read own" ON coin_transactions FOR SELECT USING (account_id = auth.uid());

-- Learning Modules: public read
DROP POLICY IF EXISTS "Learning Modules: public read" ON learning_modules;
CREATE POLICY "Learning Modules: public read" ON learning_modules FOR SELECT USING (true);

-- Learning Lessons: public read
DROP POLICY IF EXISTS "Learning Lessons: public read" ON learning_lessons;
CREATE POLICY "Learning Lessons: public read" ON learning_lessons FOR SELECT USING (true);

-- Learning Progress: users can read/update own
DROP POLICY IF EXISTS "Learning Progress: read own" ON learning_progress;
CREATE POLICY "Learning Progress: read own" ON learning_progress FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Learning Progress: insert own" ON learning_progress;
CREATE POLICY "Learning Progress: insert own" ON learning_progress FOR INSERT WITH CHECK (account_id = auth.uid());
DROP POLICY IF EXISTS "Learning Progress: update own" ON learning_progress;
CREATE POLICY "Learning Progress: update own" ON learning_progress FOR UPDATE USING (account_id = auth.uid());

-- Learning Downloads: users can read own
DROP POLICY IF EXISTS "Learning Downloads: read own" ON learning_downloads;
CREATE POLICY "Learning Downloads: read own" ON learning_downloads FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Learning Downloads: insert own" ON learning_downloads;
CREATE POLICY "Learning Downloads: insert own" ON learning_downloads FOR INSERT WITH CHECK (account_id = auth.uid());

-- Podcasts: public read
DROP POLICY IF EXISTS "Podcasts: public read" ON podcasts;
CREATE POLICY "Podcasts: public read" ON podcasts FOR SELECT USING (true);

-- Podcast Plays: users can read/update own
DROP POLICY IF EXISTS "Podcast Plays: read own" ON podcast_plays;
CREATE POLICY "Podcast Plays: read own" ON podcast_plays FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Podcast Plays: insert own" ON podcast_plays;
CREATE POLICY "Podcast Plays: insert own" ON podcast_plays FOR INSERT WITH CHECK (account_id = auth.uid());
DROP POLICY IF EXISTS "Podcast Plays: update own" ON podcast_plays;
CREATE POLICY "Podcast Plays: update own" ON podcast_plays FOR UPDATE USING (account_id = auth.uid());

-- Success Stories: public read
DROP POLICY IF EXISTS "Success Stories: public read" ON success_stories;
CREATE POLICY "Success Stories: public read" ON success_stories FOR SELECT USING (true);

-- Forum Categories: public read
DROP POLICY IF EXISTS "Forum Categories: public read" ON forum_categories;
CREATE POLICY "Forum Categories: public read" ON forum_categories FOR SELECT USING (true);

-- Forum Topics: public read, authenticated can insert
DROP POLICY IF EXISTS "Forum Topics: public read" ON forum_topics;
CREATE POLICY "Forum Topics: public read" ON forum_topics FOR SELECT USING (true);
DROP POLICY IF EXISTS "Forum Topics: insert authenticated" ON forum_topics;
CREATE POLICY "Forum Topics: insert authenticated" ON forum_topics FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Forum Topics: update author" ON forum_topics;
CREATE POLICY "Forum Topics: update author" ON forum_topics FOR UPDATE USING (author_id = auth.uid());

-- Forum Posts: public read, authenticated can insert
DROP POLICY IF EXISTS "Forum Posts: public read" ON forum_posts;
CREATE POLICY "Forum Posts: public read" ON forum_posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Forum Posts: insert authenticated" ON forum_posts;
CREATE POLICY "Forum Posts: insert authenticated" ON forum_posts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Forum Posts: update author" ON forum_posts;
CREATE POLICY "Forum Posts: update author" ON forum_posts FOR UPDATE USING (author_id = auth.uid());

-- Peer Mentoring: users can read own
DROP POLICY IF EXISTS "Peer Mentoring: read own" ON peer_mentoring;
CREATE POLICY "Peer Mentoring: read own" ON peer_mentoring FOR SELECT USING (mentor_id = auth.uid() OR mentee_id = auth.uid());
DROP POLICY IF EXISTS "Peer Mentoring: insert own" ON peer_mentoring;
CREATE POLICY "Peer Mentoring: insert own" ON peer_mentoring FOR INSERT WITH CHECK (mentee_id = auth.uid());

-- Counseling Bookings: users can read own
DROP POLICY IF EXISTS "Counseling Bookings: read own" ON counseling_bookings;
CREATE POLICY "Counseling Bookings: read own" ON counseling_bookings FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Counseling Bookings: insert own" ON counseling_bookings;
CREATE POLICY "Counseling Bookings: insert own" ON counseling_bookings FOR INSERT WITH CHECK (account_id = auth.uid());

-- Financial Modules: public read
DROP POLICY IF EXISTS "Financial Modules: public read" ON financial_modules;
CREATE POLICY "Financial Modules: public read" ON financial_modules FOR SELECT USING (true);

-- Legal Modules: public read
DROP POLICY IF EXISTS "Legal Modules: public read" ON legal_modules;
CREATE POLICY "Legal Modules: public read" ON legal_modules FOR SELECT USING (true);

-- Job Listings: public read
DROP POLICY IF EXISTS "Job Listings: public read" ON job_listings;
CREATE POLICY "Job Listings: public read" ON job_listings FOR SELECT USING (true);

-- Job Applications: users can read own
DROP POLICY IF EXISTS "Job Applications: read own" ON job_applications;
CREATE POLICY "Job Applications: read own" ON job_applications FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Job Applications: insert own" ON job_applications;
CREATE POLICY "Job Applications: insert own" ON job_applications FOR INSERT WITH CHECK (account_id = auth.uid());

-- Incubation Programs: public read
DROP POLICY IF EXISTS "Incubation Programs: public read" ON incubation_programs;
CREATE POLICY "Incubation Programs: public read" ON incubation_programs FOR SELECT USING (true);

-- Incubation Steps: public read
DROP POLICY IF EXISTS "Incubation Steps: public read" ON incubation_steps;
CREATE POLICY "Incubation Steps: public read" ON incubation_steps FOR SELECT USING (true);

-- Incubation Progress: users can read own
DROP POLICY IF EXISTS "Incubation Progress: read own" ON incubation_progress;
CREATE POLICY "Incubation Progress: read own" ON incubation_progress FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Incubation Progress: insert own" ON incubation_progress;
CREATE POLICY "Incubation Progress: insert own" ON incubation_progress FOR INSERT WITH CHECK (account_id = auth.uid());
DROP POLICY IF EXISTS "Incubation Progress: update own" ON incubation_progress;
CREATE POLICY "Incubation Progress: update own" ON incubation_progress FOR UPDATE USING (account_id = auth.uid());

-- Learning Badges: public read
DROP POLICY IF EXISTS "Learning Badges: public read" ON learning_badges;
CREATE POLICY "Learning Badges: public read" ON learning_badges FOR SELECT USING (true);

-- Learning Badge Earnings: users can read own
DROP POLICY IF EXISTS "Learning Badge Earnings: read own" ON learning_badge_earnings;
CREATE POLICY "Learning Badge Earnings: read own" ON learning_badge_earnings FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Learning Badge Earnings: insert own" ON learning_badge_earnings;
CREATE POLICY "Learning Badge Earnings: insert own" ON learning_badge_earnings FOR INSERT WITH CHECK (account_id = auth.uid());

-- Anonymous Profiles: users can read own
DROP POLICY IF EXISTS "Anonymous Profiles: read own" ON anonymous_profiles;
CREATE POLICY "Anonymous Profiles: read own" ON anonymous_profiles FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Anonymous Profiles: insert own" ON anonymous_profiles;
CREATE POLICY "Anonymous Profiles: insert own" ON anonymous_profiles FOR INSERT WITH CHECK (account_id = auth.uid());
DROP POLICY IF EXISTS "Anonymous Profiles: update own" ON anonymous_profiles;
CREATE POLICY "Anonymous Profiles: update own" ON anonymous_profiles FOR UPDATE USING (account_id = auth.uid());

-- Crypto Supported Coins: public read
DROP POLICY IF EXISTS "Crypto Supported Coins: public read" ON crypto_supported_coins;
CREATE POLICY "Crypto Supported Coins: public read" ON crypto_supported_coins FOR SELECT USING (true);

-- Crypto Wallets: users can read own
DROP POLICY IF EXISTS "Crypto Wallets: read own" ON crypto_wallets;
CREATE POLICY "Crypto Wallets: read own" ON crypto_wallets FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Crypto Wallets: insert own" ON crypto_wallets;
CREATE POLICY "Crypto Wallets: insert own" ON crypto_wallets FOR INSERT WITH CHECK (account_id = auth.uid());
DROP POLICY IF EXISTS "Crypto Wallets: update own" ON crypto_wallets;
CREATE POLICY "Crypto Wallets: update own" ON crypto_wallets FOR UPDATE USING (account_id = auth.uid());

-- Crypto Transactions: users can read own
DROP POLICY IF EXISTS "Crypto Transactions: read own" ON crypto_transactions;
CREATE POLICY "Crypto Transactions: read own" ON crypto_transactions FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Crypto Transactions: insert own" ON crypto_transactions;
CREATE POLICY "Crypto Transactions: insert own" ON crypto_transactions FOR INSERT WITH CHECK (account_id = auth.uid());

-- Event Plans: public read
DROP POLICY IF EXISTS "Event Plans: public read" ON event_plans;
CREATE POLICY "Event Plans: public read" ON event_plans FOR SELECT USING (true);

-- Event Budget Items: public read
DROP POLICY IF EXISTS "Event Budget Items: public read" ON event_budget_items;
CREATE POLICY "Event Budget Items: public read" ON event_budget_items FOR SELECT USING (true);

-- Event Funding Sources: public read
DROP POLICY IF EXISTS "Event Funding Sources: public read" ON event_funding_sources;
CREATE POLICY "Event Funding Sources: public read" ON event_funding_sources FOR SELECT USING (true);

-- Event Sessions: public read
DROP POLICY IF EXISTS "Event Sessions: public read" ON event_sessions;
CREATE POLICY "Event Sessions: public read" ON event_sessions FOR SELECT USING (true);

-- Event Speakers: public read
DROP POLICY IF EXISTS "Event Speakers: public read" ON event_speakers;
CREATE POLICY "Event Speakers: public read" ON event_speakers FOR SELECT USING (true);

-- Event Checklists: public read
DROP POLICY IF EXISTS "Event Checklists: public read" ON event_checklists;
CREATE POLICY "Event Checklists: public read" ON event_checklists FOR SELECT USING (true);

-- Event Approvals: public read
DROP POLICY IF EXISTS "Event Approvals: public read" ON event_approvals;
CREATE POLICY "Event Approvals: public read" ON event_approvals FOR SELECT USING (true);

-- Event Ticket Tiers: public read
DROP POLICY IF EXISTS "Event Ticket Tiers: public read" ON event_ticket_tiers;
CREATE POLICY "Event Ticket Tiers: public read" ON event_ticket_tiers FOR SELECT USING (true);

-- Event Expenses: public read
DROP POLICY IF EXISTS "Event Expenses: public read" ON event_expenses;
CREATE POLICY "Event Expenses: public read" ON event_expenses FOR SELECT USING (true);

-- Event Reports: public read
DROP POLICY IF EXISTS "Event Reports: public read" ON event_reports;
CREATE POLICY "Event Reports: public read" ON event_reports FOR SELECT USING (true);

-- Event Audit Logs: public read
DROP POLICY IF EXISTS "Event Audit Logs: public read" ON event_audit_logs;
CREATE POLICY "Event Audit Logs: public read" ON event_audit_logs FOR SELECT USING (true);

-- Event Live Streams: public read
DROP POLICY IF EXISTS "Event Live Streams: public read" ON event_live_streams;
CREATE POLICY "Event Live Streams: public read" ON event_live_streams FOR SELECT USING (true);

-- Esport Games: public read
DROP POLICY IF EXISTS "Esport Games: public read" ON esport_games;
CREATE POLICY "Esport Games: public read" ON esport_games FOR SELECT USING (true);

-- Esport Tournaments: public read, authenticated can insert
DROP POLICY IF EXISTS "Esport Tournaments: public read" ON esport_tournaments;
CREATE POLICY "Esport Tournaments: public read" ON esport_tournaments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Esport Tournaments: insert authenticated" ON esport_tournaments;
CREATE POLICY "Esport Tournaments: insert authenticated" ON esport_tournaments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Esport Tournaments: update creator" ON esport_tournaments;
CREATE POLICY "Esport Tournaments: update creator" ON esport_tournaments FOR UPDATE USING (creator_id = auth.uid());

-- Esport Prizes: public read
DROP POLICY IF EXISTS "Esport Prizes: public read" ON esport_prizes;
CREATE POLICY "Esport Prizes: public read" ON esport_prizes FOR SELECT USING (true);

-- Esport Teams: public read, authenticated can insert
DROP POLICY IF EXISTS "Esport Teams: public read" ON esport_teams;
CREATE POLICY "Esport Teams: public read" ON esport_teams FOR SELECT USING (true);
DROP POLICY IF EXISTS "Esport Teams: insert authenticated" ON esport_teams;
CREATE POLICY "Esport Teams: insert authenticated" ON esport_teams FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Esport Teams: update captain" ON esport_teams;
CREATE POLICY "Esport Teams: update captain" ON esport_teams FOR UPDATE USING (captain_id = auth.uid());

-- Esport Team Members: public read
DROP POLICY IF EXISTS "Esport Team Members: public read" ON esport_team_members;
CREATE POLICY "Esport Team Members: public read" ON esport_team_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "Esport Team Members: insert own" ON esport_team_members;
CREATE POLICY "Esport Team Members: insert own" ON esport_team_members FOR INSERT WITH CHECK (account_id = auth.uid());

-- Esport Registrations: public read
DROP POLICY IF EXISTS "Esport Registrations: public read" ON esport_registrations;
CREATE POLICY "Esport Registrations: public read" ON esport_registrations FOR SELECT USING (true);

-- Esport Matches: public read
DROP POLICY IF EXISTS "Esport Matches: public read" ON esport_matches;
CREATE POLICY "Esport Matches: public read" ON esport_matches FOR SELECT USING (true);

-- Esport Disputes: public read
DROP POLICY IF EXISTS "Esport Disputes: public read" ON esport_disputes;
CREATE POLICY "Esport Disputes: public read" ON esport_disputes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Esport Disputes: insert authenticated" ON esport_disputes;
CREATE POLICY "Esport Disputes: insert authenticated" ON esport_disputes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Esport Casters: public read
DROP POLICY IF EXISTS "Esport Casters: public read" ON esport_casters;
CREATE POLICY "Esport Casters: public read" ON esport_casters FOR SELECT USING (true);

-- Esport Match Games: public read
DROP POLICY IF EXISTS "Esport Match Games: public read" ON esport_match_games;
CREATE POLICY "Esport Match Games: public read" ON esport_match_games FOR SELECT USING (true);

-- Esport BR Results: public read
DROP POLICY IF EXISTS "Esport BR Results: public read" ON esport_br_results;
CREATE POLICY "Esport BR Results: public read" ON esport_br_results FOR SELECT USING (true);

-- Esport Streams: public read
DROP POLICY IF EXISTS "Esport Streams: public read" ON esport_streams;
CREATE POLICY "Esport Streams: public read" ON esport_streams FOR SELECT USING (true);

-- Esport Budget Items: public read
DROP POLICY IF EXISTS "Esport Budget Items: public read" ON esport_budget_items;
CREATE POLICY "Esport Budget Items: public read" ON esport_budget_items FOR SELECT USING (true);

-- Personal Calendar Items: users can read own
DROP POLICY IF EXISTS "Personal Calendar: read own" ON personal_calendar_items;
CREATE POLICY "Personal Calendar: read own" ON personal_calendar_items FOR SELECT USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Personal Calendar: insert own" ON personal_calendar_items;
CREATE POLICY "Personal Calendar: insert own" ON personal_calendar_items FOR INSERT WITH CHECK (account_id = auth.uid());
DROP POLICY IF EXISTS "Personal Calendar: update own" ON personal_calendar_items;
CREATE POLICY "Personal Calendar: update own" ON personal_calendar_items FOR UPDATE USING (account_id = auth.uid());
DROP POLICY IF EXISTS "Personal Calendar: delete own" ON personal_calendar_items;
CREATE POLICY "Personal Calendar: delete own" ON personal_calendar_items FOR DELETE USING (account_id = auth.uid());

-- Esport Player Profiles: public read, authenticated can insert own
DROP POLICY IF EXISTS "Esport Player Profiles: public read" ON esport_player_profiles;
CREATE POLICY "Esport Player Profiles: public read" ON esport_player_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Esport Player Profiles: insert own" ON esport_player_profiles;
CREATE POLICY "Esport Player Profiles: insert own" ON esport_player_profiles FOR INSERT WITH CHECK (account_id = auth.uid());
DROP POLICY IF EXISTS "Esport Player Profiles: update own" ON esport_player_profiles;
CREATE POLICY "Esport Player Profiles: update own" ON esport_player_profiles FOR UPDATE USING (account_id = auth.uid());

-- Esport Agents: public read
DROP POLICY IF EXISTS "Esport Agents: public read" ON esport_agents;
CREATE POLICY "Esport Agents: public read" ON esport_agents FOR SELECT USING (true);

-- Esport Transfer Windows: public read
DROP POLICY IF EXISTS "Esport Transfer Windows: public read" ON esport_transfer_windows;
CREATE POLICY "Esport Transfer Windows: public read" ON esport_transfer_windows FOR SELECT USING (true);

-- Esport Transfer Listings: public read, authenticated can insert
DROP POLICY IF EXISTS "Esport Transfer Listings: public read" ON esport_transfer_listings;
CREATE POLICY "Esport Transfer Listings: public read" ON esport_transfer_listings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Esport Transfer Listings: insert authenticated" ON esport_transfer_listings;
CREATE POLICY "Esport Transfer Listings: insert authenticated" ON esport_transfer_listings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Esport Transfer Listings: update creator" ON esport_transfer_listings;
CREATE POLICY "Esport Transfer Listings: update creator" ON esport_transfer_listings FOR UPDATE USING (created_by = auth.uid());

-- Esport Transfer Offers: public read, authenticated can insert
DROP POLICY IF EXISTS "Esport Transfer Offers: public read" ON esport_transfer_offers;
CREATE POLICY "Esport Transfer Offers: public read" ON esport_transfer_offers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Esport Transfer Offers: insert authenticated" ON esport_transfer_offers;
CREATE POLICY "Esport Transfer Offers: insert authenticated" ON esport_transfer_offers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Esport Transfers: public read
DROP POLICY IF EXISTS "Esport Transfers: public read" ON esport_transfers;
CREATE POLICY "Esport Transfers: public read" ON esport_transfers FOR SELECT USING (true);

-- Esport Player Contracts: public read
DROP POLICY IF EXISTS "Esport Player Contracts: public read" ON esport_player_contracts;
CREATE POLICY "Esport Player Contracts: public read" ON esport_player_contracts FOR SELECT USING (true);

-- Esport Player Stats: public read
DROP POLICY IF EXISTS "Esport Player Stats: public read" ON esport_player_stats;
CREATE POLICY "Esport Player Stats: public read" ON esport_player_stats FOR SELECT USING (true);

-- Esport Player Reviews: public read, authenticated can insert
DROP POLICY IF EXISTS "Esport Player Reviews: public read" ON esport_player_reviews;
CREATE POLICY "Esport Player Reviews: public read" ON esport_player_reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Esport Player Reviews: insert authenticated" ON esport_player_reviews;
CREATE POLICY "Esport Player Reviews: insert authenticated" ON esport_player_reviews FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Esport Transfer Disputes: public read, authenticated can insert
DROP POLICY IF EXISTS "Esport Transfer Disputes: public read" ON esport_transfer_disputes;
CREATE POLICY "Esport Transfer Disputes: public read" ON esport_transfer_disputes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Esport Transfer Disputes: insert authenticated" ON esport_transfer_disputes;
CREATE POLICY "Esport Transfer Disputes: insert authenticated" ON esport_transfer_disputes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Esport Roster History: public read
DROP POLICY IF EXISTS "Esport Roster History: public read" ON esport_roster_history;
CREATE POLICY "Esport Roster History: public read" ON esport_roster_history FOR SELECT USING (true);

COMMIT;

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

BEGIN;

-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES
  ('profile-photos', 'Profile Photos', true),
  ('event-covers', 'Event Covers', true),
  ('tournament-banners', 'Tournament Banners', true),
  ('media-uploads', 'Media Uploads', true),
  ('business-proposals', 'Business Proposals', false),
  ('learning-content', 'Learning Content', true),
  ('crypto-documents', 'Crypto Documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: allow authenticated users to upload
DROP POLICY IF EXISTS "Profile Photos: upload authenticated" ON storage.objects;
CREATE POLICY "Profile Photos: upload authenticated" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-photos' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Profile Photos: read public" ON storage.objects;
CREATE POLICY "Profile Photos: read public" ON storage.objects FOR SELECT USING (bucket_id = 'profile-photos');
DROP POLICY IF EXISTS "Profile Photos: update own" ON storage.objects;
CREATE POLICY "Profile Photos: update own" ON storage.objects FOR UPDATE USING (bucket_id = 'profile-photos' AND owner = auth.uid());
DROP POLICY IF EXISTS "Profile Photos: delete own" ON storage.objects;
CREATE POLICY "Profile Photos: delete own" ON storage.objects FOR DELETE USING (bucket_id = 'profile-photos' AND owner = auth.uid());

DROP POLICY IF EXISTS "Event Covers: upload authenticated" ON storage.objects;
CREATE POLICY "Event Covers: upload authenticated" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-covers' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Event Covers: read public" ON storage.objects;
CREATE POLICY "Event Covers: read public" ON storage.objects FOR SELECT USING (bucket_id = 'event-covers');

DROP POLICY IF EXISTS "Tournament Banners: upload authenticated" ON storage.objects;
CREATE POLICY "Tournament Banners: upload authenticated" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tournament-banners' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Tournament Banners: read public" ON storage.objects;
CREATE POLICY "Tournament Banners: read public" ON storage.objects FOR SELECT USING (bucket_id = 'tournament-banners');

DROP POLICY IF EXISTS "Media Uploads: upload authenticated" ON storage.objects;
CREATE POLICY "Media Uploads: upload authenticated" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media-uploads' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Media Uploads: read public" ON storage.objects;
CREATE POLICY "Media Uploads: read public" ON storage.objects FOR SELECT USING (bucket_id = 'media-uploads');
DROP POLICY IF EXISTS "Media Uploads: delete own" ON storage.objects;
CREATE POLICY "Media Uploads: delete own" ON storage.objects FOR DELETE USING (bucket_id = 'media-uploads' AND owner = auth.uid());

DROP POLICY IF EXISTS "Business Proposals: upload authenticated" ON storage.objects;
CREATE POLICY "Business Proposals: upload authenticated" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'business-proposals' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Business Proposals: read own" ON storage.objects;
CREATE POLICY "Business Proposals: read own" ON storage.objects FOR SELECT USING (bucket_id = 'business-proposals' AND owner = auth.uid());

DROP POLICY IF EXISTS "Learning Content: upload authenticated" ON storage.objects;
CREATE POLICY "Learning Content: upload authenticated" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'learning-content' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Learning Content: read public" ON storage.objects;
CREATE POLICY "Learning Content: read public" ON storage.objects FOR SELECT USING (bucket_id = 'learning-content');

DROP POLICY IF EXISTS "Crypto Documents: upload authenticated" ON storage.objects;
CREATE POLICY "Crypto Documents: upload authenticated" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'crypto-documents' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Crypto Documents: read own" ON storage.objects;
CREATE POLICY "Crypto Documents: read own" ON storage.objects FOR SELECT USING (bucket_id = 'crypto-documents' AND owner = auth.uid());

COMMIT;

-- ============================================================
-- SEED DATA
-- ============================================================

BEGIN;

-- Insert default esport games
INSERT INTO esport_games (slug, name, mode, team_size_min, team_size_max, roster_max, icon, active, sort_order, developer, genre, platforms, map_pool, default_format, default_roster_size, min_players) VALUES
  ('mobile-legends', 'Mobile Legends: Bang Bang', 'MOBA 5v5', 5, 5, 7, '⚔️', true, 1, 'Moonton', 'MOBA', '["mobile"]'::jsonb, '["Land of Dawn", "Sanctuary", "Imperial Sanctuary"]'::jsonb, 'single_elim', 5, 5),
  ('pubg-mobile', 'PUBG Mobile', 'Battle Royale Squad', 4, 4, 6, '🎯', true, 2, 'Tencent Games', 'Battle Royale', '["mobile"]'::jsonb, '["Erangel", "Miramar", "Sanhok", "Livik"]'::jsonb, 'battle_royale', 4, 4),
  ('free-fire', 'Free Fire', 'Battle Royale Squad', 4, 4, 6, '🔥', true, 3, 'Garena', 'Battle Royale', '["mobile"]'::jsonb, '["Bermuda", "Purgatory", "Kalahari"]'::jsonb, 'battle_royale', 4, 4),
  ('valorant', 'Valorant', 'Tactical FPS 5v5', 5, 5, 7, '🔫', true, 4, 'Riot Games', 'Tactical FPS', '["pc"]'::jsonb, '["Ascent", "Bind", "Haven", "Split"]'::jsonb, 'single_elim', 5, 5),
  ('dota-2', 'Dota 2', 'MOBA 5v5', 5, 5, 7, '🛡️', true, 5, 'Valve', 'MOBA', '["pc"]'::jsonb, '["Dota Map"]'::jsonb, 'double_elim', 5, 5),
  ('point-blank', 'Point Blank', 'FPS 5v5', 5, 5, 7, '💣', true, 6, 'Zepetto', 'FPS', '["pc"]'::jsonb, '["Downtown", "Red Rock", "Crackdown", "Saint Mansion"]'::jsonb, 'single_elim', 5, 5),
  ('efootball', 'eFootball', 'Sepak Bola 1v1', 1, 1, 2, '⚽', true, 7, 'Konami', 'Sports', '["pc", "console", "mobile"]'::jsonb, '[]'::jsonb, 'league', 1, 1)
ON CONFLICT (slug) DO NOTHING;

-- Insert default crypto supported coins
INSERT INTO crypto_supported_coins (symbol, name, network, contract_address, decimals, icon, color, coin_conversion_rate, min_deposit, min_withdraw, withdraw_fee_percent) VALUES
  ('USDT', 'Tether USD', 'TRC20', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 6, 'DollarSign', '#26A17B', 100, 1.0, 5.0, 1.5),
  ('USDT-ERC20', 'Tether USD', 'ERC20', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 'DollarSign', '#26A17B', 95, 5.0, 10.0, 2.5),
  ('USDC', 'USD Coin', 'ERC20', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'DollarSign', '#2775CA', 98, 5.0, 10.0, 2.0),
  ('ETH', 'Ethereum', 'ERC20', null, 18, 'Eth', '#627EEA', 350000, 0.001, 0.01, 1.0),
  ('BNB', 'Binance Coin', 'BEP20', null, 18, 'Coins', '#F3BA2F', 600000, 0.005, 0.05, 1.0),
  ('BTC', 'Bitcoin', 'Bitcoin', null, 8, 'Bitcoin', '#F7931A', 50000000, 0.0001, 0.001, 0.5),
  ('SOL', 'Solana', 'Solana', null, 9, 'Zap', '#9945FF', 15000, 0.01, 0.1, 1.0),
  ('MATIC', 'Polygon', 'ERC20', '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', 18, 'Hexagon', '#8247E5', 10000, 1.0, 10.0, 1.5)
ON CONFLICT (symbol) DO NOTHING;

COMMIT;

-- ============================================================
-- DONE
-- ============================================================

-- Migration complete! All 32+ tables created with RLS, indexes, triggers, and storage buckets.
