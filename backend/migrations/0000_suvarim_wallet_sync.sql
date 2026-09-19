-- Encrypted wallet blobs. Server (service role) access only.
CREATE TABLE public.wallets (
  id text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{64}$'),
  token_hash text NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  format smallint NOT NULL DEFAULT 1,
  iv text NOT NULL CHECK (iv ~ '^[0-9a-f]{24}$'),
  data text NOT NULL CHECK (data ~ '^[0-9a-f]*$'),
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated are denied all direct access.

-- Per-IP rate limiting events (IP stored only as a salted-free SHA256 hash).
CREATE TABLE public.wallet_rate_events (
  id bigserial PRIMARY KEY,
  ip_hash text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_rate_events_lookup ON public.wallet_rate_events (ip_hash, action, created_at DESC);

GRANT ALL ON public.wallet_rate_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.wallet_rate_events_id_seq TO service_role;
ALTER TABLE public.wallet_rate_events ENABLE ROW LEVEL SECURITY;

-- Rate limiter: records the hit and returns true when allowed.
CREATE OR REPLACE FUNCTION public.wallet_rate_check(
  p_ip_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.wallet_rate_events
    WHERE created_at < now() - interval '1 hour';

  SELECT count(*) INTO v_count
    FROM public.wallet_rate_events
   WHERE ip_hash = p_ip_hash
     AND action = p_action
     AND created_at > now() - make_interval(secs => p_window_seconds);

  INSERT INTO public.wallet_rate_events (ip_hash, action) VALUES (p_ip_hash, p_action);

  RETURN v_count < p_limit;
END;
$$;

-- Insert-only create. Returns 'conflict' when the id already exists.
CREATE OR REPLACE FUNCTION public.wallet_create(
  p_id text,
  p_token_hash text,
  p_format smallint,
  p_iv text,
  p_data text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Token-authenticated read.
CREATE OR REPLACE FUNCTION public.wallet_read(p_id text, p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Atomic compare-and-swap write: auth + revision checked in a single statement.
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
SET search_path = public
AS $$
DECLARE
  w public.wallets%ROWTYPE;
  v_new public.wallets%ROWTYPE;
BEGIN
  SELECT * INTO w FROM public.wallets WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR w.token_hash <> p_token_hash THEN
    RETURN jsonb_build_object('status', 'denied');
  END IF;

  UPDATE public.wallets
     SET format = p_format,
         iv = p_iv,
         data = p_data,
         revision = revision + 1,
         updated_at = now()
   WHERE id = p_id
     AND token_hash = p_token_hash
     AND (p_expected_revision IS NULL OR revision = p_expected_revision)
  RETURNING * INTO v_new;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'conflict', 'revision', w.revision);
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'revision', v_new.revision,
    'payload', jsonb_build_object('format', v_new.format, 'iv', v_new.iv, 'data', v_new.data));
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_create(text, text, smallint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_read(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_write(text, text, smallint, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_rate_check(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_create(text, text, smallint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_read(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_write(text, text, smallint, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_rate_check(text, text, integer, integer) TO service_role;

