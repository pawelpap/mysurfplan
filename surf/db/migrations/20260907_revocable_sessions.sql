-- Additive, idempotent. Apply before deploying the revocable-session code.
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auth_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);

-- Invalidate existing sessions on credential/status changes, including restores.
-- Role and school scope are read live for each request rather than copied from a cookie.
CREATE OR REPLACE FUNCTION invalidate_user_sessions_on_security_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash
     OR NEW.disabled_at IS DISTINCT FROM OLD.disabled_at
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    NEW.auth_version := OLD.auth_version + 1;
  END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_user_session_invalidation
  BEFORE UPDATE OF password_hash, disabled_at, deleted_at ON users
  FOR EACH ROW EXECUTE FUNCTION invalidate_user_sessions_on_security_change();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMIT;
