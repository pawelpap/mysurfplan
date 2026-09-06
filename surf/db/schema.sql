-- db/schema.sql
-- MyWavePlan – canonical schema (schools, users, coaches, students, lessons, bookings)
-- Safe to run multiple times (IF NOT EXISTS + idempotent constructs)

-- 0) Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Enums
DO $$ BEGIN
  CREATE TYPE difficulty_level AS ENUM ('Beginner','Intermediate','Advanced');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('booked','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('platform_admin','school_admin','coach','student');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Helper: keep updated_at fresh
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- 3) Schools
CREATE TABLE IF NOT EXISTS schools (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  contact_email TEXT,
  slug          TEXT GENERATED ALWAYS AS (
                   regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')
                 ) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS contact_email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_schools_slug ON schools(slug) WHERE deleted_at IS NULL;
DO $$ BEGIN
  CREATE TRIGGER trg_touch_schools BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Users
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID REFERENCES schools(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  family_name       TEXT,
  photo_url         TEXT,
  description       TEXT,
  email             TEXT NOT NULL,
  phone             TEXT,
  role              user_role NOT NULL,
  password_hash     TEXT,
  email_verified_at TIMESTAMPTZ,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS family_name TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS role user_role,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_active
  ON users(lower(email)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE deleted_at IS NULL;
DO $$ BEGIN
  ALTER TABLE users
    ADD CONSTRAINT chk_users_role_school_scope
    CHECK (
      (role = 'platform_admin' AND school_id IS NULL)
      OR
      (role <> 'platform_admin' AND school_id IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_touch_users BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Coaches
CREATE TABLE IF NOT EXISTS coaches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  email         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (school_id, email)
);
ALTER TABLE coaches
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_coaches_school ON coaches(school_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_coaches_user ON coaches(user_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_coaches_user_active
  ON coaches(user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL;
DO $$ BEGIN
  CREATE TRIGGER trg_touch_coaches BEFORE UPDATE ON coaches
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6) Students
CREATE TABLE IF NOT EXISTS students (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  name          TEXT,
  email         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (school_id, email)
);
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_students_user ON students(user_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_user_active
  ON students(user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL;
DO $$ BEGIN
  CREATE TRIGGER trg_touch_students BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7) Lessons
CREATE TABLE IF NOT EXISTS lessons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  start_at      TIMESTAMPTZ NOT NULL,
  duration_min  INT NOT NULL DEFAULT 90,
  difficulty    difficulty_level NOT NULL DEFAULT 'Beginner',
  place         TEXT,
  capacity      INT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_lessons_school_time
  ON lessons(school_id, start_at) WHERE deleted_at IS NULL;
DO $$ BEGIN
  CREATE TRIGGER trg_touch_lessons BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8) Lesson ↔ Coaches (many-to-many)
CREATE TABLE IF NOT EXISTS lesson_coaches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id    UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  coach_id     UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, coach_id)
);
CREATE INDEX IF NOT EXISTS idx_lc_lesson ON lesson_coaches(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lc_coach  ON lesson_coaches(coach_id);

-- 9) Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id     UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status        booking_status NOT NULL DEFAULT 'booked',
  booked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Only one ACTIVE (booked) per lesson+student
CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_active
  ON bookings(lesson_id, student_id) WHERE status = 'booked';
CREATE INDEX IF NOT EXISTS idx_bookings_lesson  ON bookings(lesson_id);
CREATE INDEX IF NOT EXISTS idx_bookings_student ON bookings(student_id);
DO $$ BEGIN
  CREATE TRIGGER trg_touch_bookings BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 10) Views
CREATE OR REPLACE VIEW lesson_coach_list AS
SELECT
  l.id AS lesson_id,
  COALESCE(
    json_agg(
      json_build_object('id', c.id, 'name', c.name, 'email', c.email)
      ORDER BY c.name
    ) FILTER (WHERE c.id IS NOT NULL),
    '[]'::json
  ) AS coaches
FROM lessons l
LEFT JOIN lesson_coaches lc ON lc.lesson_id = l.id
LEFT JOIN coaches c ON c.id = lc.coach_id AND c.deleted_at IS NULL
GROUP BY l.id;

CREATE OR REPLACE VIEW lesson_stats AS
SELECT
  l.id AS lesson_id,
  COUNT(b.*) FILTER (WHERE b.status='booked')::int AS booked_count,
  l.capacity,
  GREATEST(0, COALESCE(l.capacity, 999999) -
              COUNT(b.*) FILTER (WHERE b.status='booked'))::int AS spots_left
FROM lessons l
LEFT JOIN bookings b ON b.lesson_id = l.id
GROUP BY l.id, l.capacity;

-- 11) Surf spots, calibration and forecast cache (20260905_conditions migration)
-- Additive migration. Apply to staging only until production is approved.
CREATE TABLE IF NOT EXISTS tide_stations (
  id text PRIMARY KEY,
  name text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  timezone text NOT NULL,
  data jsonb NOT NULL,
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS surf_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  region text NOT NULL,
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -85 AND 85),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  timezone text NOT NULL,
  marine_latitude double precision NOT NULL,
  marine_longitude double precision NOT NULL,
  break_type text NOT NULL DEFAULT 'Beach',
  tide_station_id text REFERENCES tide_stations(id),
  calibration jsonb NOT NULL,
  notes text NOT NULL DEFAULT '',
  sources jsonb NOT NULL DEFAULT '[]',
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS spot_calibration_history (
  id bigserial PRIMARY KEY,
  spot_id uuid NOT NULL REFERENCES surf_spots(id),
  version integer NOT NULL,
  calibration jsonb NOT NULL,
  notes text NOT NULL,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (spot_id, version)
);
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS spot_id uuid REFERENCES surf_spots(id);
CREATE INDEX IF NOT EXISTS idx_lessons_spot ON lessons(spot_id) WHERE deleted_at IS NULL;
-- Legacy lessons are retained. Creation/editing/booking APIs require an active spot.
CREATE TABLE IF NOT EXISTS spot_forecasts (
  spot_id uuid PRIMARY KEY REFERENCES surf_spots(id),
  payload jsonb,
  fetched_at timestamptz,
  expires_at timestamptz,
  retry_after timestamptz,
  refreshing_until timestamptz,
  last_error text
);
-- Optional login names; existing email logins continue to work.
ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_active
  ON users(lower(username)) WHERE username IS NOT NULL AND deleted_at IS NULL;
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT chk_users_username_format
    CHECK (username IS NULL OR username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,49}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Generic calibration tables. Seed schemas/profiles with scripts/migrate-calibration.mjs.
-- Additive rollout: retain legacy calibration for rollback until old releases retire.
CREATE EXTENSION IF NOT EXISTS pg_jsonschema;
CREATE TABLE IF NOT EXISTS calibration_schema_versions (
 version integer PRIMARY KEY,
 schema jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION validate_surf_configuration(c jsonb, v integer)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE s jsonb; k text; p jsonb; prev numeric; first_p jsonb; last_p jsonb; total numeric;
BEGIN
 SELECT schema INTO s FROM calibration_schema_versions WHERE version=v;
 IF s IS NULL OR c IS NULL OR NOT jsonb_matches_schema(s::json,c) THEN RETURN false; END IF;
 FOREACH k IN ARRAY ARRAY['exposureByDirection','windDirectionCurve','heightFitCurve','periodFitCurve','sizeCeilingCurve'] LOOP
   IF k='exposureByDirection' AND jsonb_array_length(c->k)=0 THEN CONTINUE; END IF;
   IF jsonb_array_length(c->k)<2 THEN RETURN false; END IF;
   first_p=c->k->0; last_p=c->k->-1;
   IF (first_p->>0)::numeric<>0 THEN RETURN false; END IF;
   prev=-1;
   FOR p IN SELECT value FROM jsonb_array_elements(c->k) LOOP
     IF (p->>0)::numeric<=prev THEN RETURN false; END IF;
     prev=(p->>0)::numeric;
   END LOOP;
   IF k IN ('exposureByDirection','windDirectionCurve') AND ((last_p->>0)::numeric<>360 OR first_p->1<>last_p->1) THEN RETURN false; END IF;
 END LOOP;
 prev=-1;
 FOR p IN SELECT value FROM jsonb_array_elements(c->'tideRules') LOOP
   IF (prev=-1 AND (p->>'minimumSwell')::numeric<>0) OR (p->>'minimumSwell')::numeric<=prev OR (p->>'low')::numeric>(p->>'high')::numeric THEN RETURN false; END IF;
   prev=(p->>'minimumSwell')::numeric;
 END LOOP;
 SELECT sum(value::numeric) INTO total FROM jsonb_each_text(c->'weights');
 IF abs(total-1)>0.000000001 OR (c#>>'{weights,tide}')::numeric=1 THEN RETURN false; END IF;
 IF (c->>'periodFactorMin')::numeric>(c->>'periodFactorMax')::numeric OR (c#>>'{windFit,offshoreAngleBelow}')::numeric>=(c#>>'{windFit,onshoreAngleAbove}')::numeric OR (c#>>'{tideDisplay,lowAtMost}')::numeric>=(c#>>'{tideDisplay,highAtLeast}')::numeric THEN RETURN false; END IF;
 prev=101;
 FOR p IN SELECT value FROM jsonb_array_elements(c->'qualityBands') LOOP
   IF (p->>'minimumScore')::numeric>=prev THEN RETURN false; END IF;
   prev=(p->>'minimumScore')::numeric;
 END LOOP;
 IF prev<>0 OR c#>>'{experienceRules,-1,level}'<>'Advanced' THEN RETURN false; END IF;
 prev=0; last_p=NULL;
 FOR p IN SELECT value FROM jsonb_array_elements(c->'experienceRules') LOOP
   total=CASE p->>'level' WHEN 'Beginner' THEN 1 WHEN 'Intermediate' THEN 2 WHEN 'Advanced' THEN 3 END;
   IF total<=prev THEN RETURN false; END IF;
   IF last_p IS NOT NULL AND ((p->>'maxSurf')::numeric<(last_p->>'maxSurf')::numeric OR (p->>'maxWind')::numeric<(last_p->>'maxWind')::numeric OR (p->>'maxPeriod')::numeric<(last_p->>'maxPeriod')::numeric) THEN RETURN false; END IF;
   prev=total; last_p=p;
 END LOOP;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
CREATE TABLE IF NOT EXISTS surf_calibration_profiles (
 id text NOT NULL,
 version integer NOT NULL CHECK(version>0),
 name text NOT NULL,
 schema_version integer NOT NULL REFERENCES calibration_schema_versions(version),
 configuration jsonb NOT NULL,
 change_note text NOT NULL,
 sources jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(sources)='array'),
 changed_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(id,version),
 CHECK(validate_surf_configuration(configuration,schema_version))
);
CREATE TABLE IF NOT EXISTS surf_calibration_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 default_profile_id text NOT NULL,
 default_profile_version integer NOT NULL,
 FOREIGN KEY(default_profile_id,default_profile_version) REFERENCES surf_calibration_profiles(id,version)
);
CREATE OR REPLACE FUNCTION prevent_calibration_revision_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Calibration revisions are immutable; create a new version'; END $$;
DROP TRIGGER IF EXISTS immutable_calibration_schema ON calibration_schema_versions;
CREATE TRIGGER immutable_calibration_schema BEFORE UPDATE OR DELETE ON calibration_schema_versions FOR EACH ROW EXECUTE FUNCTION prevent_calibration_revision_change();
DROP TRIGGER IF EXISTS immutable_calibration_profile ON surf_calibration_profiles;
CREATE TRIGGER immutable_calibration_profile BEFORE UPDATE OR DELETE ON surf_calibration_profiles FOR EACH ROW EXECUTE FUNCTION prevent_calibration_revision_change();
ALTER TABLE surf_spots ADD COLUMN IF NOT EXISTS calibration_config jsonb;
ALTER TABLE surf_spots ADD COLUMN IF NOT EXISTS calibration_schema_version integer REFERENCES calibration_schema_versions(version);
ALTER TABLE surf_spots ADD COLUMN IF NOT EXISTS calibration_profile_id text;
ALTER TABLE surf_spots ADD COLUMN IF NOT EXISTS calibration_profile_version integer;
ALTER TABLE surf_spots ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
ALTER TABLE spot_calibration_history ADD COLUMN IF NOT EXISTS schema_version integer REFERENCES calibration_schema_versions(version);
ALTER TABLE spot_calibration_history ADD COLUMN IF NOT EXISTS change_note text NOT NULL DEFAULT '';
ALTER TABLE spot_calibration_history ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]';
DO $$ BEGIN
 ALTER TABLE surf_spots ADD CONSTRAINT surf_spots_configuration_valid CHECK(calibration_config IS NULL OR validate_surf_configuration(calibration_config,calibration_schema_version));
 ALTER TABLE surf_spots ADD CONSTRAINT surf_spots_calibration_profile_fk FOREIGN KEY(calibration_profile_id,calibration_profile_version) REFERENCES surf_calibration_profiles(id,version);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Database-owned first choice in the selector; no spot identity in runtime code.
UPDATE surf_spots SET display_order=10 WHERE slug='sao-pedro-bico' AND display_order=0;
