-- In-call WebRTC renegotiation. Existing offer/answer and candidate arrays stay
-- intact for revision 0 and older clients; later revisions are stored separately.
BEGIN;

ALTER TABLE public.call_signals
  ADD COLUMN IF NOT EXISTS current_revision integer NOT NULL DEFAULT 0
    CHECK (current_revision >= 0);

CREATE TABLE IF NOT EXISTS public.call_signal_negotiations (
  call_id uuid NOT NULL REFERENCES public.call_signals(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision > 0),
  offerer_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('audio', 'video')),
  offer jsonb NOT NULL CHECK (jsonb_typeof(offer) = 'object'),
  answer jsonb CHECK (answer IS NULL OR jsonb_typeof(answer) = 'object'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (call_id, revision)
);
CREATE INDEX IF NOT EXISTS call_signal_negotiations_pending_idx
  ON public.call_signal_negotiations (call_id, revision DESC)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.call_signal_candidates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  call_id uuid NOT NULL REFERENCES public.call_signals(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision >= 0),
  sender_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  candidate jsonb NOT NULL CHECK (jsonb_typeof(candidate) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS call_signal_candidates_call_idx
  ON public.call_signal_candidates (call_id, id);
CREATE INDEX IF NOT EXISTS call_signal_candidates_sender_idx
  ON public.call_signal_candidates (call_id, sender_account_id, id);

ALTER TABLE public.call_signal_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_signal_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.call_signal_negotiations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.call_signal_candidates FROM PUBLIC, anon, authenticated;

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

    -- An unsupported/closed client cannot leave a renegotiation pending forever.
    UPDATE public.call_signal_negotiations
      SET status = 'rejected', updated_at = now()
      WHERE call_id = v_call.id AND revision = v_call.current_revision
        AND status = 'pending' AND created_at < now() - interval '60 seconds';

    v_is_caller := v_call.caller_account_id = v_actor;
    RETURN jsonb_build_object('call', jsonb_build_object(
      'id', v_call.id, 'mode', v_call.mode,
      'callerAccountId', v_call.caller_account_id, 'recipientAccountId', v_call.recipient_account_id,
      'status', v_call.status, 'offer', v_call.offer, 'answer', v_call.answer,
      'remoteCandidates', CASE WHEN v_is_caller THEN v_call.recipient_candidates ELSE v_call.caller_candidates END,
      'duration', v_call.duration,
      'currentRevision', v_call.current_revision,
      'renegotiation', (
        SELECT jsonb_build_object(
          'revision', n.revision, 'mode', n.mode,
          'offererAccountId', n.offerer_account_id,
          'offer', n.offer, 'answer', n.answer, 'status', n.status
        )
        FROM public.call_signal_negotiations n
        WHERE n.call_id = v_call.id AND n.revision = v_call.current_revision
      ),
      'negotiationCandidates', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', c.id, 'revision', c.revision, 'candidate', c.candidate
        ) ORDER BY c.id)
        FROM (
          SELECT id, revision, candidate
          FROM public.call_signal_candidates
          WHERE call_id = v_call.id AND sender_account_id <> v_actor
          ORDER BY id DESC LIMIT 512
        ) c
      ), '[]'::jsonb)
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

CREATE OR REPLACE FUNCTION public.call_signal_renegotiate_offer(
  p_session_id uuid, p_call_id uuid, p_expected_revision integer, p_mode text, p_offer jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_call public.call_signals%ROWTYPE; v_existing public.call_signal_negotiations%ROWTYPE; v_revision integer;
BEGIN
  v_actor := public.call_signal_actor(p_session_id);
  IF v_actor IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;
  IF p_call_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0 OR p_expected_revision >= 2147483647
      OR p_mode IS NULL OR p_mode NOT IN ('audio', 'video')
      OR jsonb_typeof(p_offer) IS DISTINCT FROM 'object'
      OR length(p_offer::text) > 100000 OR p_offer->>'type' IS DISTINCT FROM 'offer'
      OR coalesce(p_offer->>'sdp', '') = '' THEN
    RETURN jsonb_build_object('error', 'invalid_input');
  END IF;

  SELECT * INTO v_call FROM public.call_signals WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND OR (v_call.caller_account_id <> v_actor AND v_call.recipient_account_id <> v_actor) THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_call.status <> 'active' THEN RETURN jsonb_build_object('error', 'call_not_active'); END IF;

  -- Expire a stale request, then serialize all simultaneous offers on the call row.
  UPDATE public.call_signal_negotiations
    SET status = 'rejected', updated_at = now()
    WHERE call_id = p_call_id AND revision = v_call.current_revision
      AND status = 'pending' AND created_at < now() - interval '60 seconds';
  IF v_call.current_revision = p_expected_revision + 1 THEN
    SELECT * INTO v_existing FROM public.call_signal_negotiations
      WHERE call_id = p_call_id AND revision = v_call.current_revision
        AND offerer_account_id = v_actor AND mode = p_mode AND offer = p_offer;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'revision', v_existing.revision, 'status', v_existing.status);
    END IF;
  END IF;
  IF v_call.current_revision <> p_expected_revision OR EXISTS (
    SELECT 1 FROM public.call_signal_negotiations
    WHERE call_id = p_call_id AND revision = v_call.current_revision AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('error', 'offer_conflict');
  END IF;

  v_revision := v_call.current_revision + 1;
  INSERT INTO public.call_signal_negotiations
    (call_id, revision, offerer_account_id, mode, offer)
  VALUES (p_call_id, v_revision, v_actor, p_mode, p_offer);
  UPDATE public.call_signals
    SET current_revision = v_revision, updated_at = now()
    WHERE id = p_call_id;
  RETURN jsonb_build_object('ok', true, 'revision', v_revision);
END $$;

CREATE OR REPLACE FUNCTION public.call_signal_renegotiate_answer(
  p_session_id uuid, p_call_id uuid, p_revision integer, p_answer jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_call public.call_signals%ROWTYPE; v_neg public.call_signal_negotiations%ROWTYPE;
BEGIN
  v_actor := public.call_signal_actor(p_session_id);
  IF v_actor IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;
  IF p_call_id IS NULL OR p_revision IS NULL OR p_revision < 1
      OR jsonb_typeof(p_answer) IS DISTINCT FROM 'object'
      OR length(p_answer::text) > 100000 OR p_answer->>'type' IS DISTINCT FROM 'answer'
      OR coalesce(p_answer->>'sdp', '') = '' THEN
    RETURN jsonb_build_object('error', 'invalid_input');
  END IF;

  SELECT * INTO v_call FROM public.call_signals WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND OR (v_call.caller_account_id <> v_actor AND v_call.recipient_account_id <> v_actor) THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_call.status <> 'active' THEN RETURN jsonb_build_object('error', 'call_not_active'); END IF;
  IF v_call.current_revision <> p_revision THEN RETURN jsonb_build_object('error', 'stale_revision'); END IF;

  SELECT * INTO v_neg FROM public.call_signal_negotiations
    WHERE call_id = p_call_id AND revision = p_revision FOR UPDATE;
  IF NOT FOUND OR v_neg.status <> 'pending' THEN
    RETURN jsonb_build_object('error', 'negotiation_not_found');
  END IF;
  IF v_neg.offerer_account_id = v_actor THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;

  UPDATE public.call_signal_negotiations
    SET answer = p_answer, status = 'accepted', updated_at = now()
    WHERE call_id = p_call_id AND revision = p_revision;
  UPDATE public.call_signals SET mode = v_neg.mode, updated_at = now() WHERE id = p_call_id;
  RETURN jsonb_build_object('ok', true, 'revision', p_revision, 'mode', v_neg.mode);
END $$;

CREATE OR REPLACE FUNCTION public.call_signal_renegotiate_reject(
  p_session_id uuid, p_call_id uuid, p_revision integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_call public.call_signals%ROWTYPE; v_neg public.call_signal_negotiations%ROWTYPE;
BEGIN
  v_actor := public.call_signal_actor(p_session_id);
  IF v_actor IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;
  IF p_call_id IS NULL OR p_revision IS NULL OR p_revision < 1 THEN
    RETURN jsonb_build_object('error', 'invalid_input');
  END IF;

  SELECT * INTO v_call FROM public.call_signals WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND OR (v_call.caller_account_id <> v_actor AND v_call.recipient_account_id <> v_actor) THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_call.status <> 'active' THEN RETURN jsonb_build_object('error', 'call_not_active'); END IF;
  IF v_call.current_revision <> p_revision THEN RETURN jsonb_build_object('error', 'stale_revision'); END IF;

  SELECT * INTO v_neg FROM public.call_signal_negotiations
    WHERE call_id = p_call_id AND revision = p_revision FOR UPDATE;
  IF NOT FOUND OR v_neg.status <> 'pending' THEN
    RETURN jsonb_build_object('error', 'negotiation_not_found');
  END IF;
  IF v_neg.offerer_account_id = v_actor THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;

  UPDATE public.call_signal_negotiations
    SET status = 'rejected', updated_at = now()
    WHERE call_id = p_call_id AND revision = p_revision;
  RETURN jsonb_build_object('ok', true, 'revision', p_revision);
END $$;

-- Revision 0 is the original SDP exchange. Keep its legacy RPC for cached clients;
-- revision-tagged candidates (including revision 0) use this bounded participant-owned table.
CREATE OR REPLACE FUNCTION public.call_signal_candidate_v2(
  p_session_id uuid, p_call_id uuid, p_revision integer, p_candidate jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_call public.call_signals%ROWTYPE; v_count integer;
BEGIN
  v_actor := public.call_signal_actor(p_session_id);
  IF v_actor IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;
  IF p_call_id IS NULL OR p_revision IS NULL OR p_revision < 0
      OR jsonb_typeof(p_candidate) IS DISTINCT FROM 'object'
      OR length(p_candidate::text) > 8192 THEN
    RETURN jsonb_build_object('error', 'invalid_input');
  END IF;

  SELECT * INTO v_call FROM public.call_signals WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND OR (v_call.caller_account_id <> v_actor AND v_call.recipient_account_id <> v_actor) THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_call.status NOT IN ('ringing', 'active') THEN
    RETURN jsonb_build_object('error', 'call_not_active');
  END IF;
  IF p_revision > 0 AND NOT EXISTS (
    SELECT 1 FROM public.call_signal_negotiations
    WHERE call_id = p_call_id AND revision = p_revision
  ) THEN
    RETURN jsonb_build_object('error', 'stale_revision');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.call_signal_candidates
    WHERE call_id = p_call_id AND revision = p_revision
      AND sender_account_id = v_actor AND candidate = p_candidate
  ) THEN
    RETURN jsonb_build_object('ok', true);
  END IF;
  SELECT count(*) INTO v_count FROM public.call_signal_candidates
    WHERE call_id = p_call_id AND sender_account_id = v_actor;
  IF v_count >= 256 THEN RETURN jsonb_build_object('error', 'candidate_limit'); END IF;

  INSERT INTO public.call_signal_candidates (call_id, revision, sender_account_id, candidate)
  VALUES (p_call_id, p_revision, v_actor, p_candidate);
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.call_signal_poll(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.call_signal_renegotiate_offer(uuid, uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.call_signal_renegotiate_answer(uuid, uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.call_signal_renegotiate_reject(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.call_signal_candidate_v2(uuid, uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_signal_poll(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_signal_renegotiate_offer(uuid, uuid, integer, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_signal_renegotiate_answer(uuid, uuid, integer, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_signal_renegotiate_reject(uuid, uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_signal_candidate_v2(uuid, uuid, integer, jsonb) TO anon, authenticated;

COMMIT;
