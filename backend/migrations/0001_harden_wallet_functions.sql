-- Strict CAS: expectedRevision is mandatory; no NULL bypass.
CREATE OR REPLACE FUNCTION public.wallet_write(
  p_id text,
  p_token_hash text,
  p_format smallint,
  p_iv text,
  p_data text,
  p_expected_revision integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  w public.wallets%ROWTYPE;
  v_new public.wallets%ROWTYPE;
BEGIN
  IF p_expected_revision IS NULL OR p_expected_revision < 1 THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT * INTO w FROM public.wallets WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR w.token_hash <> p_token_hash THEN
    RETURN jsonb_build_object('status', 'denied');
  END IF;

  UPDATE public.wallets
     SET format = p_format,
         iv = p_iv,
         data = p_data,
         revision = public.wallets.revision + 1,
         updated_at = now()
   WHERE public.wallets.id = p_id
     AND public.wallets.token_hash = p_token_hash
     AND public.wallets.revision = p_expected_revision
  RETURNING * INTO v_new;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'conflict', 'revision', w.revision);
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'revision', v_new.revision,
    'payload', jsonb_build_object('format', v_new.format, 'iv', v_new.iv, 'data', v_new.data));
END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_create(
  p_id text,
  p_token_hash text,
  p_format smallint,
  p_iv text,
  p_data text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.wallets (id, token_hash, format, iv, data)
  VALUES (p_id, p_token_hash, p_format, p_iv, p_data);
  RETURN jsonb_build_object('status', 'ok', 'revision', 1,
    'payload', jsonb_build_object('format', p_format, 'iv', p_iv, 'data', p_data));
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('status', 'conflict');
END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_read(p_id text, p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  w public.wallets%ROWTYPE;
BEGIN
  SELECT * INTO w FROM public.wallets WHERE id = p_id;
  IF NOT FOUND OR w.token_hash <> p_token_hash THEN
    RETURN jsonb_build_object('status', 'denied');
  END IF;
  RETURN jsonb_build_object('status', 'ok', 'revision', w.revision,
    'payload', jsonb_build_object('format', w.format, 'iv', w.iv, 'data', w.data));
END;
$$;

-- Serialize count+insert per (ip, action) with a transaction-scoped advisory lock.
CREATE OR REPLACE FUNCTION public.wallet_rate_check(
  p_ip_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_ip_hash || ':' || p_action, 0)
  );

  DELETE FROM public.wallet_rate_events
    WHERE created_at < pg_catalog.now() - interval '1 hour';

  SELECT pg_catalog.count(*) INTO v_count
    FROM public.wallet_rate_events
   WHERE ip_hash = p_ip_hash
     AND action = p_action
     AND created_at > pg_catalog.now() - pg_catalog.make_interval(secs => p_window_seconds);

  INSERT INTO public.wallet_rate_events (ip_hash, action) VALUES (p_ip_hash, p_action);

  RETURN v_count < p_limit;
END;
$$;

