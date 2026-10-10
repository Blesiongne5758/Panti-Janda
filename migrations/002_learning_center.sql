-- Panti Janda: Learning Center Schema Migration
-- Adds 19 tables for the Learning Center feature
-- PostgreSQL / Supabase compatible

BEGIN;

-- ============================================================
-- 1. learning_modules — Micro-learning courses
-- ============================================================
CREATE TABLE learning_modules (
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

-- ============================================================
-- 2. learning_lessons — Individual lessons within a module
-- ============================================================
CREATE TABLE learning_lessons (
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

-- ============================================================
-- 3. learning_progress — Track user progress per lesson
-- ============================================================
CREATE TABLE learning_progress (
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

-- ============================================================
-- 4. learning_downloads — Track downloaded content for offline
-- ============================================================
CREATE TABLE learning_downloads (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    lesson_id       uuid NOT NULL REFERENCES learning_lessons(id) ON DELETE CASCADE,
    file_path       text,
    file_size_bytes bigint NOT NULL DEFAULT 0,
    downloaded_at   timestamptz NOT NULL DEFAULT now(),
    expires_at      timestamptz,
    UNIQUE(account_id, lesson_id)
);

-- ============================================================
-- 5. podcasts — Podcast episodes
-- ============================================================
CREATE TABLE podcasts (
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

-- ============================================================
-- 6. podcast_plays — Track listening history
-- ============================================================
CREATE TABLE podcast_plays (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    podcast_id      uuid NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
    played_seconds  int NOT NULL DEFAULT 0,
    completed       boolean NOT NULL DEFAULT false,
    last_played_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(account_id, podcast_id)
);

-- ============================================================
-- 7. success_stories — Inspirational stories from members
-- ============================================================
CREATE TABLE success_stories (
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

-- ============================================================
-- 8. forum_categories — Forum categories
-- ============================================================
CREATE TABLE forum_categories (
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

-- ============================================================
-- 9. forum_topics — Forum discussion topics
-- ============================================================
CREATE TABLE forum_topics (
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

-- ============================================================
-- 10. forum_posts — Posts within forum topics
-- ============================================================
CREATE TABLE forum_posts (
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

-- ============================================================
-- 11. peer_mentoring — Mentor-mentee pairings
-- ============================================================
CREATE TABLE peer_mentoring (
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

-- ============================================================
-- 12. counseling_bookings — Counseling session bookings
-- ============================================================
CREATE TABLE counseling_bookings (
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

-- ============================================================
-- 13. financial_modules — Financial literacy content
-- ============================================================
CREATE TABLE financial_modules (
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

-- ============================================================
-- 14. legal_modules — Legal literacy content
-- ============================================================
CREATE TABLE legal_modules (
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

-- ============================================================
-- 15. job_listings — Job board for remote/part-time work
-- ============================================================
CREATE TABLE job_listings (
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

-- ============================================================
-- 16. job_applications — Applications to job listings
-- ============================================================
CREATE TABLE job_applications (
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

-- ============================================================
-- 17. incubation_programs — Business incubation programs
-- ============================================================
CREATE TABLE incubation_programs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text NOT NULL,
    description     text,
    total_steps     int NOT NULL DEFAULT 5,
    status          text NOT NULL DEFAULT 'active',
    created_by      uuid REFERENCES accounts(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 18. incubation_steps — Steps within an incubation program
-- ============================================================
CREATE TABLE incubation_steps (
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

-- ============================================================
-- 19. incubation_progress — User progress through incubation
-- ============================================================
CREATE TABLE incubation_progress (
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

-- ============================================================
-- 20. learning_badges — Learning-specific achievements
-- ============================================================
CREATE TABLE learning_badges (
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

-- ============================================================
-- 21. learning_badge_earnings — Earned learning badges
-- ============================================================
CREATE TABLE learning_badge_earnings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    badge_id        uuid NOT NULL REFERENCES learning_badges(id) ON DELETE CASCADE,
    earned_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE(account_id, badge_id)
);

-- ============================================================
-- 22. anonymous_profiles — Pseudonyms for forum privacy
-- ============================================================
CREATE TABLE anonymous_profiles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    display_name    text NOT NULL,
    avatar_url      text,
    is_active       boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(account_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Learning modules & lessons
CREATE INDEX idx_learning_modules_category ON learning_modules(category);
CREATE INDEX idx_learning_modules_status ON learning_modules(status);
CREATE INDEX idx_learning_lessons_module ON learning_lessons(module_id);
CREATE INDEX idx_learning_lessons_position ON learning_lessons(module_id, position);

-- Learning progress
CREATE INDEX idx_learning_progress_account ON learning_progress(account_id);
CREATE INDEX idx_learning_progress_module ON learning_progress(account_id, module_id);
CREATE INDEX idx_learning_progress_status ON learning_progress(account_id, status);

-- Downloads
CREATE INDEX idx_learning_downloads_account ON learning_downloads(account_id);

-- Podcasts
CREATE INDEX idx_podcasts_category ON podcasts(category);
CREATE INDEX idx_podcasts_status ON podcasts(status);
CREATE INDEX idx_podcast_plays_account ON podcast_plays(account_id);

-- Success stories
CREATE INDEX idx_success_stories_profile ON success_stories(profile_id);
CREATE INDEX idx_success_stories_featured ON success_stories(featured) WHERE featured = true;
CREATE INDEX idx_success_stories_status ON success_stories(status);

-- Forum
CREATE INDEX idx_forum_categories_slug ON forum_categories(slug);
CREATE INDEX idx_forum_topics_category ON forum_topics(category_id);
CREATE INDEX idx_forum_topics_author ON forum_topics(author_id);
CREATE INDEX idx_forum_topics_status ON forum_topics(status);
CREATE INDEX idx_forum_topics_created ON forum_topics(created_at DESC);
CREATE INDEX idx_forum_posts_topic ON forum_posts(topic_id);
CREATE INDEX idx_forum_posts_author ON forum_posts(author_id);
CREATE INDEX idx_forum_posts_status ON forum_posts(status);

-- Peer mentoring
CREATE INDEX idx_peer_mentoring_mentor ON peer_mentoring(mentor_id);
CREATE INDEX idx_peer_mentoring_mentee ON peer_mentoring(mentee_id);
CREATE INDEX idx_peer_mentoring_status ON peer_mentoring(status);

-- Counseling
CREATE INDEX idx_counseling_bookings_account ON counseling_bookings(account_id);
CREATE INDEX idx_counseling_bookings_scheduled ON counseling_bookings(scheduled_at);
CREATE INDEX idx_counseling_bookings_status ON counseling_bookings(status);

-- Financial & Legal modules
CREATE INDEX idx_financial_modules_slug ON financial_modules(slug);
CREATE INDEX idx_legal_modules_slug ON legal_modules(slug);

-- Job listings
CREATE INDEX idx_job_listings_type ON job_listings(job_type);
CREATE INDEX idx_job_listings_status ON job_listings(status);
CREATE INDEX idx_job_listings_remote ON job_listings(remote) WHERE remote = true;
CREATE INDEX idx_job_listings_expires ON job_listings(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_job_applications_job ON job_applications(job_id);
CREATE INDEX idx_job_applications_account ON job_applications(account_id);

-- Incubation
CREATE INDEX idx_incubation_steps_program ON incubation_steps(program_id);
CREATE INDEX idx_incubation_progress_account ON incubation_progress(account_id);
CREATE INDEX idx_incubation_progress_program ON incubation_progress(account_id, program_id);

-- Learning badges
CREATE INDEX idx_learning_badges_slug ON learning_badges(slug);
CREATE INDEX idx_learning_badge_earnings_account ON learning_badge_earnings(account_id);

-- Anonymous profiles
CREATE INDEX idx_anonymous_profiles_account ON anonymous_profiles(account_id);

COMMIT;
