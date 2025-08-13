-- db/schema.sql
-- MyWavePlan – canonical schema (schools, coaches, students, lessons, bookings)
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
  slug          TEXT GENERATED ALWAYS AS (
                   regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')
                 ) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_schools_slug ON schools(slug) WHERE deleted_at IS NULL;
DO $$ BEGIN
  CREATE TRIGGER trg_touch_schools BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Coaches
CREATE TABLE IF NOT EXISTS coaches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (school_id, email)
);
CREATE INDEX IF NOT EXISTS idx_coaches_school ON coaches(school_id) WHERE deleted_at IS NULL;
DO $$ BEGIN
  CREATE TRIGGER trg_touch_coaches BEFORE UPDATE ON coaches
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Students
CREATE TABLE IF NOT EXISTS students (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name          TEXT,
  email         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (school_id, email)
);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id) WHERE deleted_at IS NULL;
DO $$ BEGIN
  CREATE TRIGGER trg_touch_students BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6) Lessons
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

-- 7) Lesson ↔ Coaches (many-to-many)
CREATE TABLE IF NOT EXISTS lesson_coaches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id    UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  coach_id     UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, coach_id)
);
CREATE INDEX IF NOT EXISTS idx_lc_lesson ON lesson_coaches(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lc_coach  ON lesson_coaches(coach_id);

-- 8) Bookings
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

-- 9) Views
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
