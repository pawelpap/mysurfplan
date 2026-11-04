ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_preferred_locale;
ALTER TABLE users ADD CONSTRAINT chk_users_preferred_locale
  CHECK (preferred_locale IN ('en-GB', 'pt-PT', 'es', 'fr'));

ALTER TABLE legal_documents DROP CONSTRAINT IF EXISTS legal_documents_language_check;
ALTER TABLE legal_documents ADD CONSTRAINT legal_documents_language_check
  CHECK (language IN ('en-GB', 'pt-PT', 'es', 'fr'));
