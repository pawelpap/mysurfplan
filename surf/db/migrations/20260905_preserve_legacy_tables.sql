-- Preserve the earlier application's records during environment reconciliation.
-- These tables are retained for history and are not used by the current UI.
CREATE TABLE IF NOT EXISTS surf_lessons (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  start_iso timestamptz NOT NULL,
  duration_min integer NOT NULL DEFAULT 90,
  difficulty text NOT NULL,
  place text NOT NULL
);
CREATE TABLE IF NOT EXISTS surf_bookings (
  lesson_id text NOT NULL,
  name text,
  email text NOT NULL,
  UNIQUE (lesson_id, email)
);
