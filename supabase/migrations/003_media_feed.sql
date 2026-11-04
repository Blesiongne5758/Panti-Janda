-- Persistent photo and short-video feed used by the serverless app function.
CREATE TABLE IF NOT EXISTS public.media_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('photo', 'video')),
  media_url text NOT NULL,
  caption text,
  duration integer CHECK (duration IS NULL OR duration BETWEEN 1 AND 6),
  share_count integer NOT NULL DEFAULT 0 CHECK (share_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_posts_created_at_idx ON public.media_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS media_posts_account_created_idx ON public.media_posts (account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.media_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.media_posts(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, account_id)
);

CREATE INDEX IF NOT EXISTS media_post_likes_post_idx ON public.media_post_likes (post_id);

CREATE TABLE IF NOT EXISTS public.media_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.media_posts(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_post_comments_post_idx ON public.media_post_comments (post_id, created_at);

ALTER TABLE public.media_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_post_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.media_posts, public.media_post_likes, public.media_post_comments FROM anon, authenticated;
GRANT ALL ON TABLE public.media_posts, public.media_post_likes, public.media_post_comments TO service_role;
