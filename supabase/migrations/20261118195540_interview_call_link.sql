BEGIN;

-- WebRTC signaling calls can be associated with a scheduled online interview.
-- The app handler validates the two exact participants and schedule window
-- before setting this reference; signaling remains otherwise unchanged.
ALTER TABLE public.call_signals
  ADD COLUMN IF NOT EXISTS interview_id uuid REFERENCES public.job_interviews(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS call_signals_interview_id_idx
  ON public.call_signals (interview_id) WHERE interview_id IS NOT NULL;

COMMIT;
