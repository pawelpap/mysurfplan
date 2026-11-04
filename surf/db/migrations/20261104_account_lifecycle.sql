-- Support intake for closure requests that require review.
CREATE TABLE account_closure_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id),
  support_case text,
  CHECK ((reviewed_at IS NULL) = (reviewed_by IS NULL)),
  CHECK ((reviewed_at IS NULL) = (support_case IS NULL)),
  CHECK (support_case IS NULL OR support_case ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$')
);
CREATE UNIQUE INDEX account_closure_requests_one_open
  ON account_closure_requests(user_id) WHERE reviewed_at IS NULL;
CREATE INDEX account_closure_requests_review
  ON account_closure_requests(requested_at) WHERE reviewed_at IS NULL;
CREATE INDEX account_closure_requests_history
  ON account_closure_requests(reviewed_at DESC) WHERE reviewed_at IS NOT NULL;

-- Keep the identity and its historical records. This marker scopes the
-- obligation guards to self-closure without changing staff deactivation.
ALTER TABLE users ADD COLUMN self_closed_at timestamptz;

CREATE FUNCTION complete_account_closure(person uuid, current_hash text, current_version integer)
RETURNS TABLE(outcome text, request_id uuid, requested_at timestamptz, review_completed_at timestamptz)
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM users
  WHERE users.id=person AND password_hash=current_hash AND auth_version=current_version
    AND disabled_at IS NULL AND deleted_at IS NULL AND NOT is_demo
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  -- A separate statement sees obligations committed while the account lock was waiting.
  IF account_is_platform(person) OR EXISTS (
    SELECT 1 FROM school_memberships m JOIN schools s ON s.id=m.school_id
    WHERE m.user_id=person AND s.deleted_at IS NULL AND s.workspace_status<>'closed'
      AND (s.owner_membership_id=m.id OR (m.status IN ('active','suspended') AND EXISTS (
        SELECT 1 FROM membership_roles r WHERE r.membership_id=m.id AND r.revoked_at IS NULL
          AND r.role IN ('school_admin','coach')
      )))
  ) OR EXISTS (
    SELECT 1 FROM students s JOIN bookings b ON b.student_id=s.id JOIN lessons l ON l.id=b.lesson_id
    WHERE s.user_id=person AND b.status='booked'
      AND l.start_at + l.duration_min * interval '1 minute' > now()
  ) OR EXISTS (
    SELECT 1 FROM coaches c JOIN lesson_coaches lc ON lc.coach_id=c.id JOIN lessons l ON l.id=lc.lesson_id
    WHERE c.user_id=person AND l.deleted_at IS NULL
      AND l.start_at + l.duration_min * interval '1 minute' > now()
  ) THEN
    RETURN QUERY
      INSERT INTO account_closure_requests AS r(user_id) VALUES(person)
      ON CONFLICT (user_id) WHERE reviewed_at IS NULL DO UPDATE SET user_id=EXCLUDED.user_id
      RETURNING 'support'::text,r.id,r.requested_at,r.reviewed_at;
    RETURN;
  END IF;

  UPDATE users SET deleted_at=now(),self_closed_at=now(),updated_at=now() WHERE users.id=person;
  UPDATE auth_sessions SET revoked_at=now() WHERE user_id=person AND revoked_at IS NULL;
  RETURN QUERY SELECT 'closed'::text,NULL::uuid,NULL::timestamptz,NULL::timestamptz;
END $$;

CREATE FUNCTION require_account_open_for_obligation(person uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE closed_at timestamptz;
BEGIN
  SELECT self_closed_at INTO closed_at FROM users WHERE id=person FOR SHARE;
  IF closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Account is closed' USING ERRCODE='23514';
  END IF;
END $$;

CREATE FUNCTION guard_lesson_participant() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE lesson lessons%ROWTYPE;
DECLARE person uuid;
BEGIN
  -- Serialize with rescheduling before checking whether this is an obligation.
  SELECT * INTO lesson FROM lessons WHERE id=NEW.lesson_id FOR SHARE;
  IF lesson.start_at + lesson.duration_min * interval '1 minute' > now() THEN
    IF TG_TABLE_NAME='bookings' THEN
      SELECT user_id INTO person FROM students WHERE id=NEW.student_id FOR SHARE;
    ELSIF lesson.deleted_at IS NULL THEN
      SELECT user_id INTO person FROM coaches WHERE id=NEW.coach_id FOR SHARE;
    END IF;
    IF person IS NOT NULL THEN PERFORM require_account_open_for_obligation(person); END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER bookings_guard_self_closed_account
BEFORE INSERT OR UPDATE OF student_id,lesson_id,status ON bookings
FOR EACH ROW WHEN (NEW.status='booked') EXECUTE FUNCTION guard_lesson_participant();

CREATE TRIGGER lesson_coaches_guard_self_closed_account
BEFORE INSERT OR UPDATE OF coach_id,lesson_id ON lesson_coaches
FOR EACH ROW EXECUTE FUNCTION guard_lesson_participant();

CREATE FUNCTION guard_rescheduled_lesson() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE person uuid;
BEGIN
  FOR person IN
    SELECT s.user_id FROM bookings b JOIN students s ON s.id=b.student_id
    WHERE b.lesson_id=NEW.id AND b.status='booked' AND s.user_id IS NOT NULL
    UNION
    SELECT c.user_id FROM lesson_coaches lc JOIN coaches c ON c.id=lc.coach_id
    WHERE lc.lesson_id=NEW.id AND NEW.deleted_at IS NULL AND c.user_id IS NOT NULL
    ORDER BY 1
  LOOP
    PERFORM require_account_open_for_obligation(person);
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER lessons_guard_self_closed_accounts
BEFORE UPDATE OF start_at,duration_min,deleted_at ON lessons FOR EACH ROW
WHEN ((OLD.start_at,OLD.duration_min,OLD.deleted_at) IS DISTINCT FROM (NEW.start_at,NEW.duration_min,NEW.deleted_at)
  AND NEW.start_at + NEW.duration_min * interval '1 minute' > now())
EXECUTE FUNCTION guard_rescheduled_lesson();

CREATE FUNCTION guard_linked_obligation_account() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE person uuid;
BEGIN
  IF TG_TABLE_NAME='schools' THEN
    IF NEW.deleted_at IS NULL AND NEW.workspace_status<>'closed' THEN
      SELECT user_id INTO person FROM school_memberships WHERE id=NEW.owner_membership_id;
    END IF;
  ELSE
    person:=NEW.user_id;
  END IF;
  IF person IS NOT NULL THEN PERFORM require_account_open_for_obligation(person); END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER students_guard_self_closed_account BEFORE UPDATE OF user_id ON students
FOR EACH ROW WHEN (OLD.user_id IS DISTINCT FROM NEW.user_id)
EXECUTE FUNCTION guard_linked_obligation_account();

CREATE TRIGGER coaches_guard_self_closed_account BEFORE UPDATE OF user_id ON coaches
FOR EACH ROW WHEN (OLD.user_id IS DISTINCT FROM NEW.user_id)
EXECUTE FUNCTION guard_linked_obligation_account();

CREATE TRIGGER schools_guard_self_closed_owner
BEFORE INSERT OR UPDATE OF owner_membership_id,workspace_status,deleted_at ON schools
FOR EACH ROW EXECUTE FUNCTION guard_linked_obligation_account();
