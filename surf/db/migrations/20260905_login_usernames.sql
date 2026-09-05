-- Optional login names; existing email logins continue to work.
ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_active
  ON users(lower(username)) WHERE username IS NOT NULL AND deleted_at IS NULL;
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT chk_users_username_format
    CHECK (username IS NULL OR username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,49}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
