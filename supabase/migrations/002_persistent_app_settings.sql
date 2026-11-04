-- Store Admin configuration outside the Edge Function process so it survives
-- cold starts and separate serverless instances.
CREATE TABLE IF NOT EXISTS public.app_settings (
  setting_key text PRIMARY KEY,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_global_key CHECK (setting_key = 'global')
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_settings FROM anon, authenticated;
GRANT ALL ON TABLE public.app_settings TO service_role;
