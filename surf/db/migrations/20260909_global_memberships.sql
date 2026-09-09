-- B1 expansion only. Run through scripts/migrate-memberships.mjs so the entire
-- migration, backfill and checksum are committed together. Legacy auth stays live.
CREATE TABLE identity_migration_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  authority text NOT NULL CHECK (authority IN ('legacy_shadow', 'memberships')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO identity_migration_state(authority) VALUES ('legacy_shadow');

CREATE TABLE school_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'left')),
  origin text NOT NULL DEFAULT 'explicit' CHECK (origin IN ('legacy_user', 'explicit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id),
  UNIQUE (school_id, id),
  UNIQUE (school_id, id, status)
);
CREATE INDEX idx_memberships_user_status ON school_memberships(user_id, status);
CREATE TRIGGER trg_touch_memberships BEFORE UPDATE ON school_memberships
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE membership_roles (
  membership_id uuid NOT NULL REFERENCES school_memberships(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('school_admin', 'coach')),
  origin text NOT NULL DEFAULT 'explicit' CHECK (origin IN ('legacy_user', 'explicit')),
  granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (membership_id, role),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE TABLE platform_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'platform_admin' CHECK (role = 'platform_admin'),
  origin text NOT NULL DEFAULT 'explicit' CHECK (origin IN ('legacy_user', 'explicit')),
  granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE UNIQUE INDEX uq_platform_role_active
  ON platform_role_assignments(user_id, role) WHERE revoked_at IS NULL;

-- Existing schools stay legacy, with ownership unresolved. These new fields do
-- not change listing visibility or access until the B2/C1 cutover.
ALTER TABLE schools
  ADD COLUMN workspace_kind text NOT NULL DEFAULT 'legacy'
    CHECK (workspace_kind IN ('legacy', 'self_service')),
  ADD COLUMN workspace_status text NOT NULL DEFAULT 'draft'
    CHECK (workspace_status IN ('draft', 'active', 'suspended', 'closed')),
  ADD COLUMN listing_status text NOT NULL DEFAULT 'unlisted'
    CHECK (listing_status IN ('unlisted', 'published')),
  ADD COLUMN owner_membership_id uuid,
  ADD COLUMN owner_required_status text GENERATED ALWAYS AS (
    CASE WHEN workspace_kind = 'self_service' AND workspace_status <> 'closed'
      THEN 'active'::text ELSE NULL::text END
  ) STORED,
  ADD CONSTRAINT chk_self_service_owner
    CHECK (workspace_kind = 'legacy' OR workspace_status = 'closed' OR owner_membership_id IS NOT NULL),
  ADD CONSTRAINT fk_school_owner_membership
    FOREIGN KEY (id, owner_membership_id) REFERENCES school_memberships(school_id, id)
    DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT fk_school_active_owner
    FOREIGN KEY (id, owner_membership_id, owner_required_status)
    REFERENCES school_memberships(school_id, id, status)
    DEFERRABLE INITIALLY DEFERRED;

-- The status FK protects ownership under concurrent transactions, including a
-- race between activation/transfer and membership suspension. It is deliberately
-- separate from global account status and commercial subscription status.
ALTER TABLE coaches ADD CONSTRAINT uq_coaches_school_record UNIQUE (school_id, id);
ALTER TABLE students ADD CONSTRAINT uq_students_school_record UNIQUE (school_id, id);

CREATE TABLE school_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  invited_email text NOT NULL CHECK (invited_email = lower(btrim(invited_email)) AND length(invited_email) > 3),
  requested_roles text[] NOT NULL CHECK (
    array_ndims(requested_roles) = 1 AND array_lower(requested_roles, 1) = 1
    AND cardinality(requested_roles) BETWEEN 1 AND 2
    AND requested_roles <@ ARRAY['school_admin', 'coach']::text[]
    AND array_position(requested_roles, NULL) IS NULL
    AND (cardinality(requested_roles) = 1 OR requested_roles[1] <> requested_roles[2])
  ),
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  accepted_by_user_id uuid REFERENCES users(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  legacy_coach_id uuid,
  legacy_student_id uuid,
  FOREIGN KEY (school_id, legacy_coach_id) REFERENCES coaches(school_id, id),
  FOREIGN KEY (school_id, legacy_student_id) REFERENCES students(school_id, id),
  CHECK ((status = 'accepted') = (accepted_by_user_id IS NOT NULL AND accepted_at IS NOT NULL)),
  CHECK (status = 'accepted' OR (accepted_by_user_id IS NULL AND accepted_at IS NULL)),
  CHECK (accepted_at IS NULL OR (accepted_at >= created_at AND accepted_at < expires_at)),
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL)),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE UNIQUE INDEX uq_school_invitation_pending
  ON school_invitations(school_id, invited_email) WHERE status = 'pending';
CREATE INDEX idx_school_invitation_expiry ON school_invitations(expires_at) WHERE status = 'pending';

-- One-way compatibility writer. It never changes legacy fields or credentials.
-- It maintains only legacy-derived rows; explicit assignments are never revived
-- or revoked here. B2 must retire this bridge before enabling multi-school writes.
CREATE FUNCTION sync_legacy_user_memberships(target_user_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  u users%ROWTYPE;
  target_membership_id uuid;
  next_status text;
BEGIN
  IF (SELECT authority FROM identity_migration_state WHERE singleton) <> 'legacy_shadow' THEN
    RETURN;
  END IF;
  SELECT * INTO u FROM users WHERE id = target_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE school_memberships m SET status = 'left'
  WHERE m.user_id = u.id AND m.origin = 'legacy_user' AND m.status <> 'left'
    AND NOT (u.role::text IN ('school_admin', 'coach')
      AND m.school_id = u.school_id AND u.deleted_at IS NULL);

  UPDATE membership_roles r SET revoked_at = now()
  FROM school_memberships m
  WHERE r.membership_id = m.id AND m.user_id = u.id
    AND m.origin = 'legacy_user' AND r.origin = 'legacy_user' AND r.revoked_at IS NULL
    AND (m.status = 'left' OR r.role <> u.role::text);

  IF u.role::text IN ('school_admin', 'coach') AND u.school_id IS NOT NULL THEN
    next_status := CASE WHEN u.deleted_at IS NULL THEN 'active' ELSE 'left' END;
    INSERT INTO school_memberships(school_id, user_id, status, origin)
    VALUES (u.school_id, u.id, next_status, 'legacy_user')
    ON CONFLICT (school_id, user_id) DO UPDATE SET status = EXCLUDED.status
      WHERE school_memberships.origin = 'legacy_user'
        AND school_memberships.status IS DISTINCT FROM EXCLUDED.status;

    SELECT id INTO target_membership_id FROM school_memberships
      WHERE school_id = u.school_id AND user_id = u.id
        AND origin = 'legacy_user' AND status = 'active';
    IF target_membership_id IS NOT NULL THEN
      INSERT INTO membership_roles(membership_id, role, origin)
      VALUES (target_membership_id, u.role::text, 'legacy_user')
      ON CONFLICT (membership_id, role) DO UPDATE
        SET revoked_at = NULL, granted_at = now()
        WHERE membership_roles.origin = 'legacy_user' AND membership_roles.revoked_at IS NOT NULL;
    END IF;
  END IF;

  UPDATE platform_role_assignments SET revoked_at = now()
    WHERE user_id = u.id AND origin = 'legacy_user' AND revoked_at IS NULL
      AND (u.role::text NOT IN ('admin', 'platform_admin') OR u.deleted_at IS NOT NULL);
  IF u.role::text IN ('admin', 'platform_admin') AND u.deleted_at IS NULL THEN
    INSERT INTO platform_role_assignments(user_id, origin) VALUES (u.id, 'legacy_user')
      ON CONFLICT (user_id, role) WHERE revoked_at IS NULL DO NOTHING;
  END IF;
END $$;

CREATE FUNCTION bridge_legacy_user_memberships()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role IS NOT DISTINCT FROM OLD.role
    AND NEW.school_id IS NOT DISTINCT FROM OLD.school_id
    AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
    RETURN NEW;
  END IF;
  PERFORM sync_legacy_user_memberships(NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_legacy_membership_bridge
  AFTER INSERT OR UPDATE OF role, school_id, deleted_at ON users
  FOR EACH ROW EXECUTE FUNCTION bridge_legacy_user_memberships();

-- Role/school assignments are explicit evidence; matching an email is not.
SELECT sync_legacy_user_memberships(id) FROM users ORDER BY id;

-- Operator-only reconciliation; no email addresses or credentials in reports.
CREATE VIEW identity_reconciliation_issues AS
SELECT 'unresolved_school_owner'::text AS issue, s.id AS subject_id, s.id AS school_id,
  NULL::uuid AS related_id
  FROM schools s WHERE s.deleted_at IS NULL AND s.workspace_kind = 'legacy' AND s.owner_membership_id IS NULL
UNION ALL
SELECT 'unclaimed_coach', c.id, c.school_id, NULL::uuid FROM coaches c
  WHERE c.user_id IS NULL AND c.deleted_at IS NULL
UNION ALL
SELECT 'unclaimed_student', s.id, s.school_id, NULL::uuid FROM students s
  WHERE s.user_id IS NULL AND s.deleted_at IS NULL
UNION ALL
SELECT 'coach_account_without_record', u.id, u.school_id, NULL::uuid FROM users u
  WHERE u.role::text = 'coach' AND u.deleted_at IS NULL AND NOT EXISTS (
    SELECT 1 FROM coaches c WHERE c.user_id = u.id AND c.school_id = u.school_id AND c.deleted_at IS NULL)
UNION ALL
SELECT 'student_account_without_record', u.id, u.school_id, NULL::uuid FROM users u
  WHERE u.role::text = 'student' AND u.deleted_at IS NULL AND NOT EXISTS (
    SELECT 1 FROM students s WHERE s.user_id = u.id AND s.school_id = u.school_id AND s.deleted_at IS NULL)
UNION ALL
SELECT 'incompatible_coach_link', c.id, c.school_id, u.id FROM coaches c JOIN users u ON u.id = c.user_id
  WHERE c.deleted_at IS NULL AND (u.deleted_at IS NOT NULL OR u.role::text <> 'coach' OR u.school_id IS DISTINCT FROM c.school_id)
UNION ALL
SELECT 'incompatible_student_link', s.id, s.school_id, u.id FROM students s JOIN users u ON u.id = s.user_id
  WHERE s.deleted_at IS NULL AND (u.deleted_at IS NOT NULL OR u.role::text <> 'student' OR u.school_id IS DISTINCT FROM s.school_id)
UNION ALL
SELECT 'ambiguous_login_identifier', u.id, u.school_id, other_u.id FROM users u JOIN users other_u ON u.id < other_u.id
  WHERE u.deleted_at IS NULL AND other_u.deleted_at IS NULL AND (
    lower(btrim(u.email)) = lower(btrim(other_u.email))
    OR lower(btrim(u.username)) = lower(btrim(other_u.username))
    OR lower(btrim(u.username)) = lower(btrim(other_u.email))
    OR lower(btrim(u.email)) = lower(btrim(other_u.username)))
UNION ALL
SELECT 'non_normalised_email', u.id, u.school_id, NULL::uuid FROM users u
  WHERE u.deleted_at IS NULL AND u.email <> lower(btrim(u.email));

COMMENT ON TABLE school_memberships IS 'B1 shadow records; users.role/school_id remain authoritative until B2.';
COMMENT ON TABLE school_invitations IS 'B1 storage only. B4 implements verified identity, inviter revalidation, expiry and atomic acceptance. No sending or acceptance API yet.';
COMMENT ON COLUMN schools.owner_required_status IS 'Constraint-only generated value: same-school active owner required for non-closed self-service workspaces.';
