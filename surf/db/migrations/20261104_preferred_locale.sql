ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_locale text;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT chk_users_preferred_locale
    CHECK (preferred_locale IN ('en-GB', 'pt-PT', 'es'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
