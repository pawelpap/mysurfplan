-- Additive; no account, password or session data changes.
CREATE TABLE IF NOT EXISTS auth_login_limits (
  key text PRIMARY KEY CHECK (key ~ '^[0-9a-f]{64}$'),
  attempts integer NOT NULL CHECK (attempts > 0),
  attempt_limit integer NOT NULL CHECK (attempt_limit > 0),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_login_limits_expiry ON auth_login_limits(expires_at);
