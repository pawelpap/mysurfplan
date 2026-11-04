-- Signup and recovery extend the existing identity and email stores.
ALTER TABLE users ADD COLUMN adult_attested_at timestamptz;

CREATE TABLE account_email_challenges (
  purpose text NOT NULL CHECK (purpose IN ('verify','reset')),
  recipient_hash text NOT NULL CHECK (recipient_hash ~ '^[0-9a-f]{64}$'),
  email text NOT NULL,
  token_hash text UNIQUE NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  job_id uuid UNIQUE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  auth_version integer,
  next_path text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > issued_at),
  CHECK ((purpose='verify' AND user_id IS NULL AND auth_version IS NULL)
      OR (purpose='reset' AND user_id IS NOT NULL AND auth_version IS NOT NULL))
);
ALTER TABLE account_email_challenges ADD PRIMARY KEY (purpose, recipient_hash);
CREATE INDEX account_email_challenges_expiry ON account_email_challenges(expires_at);

ALTER TABLE job_outbox DROP CONSTRAINT job_outbox_type_check;
ALTER TABLE job_outbox ADD CONSTRAINT job_outbox_type_check
  CHECK (type IN ('email.delivery_check','email.account_verify','email.account_reset'));

-- The challenge and the durable encrypted message are written together.
CREATE FUNCTION queue_account_email(
  p_purpose text, p_email text, p_recipient_hash text, p_token_hash text,
  p_job uuid, p_environment text, p_payload jsonb, p_next text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  person users;
  cutoff timestamptz;
BEGIN
  IF p_environment IS DISTINCT FROM (SELECT environment FROM job_environment WHERE singleton)
     OR p_purpose NOT IN ('verify','reset') THEN
    RAISE EXCEPTION 'Invalid account email binding';
  END IF;

  SELECT * INTO person FROM users WHERE lower(email)=p_email AND deleted_at IS NULL;
  IF p_purpose='verify' THEN
    IF FOUND THEN RETURN; END IF;
    cutoff := now()+interval '24 hours';
  ELSE
    IF NOT FOUND OR person.disabled_at IS NOT NULL OR person.is_demo
       OR person.email_verified_at IS NULL OR person.password_hash IS NULL
       OR account_is_platform(person.id) THEN RETURN; END IF;
    cutoff := now()+interval '30 minutes';
  END IF;

  INSERT INTO account_email_challenges(purpose,recipient_hash,email,token_hash,job_id,user_id,auth_version,next_path,issued_at,expires_at)
  VALUES(p_purpose,p_recipient_hash,p_email,p_token_hash,p_job,person.id,person.auth_version,p_next,now(),cutoff)
  ON CONFLICT(purpose,recipient_hash) DO UPDATE SET
    email=EXCLUDED.email, token_hash=EXCLUDED.token_hash, job_id=EXCLUDED.job_id, user_id=EXCLUDED.user_id,
    auth_version=EXCLUDED.auth_version, next_path=EXCLUDED.next_path, issued_at=EXCLUDED.issued_at, expires_at=EXCLUDED.expires_at
  WHERE account_email_challenges.issued_at <= now()-interval '1 minute';
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO job_outbox(id,environment,type,idempotency_key,user_id,requires_user,user_auth_version,recipient_hash,payload,priority,expires_at)
  VALUES(p_job,p_environment,'email.account_'||p_purpose,'account:'||p_job,person.id,p_purpose='reset',
    person.auth_version,p_recipient_hash,p_payload,10,cutoff);
END $$;

CREATE FUNCTION complete_account_registration(
  p_token_hash text, p_name text, p_password_hash text, p_locale text,
  p_version text, p_content_hash text, p_preview boolean
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  challenge account_email_challenges;
  terms legal_documents;
  person uuid;
BEGIN
  PERFORM assert_membership_authority();
  SELECT * INTO challenge FROM account_email_challenges
    WHERE purpose='verify' AND token_hash=p_token_hash AND expires_at>clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO terms FROM legal_documents
    WHERE document_id='mywaveplan.adult-pilot-terms' AND language=p_locale AND effective_at<=now()
      AND (status='published' OR (p_preview AND status='staging_preview' AND environment='staging'
        AND (SELECT environment FROM job_environment WHERE singleton)='staging'))
    ORDER BY effective_at DESC,reviewed_at DESC,version DESC LIMIT 1;
  IF NOT FOUND OR terms.version IS DISTINCT FROM p_version OR terms.content_hash IS DISTINCT FROM p_content_hash THEN
    RETURN 'terms_changed';
  END IF;

  INSERT INTO users(name,email,role,password_hash,email_verified_at,preferred_locale,adult_attested_at)
  VALUES(p_name,challenge.email,'student',p_password_hash,now(),p_locale,now())
  ON CONFLICT (lower(email)) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO person;
  DELETE FROM account_email_challenges WHERE token_hash=p_token_hash;
  IF person IS NULL THEN RETURN NULL; END IF;

  INSERT INTO legal_acceptances(user_id,document_id,version,language,content_hash,kind)
  VALUES(person,terms.document_id,terms.version,terms.language,terms.content_hash,terms.kind);
  RETURN challenge.next_path;
END $$;

CREATE FUNCTION complete_account_reset(p_token_hash text, p_password_hash text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  challenge account_email_challenges;
  person users;
BEGIN
  SELECT * INTO challenge FROM account_email_challenges
    WHERE purpose='reset' AND token_hash=p_token_hash AND expires_at>clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO person FROM users WHERE id=challenge.user_id FOR UPDATE;
  IF NOT FOUND OR person.deleted_at IS NOT NULL OR person.disabled_at IS NOT NULL OR person.is_demo
     OR person.email_verified_at IS NULL OR person.password_hash IS NULL
     OR person.auth_version <> challenge.auth_version OR lower(person.email) <> challenge.email
     OR account_is_platform(person.id) OR challenge.expires_at<=clock_timestamp() THEN RETURN NULL; END IF;

  UPDATE users SET password_hash=p_password_hash,updated_at=now() WHERE id=person.id;
  UPDATE auth_sessions SET revoked_at=coalesce(revoked_at,now()) WHERE user_id=person.id AND revoked_at IS NULL;
  DELETE FROM account_email_challenges WHERE token_hash=p_token_hash;
  RETURN challenge.next_path;
END $$;
