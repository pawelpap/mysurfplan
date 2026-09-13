-- Additive A6 foundation. No changes to accounts, lessons or forecasts.
CREATE TABLE job_environment (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  environment text UNIQUE NOT NULL CHECK (environment IN ('staging','production'))
);
CREATE TABLE job_outbox (
  id uuid PRIMARY KEY,
  environment text NOT NULL REFERENCES job_environment(environment),
  type text NOT NULL CHECK (type = 'email.delivery_check'),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 150),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  requires_user boolean NOT NULL DEFAULT false,
  user_auth_version integer,
  recipient_hash text NOT NULL CHECK (recipient_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending','leased','accepted','delivered','delivery_unknown','failed','cancelled','expired')),
  priority integer NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 10),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at),
  lease_token uuid,
  lease_until timestamptz,
  dispatch_started_at timestamptz,
  provider_id text,
  error_code text,
  UNIQUE (environment,idempotency_key),
  CHECK (payload IS NULL OR (jsonb_typeof(payload)='object' AND octet_length(payload::text)<8192)),
  CHECK (status NOT IN ('pending','leased') OR payload IS NOT NULL)
);
CREATE INDEX job_outbox_due ON job_outbox(environment,priority DESC,due_at) WHERE status='pending';
CREATE INDEX job_outbox_lease ON job_outbox(lease_until) WHERE status='leased';
CREATE INDEX job_outbox_retention ON job_outbox(updated_at);
CREATE TABLE email_suppressions (
  environment text NOT NULL REFERENCES job_environment(environment),
  recipient_hash text NOT NULL CHECK (recipient_hash ~ '^[0-9a-f]{64}$'),
  reason text NOT NULL CHECK (reason IN ('hard_bounce','spam','unsub')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(environment,recipient_hash)
);
CREATE TABLE email_event_receipts (
  event_hash text PRIMARY KEY CHECK (event_hash ~ '^[0-9a-f]{64}$'),
  job_id uuid NOT NULL REFERENCES job_outbox(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('sent','bounce','blocked','spam','unsub')),
  event_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE email_usage (
  environment text NOT NULL REFERENCES job_environment(environment),
  period text NOT NULL CHECK (period IN ('day','month')),
  starts_on date NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0),
  PRIMARY KEY(environment,period,starts_on)
);
CREATE TABLE job_worker_status (
  environment text PRIMARY KEY REFERENCES job_environment(environment),
  started_at timestamptz,
  completed_at timestamptz,
  last_error text
);

CREATE FUNCTION enqueue_delivery_check(p_id uuid,p_environment text,p_key text,p_user uuid,
  p_auth_version integer,p_hash text,p_payload jsonb,p_operator boolean) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE existing_id uuid; existing_hash text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('email-enqueue:'||p_environment,0));
  SELECT id,recipient_hash INTO existing_id,existing_hash FROM job_outbox
    WHERE environment=p_environment AND idempotency_key=p_key;
  IF FOUND THEN
    IF existing_hash<>p_hash THEN RAISE EXCEPTION 'Email idempotency conflict'; END IF;
    RETURN existing_id;
  END IF;
  IF p_operator AND EXISTS(SELECT 1 FROM job_outbox WHERE environment=p_environment AND created_at>now()-interval '1 minute') THEN
    RETURN NULL;
  END IF;
  INSERT INTO job_outbox(id,environment,type,idempotency_key,user_id,requires_user,user_auth_version,recipient_hash,payload,expires_at)
    VALUES(p_id,p_environment,'email.delivery_check',p_key,p_user,p_user IS NOT NULL,p_auth_version,p_hash,p_payload,now()+interval '2 hours');
  RETURN p_id;
END $$;

-- Serialise quota reservation with dispatch marking, then release the lock before
-- making a network request. A lease lost after this point is never blindly resent.
CREATE FUNCTION prepare_email_dispatch(p_id uuid,p_lease uuid,p_environment text,
  p_recipient text,p_daily integer,p_monthly integer) RETURNS text LANGUAGE plpgsql AS $$
DECLARE j job_outbox; used_day integer; used_month integer;
  today date := (now() AT TIME ZONE 'UTC')::date;
  month_start date := date_trunc('month',now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF p_daily<1 OR p_monthly<p_daily THEN RAISE EXCEPTION 'Invalid email budget'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('email-budget:'||p_environment,0));
  SELECT * INTO j FROM job_outbox WHERE id=p_id AND environment=p_environment FOR UPDATE;
  IF NOT FOUND OR j.status<>'leased' OR j.lease_token IS DISTINCT FROM p_lease
    OR j.lease_until<=now() OR j.dispatch_started_at IS NOT NULL THEN RETURN 'lost_lease'; END IF;
  IF j.expires_at<=now() OR j.attempts>=6 THEN
    UPDATE job_outbox SET status='expired',payload=NULL,updated_at=now(),error_code='job_expired' WHERE id=p_id;
    RETURN 'expired';
  END IF;
  IF EXISTS (SELECT 1 FROM email_suppressions WHERE environment=p_environment AND recipient_hash=j.recipient_hash)
    OR (j.requires_user AND NOT EXISTS(SELECT 1 FROM users WHERE id=j.user_id AND
      deleted_at IS NULL AND disabled_at IS NULL AND auth_version=j.user_auth_version AND lower(email)=p_recipient)) THEN
    UPDATE job_outbox SET status='cancelled',payload=NULL,updated_at=now(),error_code='recipient_unavailable' WHERE id=p_id;
    RETURN 'cancelled';
  END IF;
  INSERT INTO email_usage(environment,period,starts_on) VALUES
    (p_environment,'day',today),(p_environment,'month',month_start) ON CONFLICT DO NOTHING;
  SELECT attempts INTO used_day FROM email_usage WHERE environment=p_environment AND period='day' AND starts_on=today;
  SELECT attempts INTO used_month FROM email_usage WHERE environment=p_environment AND period='month' AND starts_on=month_start;
  IF used_day>=p_daily OR used_month>=p_monthly THEN
    UPDATE job_outbox SET status='pending',lease_token=NULL,lease_until=NULL,updated_at=now(),error_code='email_budget_exhausted',
      due_at=(CASE WHEN used_month>=p_monthly THEN month_start+interval '1 month' ELSE today+interval '1 day' END) AT TIME ZONE 'UTC'
      WHERE id=p_id;
    RETURN 'budget_exhausted';
  END IF;
  UPDATE email_usage SET attempts=attempts+1 WHERE environment=p_environment AND
    ((period='day' AND starts_on=today) OR (period='month' AND starts_on=month_start));
  UPDATE job_outbox SET attempts=attempts+1,dispatch_started_at=now(),updated_at=now() WHERE id=p_id;
  RETURN 'ready';
END $$;

CREATE FUNCTION record_email_event(p_environment text,p_job uuid,p_hash text,p_type text,
  p_time timestamptz,p_recipient_hash text,p_provider_id text,p_suppress text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE j job_outbox; receipt_count integer;
BEGIN
  SELECT * INTO j FROM job_outbox WHERE id=p_job AND environment=p_environment FOR UPDATE;
  IF NOT FOUND OR j.recipient_hash<>p_recipient_hash OR j.dispatch_started_at IS NULL
    OR (j.provider_id IS NOT NULL AND p_provider_id IS NOT NULL AND j.provider_id<>p_provider_id) THEN RETURN false; END IF;
  INSERT INTO email_event_receipts(event_hash,job_id,event_type,event_at)
    VALUES(p_hash,p_job,p_type,p_time) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS receipt_count = ROW_COUNT;
  IF receipt_count=0 THEN RETURN false; END IF;
  IF p_suppress IS NOT NULL THEN
    INSERT INTO email_suppressions(environment,recipient_hash,reason) VALUES(p_environment,p_recipient_hash,p_suppress)
      ON CONFLICT DO NOTHING;
  END IF;
  -- Negative terminal events dominate late 'sent' callbacks. Soft bounces are
  -- recorded without resending: the provider can still deliver them later.
  IF p_suppress IS NOT NULL OR p_type='blocked' THEN
    UPDATE job_outbox SET status='failed',payload=NULL,error_code='delivery_'||p_type,updated_at=now(),
      provider_id=coalesce(provider_id,p_provider_id) WHERE id=p_job;
  ELSIF p_type='sent' AND j.status IN ('leased','accepted','delivery_unknown') THEN
    UPDATE job_outbox SET status='delivered',payload=NULL,error_code=NULL,updated_at=now(),
      provider_id=coalesce(provider_id,p_provider_id) WHERE id=p_job;
  END IF;
  RETURN true;
END $$;
