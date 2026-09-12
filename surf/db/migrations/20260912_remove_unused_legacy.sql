-- A8: forward cleanup. Historical migrations remain immutable.
-- Run only in the reviewed destination; never discard newly discovered records.
DO $$
DECLARE item text; populated boolean;
BEGIN
  FOREACH item IN ARRAY ARRAY['public.surf_bookings', 'public.surf_lessons', 'neon_auth.users_sync'] LOOP
    IF to_regclass(item) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s)', item) INTO populated;
      IF populated THEN RAISE EXCEPTION 'Legacy cleanup refused: % is not empty', item; END IF;
    END IF;
  END LOOP;
END $$;
DROP TABLE IF EXISTS public.surf_bookings;
DROP TABLE IF EXISTS public.surf_lessons;
DROP TABLE IF EXISTS neon_auth.users_sync;
-- RESTRICT is deliberate: unexpected dependencies must stop the migration.
DROP SCHEMA IF EXISTS neon_auth;
