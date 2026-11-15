-- Durable WebRTC signaling shared by all API/edge-function instances.
-- The table is inaccessible to API roles; all access goes through SECURITY DEFINER
-- RPCs that validate the app's own session row before reading or changing a call.
BEGIN;

CREATE TABLE IF NOT EXISTS public.call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  recipient_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('audio', 'video')),
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'ended', 'rejected', 'missed')),
  offer jsonb NOT NULL,
  answer jsonb,
  caller_candidates jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(caller_candidates) = 'array'),
  recipient_candidates jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(recipient_candidates) = 'array'),
  duration integer NOT NULL DEFAULT 0 CHECK (duration >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (caller_account_id <> recipient_account_id)
);
CREATE INDEX IF NOT EXISTS call_signals_recipient_ringing_idx
  ON public.call_signals (recipient_account_id, created_at DESC)
  WHERE status = 'ringing';
CREATE INDEX IF NOT EXISTS call_signals_updated_at_idx ON public.call_signals (updated_at);

ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.call_signals FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.call_signal_actor(p_session_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.account_id
  FROM public.sessions s
  JOIN public.accounts a ON a.id = s.account_id
  WHERE s.id = p_session_id
    AND s.expires_at > now()
    AND a.status = 'active'
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.call_signal_actor(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.call_signal_start(
  p_session_id uuid, p_recipient_account_id uuid, p_mode text, p_offer jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_id uuid;
BEGIN
  v_actor := public.call_signal_actor(p_session_id);
  IF v_actor IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;
  IF p_recipient_account_id IS NULL OR p_recipient_account_id = v_actor THEN
    RETURN jsonb_build_object('error', 'invalid_input');
  END IF;
  IF p_mode NOT IN ('audio', 'video') OR jsonb_typeof(p_offer) <> 'object'
      OR length(p_offer::text) > 100000 OR p_offer->>'type' <> 'offer' OR coalesce(p_offer->>'sdp', '') = '' THEN
    RETURN jsonb_build_object('error', 'invalid_input');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_recipient_account_id AND status = 'active') THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  DELETE FROM public.call_signals WHERE updated_at < now() - interval '1 day';
  INSERT INTO public.call_signals (caller_account_id, recipient_account_id, mode, offer)
  VALUES (v_actor, p_recipient_account_id, p_mode, p_offer) RETURNING id INTO v_id;
  RETURN jsonb_build_object('call', jsonb_build_object(
    'id', v_id, 'mode', p_mode, 'callerAccountId', v_actor,
    'recipientAccountId', p_recipient_account_id, 'status', 'ringing',
    'createdAt', extract(epoch FROM now()) * 1000
  ));
END $$;

CREATE OR REPLACE FUNCTION public.call_signal_poll(p_session_id uuid, p_call_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_call public.call_signals%ROWTYPE; v_is_caller boolean;
BEGIN
  v_actor := public.call_signal_actor(p_session_id);
  IF v_actor IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;
  IF p_call_id IS NOT NULL THEN
    SELECT * INTO v_call FROM public.call_signals WHERE id = p_call_id
      AND (caller_account_id = v_actor OR recipient_account_id = v_actor);
    IF NOT FOUND THEN RETURN jsonb_build_object('call', NULL); END IF;
    v_is_caller := v_call.caller_account_id = v_actor;
    RETURN jsonb_build_object('call', jsonb_build_object(
      'id', v_call.id, 'mode', v_call.mode,
      'callerAccountId', v_call.caller_account_id, 'recipientAccountId', v_call.recipient_account_id,
      'status', v_call.status, 'offer', v_call.offer, 'answer', v_call.answer,
      'remoteCandidates', CASE WHEN v_is_caller THEN v_call.recipient_candidates ELSE v_call.caller_candidates END,
      'duration', v_call.duration
    ));
  END IF;
  SELECT * INTO v_call FROM public.call_signals
    WHERE recipient_account_id = v_actor AND status = 'ringing'
      AND created_at >= now() - interval '45 seconds'
    ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('incomingCall', jsonb_build_object(
      'callId', v_call.id, 'id', v_call.id, 'mode', v_call.mode,
      'callerAccountId', v_call.caller_account_id,
      'callerName', coalesce((SELECT p.nickname FROM public.profiles p WHERE p.account_id = v_call.caller_account_id),
                             (SELECT a.display_name FROM public.accounts a WHERE a.id = v_call.caller_account_id), 'Pengguna'),
      'callerPhoto', (SELECT p.photo_data FROM public.profiles p WHERE p.account_id = v_call.caller_account_id),
      'offer', v_call.offer, 'createdAt', extract(epoch FROM v_call.created_at) * 1000
    ));
  END IF;
  UPDATE public.call_signals SET status = 'missed', updated_at = now()
    WHERE recipient_account_id = v_actor AND status = 'ringing'
      AND created_at < now() - interval '45 seconds';
  RETURN jsonb_build_object('incomingCall', NULL);
END $$;

CREATE OR REPLACE FUNCTION public.call_signal_answer(p_session_id uuid, p_call_id uuid, p_answer jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid;
BEGIN
  v_actor := public.call_signal_actor(p_session_id);
  IF v_actor IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;
  IF p_call_id IS NULL OR jsonb_typeof(p_answer) <> 'object'
      OR length(p_answer::text) > 100000 OR p_answer->>'type' <> 'answer' OR coalesce(p_answer->>'sdp', '') = '' THEN
    RETURN jsonb_build_object('error', 'invalid_input');
  END IF;
  UPDATE public.call_signals SET status = 'active', answer = p_answer, updated_at = now()
    WHERE id = p_call_id AND recipient_account_id = v_actor AND status = 'ringing'
      AND created_at >= now() - interval '45 seconds';
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.call_signal_candidate(p_session_id uuid, p_call_id uuid, p_candidate jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid;
BEGIN
  v_actor := public.call_signal_actor(p_session_id);
  IF v_actor IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;
  IF p_call_id IS NULL OR jsonb_typeof(p_candidate) <> 'object' OR length(p_candidate::text) > 8192 THEN
    RETURN jsonb_build_object('error', 'invalid_input');
  END IF;
  UPDATE public.call_signals SET
    caller_candidates = CASE WHEN caller_account_id = v_actor THEN caller_candidates || jsonb_build_array(p_candidate) ELSE caller_candidates END,
    recipient_candidates = CASE WHEN recipient_account_id = v_actor THEN recipient_candidates || jsonb_build_array(p_candidate) ELSE recipient_candidates END,
    updated_at = now()
    WHERE id = p_call_id AND status IN ('ringing', 'active')
      AND ((caller_account_id = v_actor AND jsonb_array_length(caller_candidates) < 256)
        OR (recipient_account_id = v_actor AND jsonb_array_length(recipient_candidates) < 256));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.call_signal_end(p_session_id uuid, p_call_id uuid, p_reason text, p_duration integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_call public.call_signals%ROWTYPE; v_next text;
BEGIN
  v_actor := public.call_signal_actor(p_session_id);
  IF v_actor IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;
  IF p_call_id IS NULL THEN RETURN jsonb_build_object('error', 'invalid_input'); END IF;
  SELECT * INTO v_call FROM public.call_signals WHERE id = p_call_id
    AND (caller_account_id = v_actor OR recipient_account_id = v_actor) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true); END IF;
  IF v_call.status IN ('ringing', 'active') THEN
    v_next := CASE WHEN p_reason = 'rejected' THEN 'rejected' WHEN p_reason = 'missed' THEN 'missed' ELSE 'ended' END;
    UPDATE public.call_signals SET status = v_next, duration = least(greatest(coalesce(p_duration, 0), 0), 86400), updated_at = now()
      WHERE id = p_call_id RETURNING * INTO v_call;
    RETURN jsonb_build_object('ok', true, 'transitioned', true, 'call', jsonb_build_object(
      'callerAccountId', v_call.caller_account_id, 'recipientAccountId', v_call.recipient_account_id,
      'mode', v_call.mode, 'status', v_call.status, 'duration', v_call.duration
    ));
  END IF;
  RETURN jsonb_build_object('ok', true, 'transitioned', false);
END $$;

REVOKE ALL ON FUNCTION public.call_signal_start(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.call_signal_poll(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.call_signal_answer(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.call_signal_candidate(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.call_signal_end(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_signal_start(uuid, uuid, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_signal_poll(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_signal_answer(uuid, uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_signal_candidate(uuid, uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_signal_end(uuid, uuid, text, integer) TO anon, authenticated;

COMMIT;
