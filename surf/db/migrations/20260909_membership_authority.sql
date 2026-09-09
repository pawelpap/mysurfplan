-- B2 activation: only after the compatible application is READY on this environment.
-- Runner locks/reconciles legacy writes before entering this file.
SELECT assert_membership_authority() WHERE false;
ALTER TABLE users DROP CONSTRAINT chk_users_role_school_scope;
ALTER TABLE users DROP CONSTRAINT users_school_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_school_id_fkey FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE SET NULL;
DROP INDEX uq_coaches_user_active;
DROP INDEX uq_students_user_active;
CREATE UNIQUE INDEX uq_coaches_school_user_active ON coaches(school_id,user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_students_school_user_active ON students(school_id,user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL;
DROP TRIGGER trg_legacy_membership_bridge ON users;
UPDATE identity_migration_state SET authority='memberships' WHERE singleton;
CREATE FUNCTION guard_retired_user_authority() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.role::text<>'student' OR NEW.school_id IS NOT NULL THEN
     RAISE EXCEPTION 'Use global accounts and school memberships' USING ERRCODE='55000';
   END IF;
 ELSIF NEW.role IS DISTINCT FROM OLD.role OR (NEW.school_id IS DISTINCT FROM OLD.school_id AND NOT
   (NEW.school_id IS NULL AND pg_trigger_depth()>1)) THEN
   RAISE EXCEPTION 'Legacy account authority is retired' USING ERRCODE='55000';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_retired_user_authority BEFORE INSERT OR UPDATE OF role,school_id ON users
 FOR EACH ROW EXECUTE FUNCTION guard_retired_user_authority();
COMMENT ON TABLE school_memberships IS 'School staff authority from B2; personal bookings and global account status are separate.';

CREATE OR REPLACE VIEW identity_reconciliation_issues AS
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
SELECT 'coach_membership_without_record', m.user_id,m.school_id,NULL::uuid
 FROM school_memberships m JOIN users u ON u.id=m.user_id
 WHERE m.status='active' AND u.deleted_at IS NULL AND EXISTS(SELECT 1 FROM membership_roles r WHERE r.membership_id=m.id AND r.role='coach' AND r.revoked_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM coaches c WHERE c.user_id=m.user_id AND c.school_id=m.school_id AND c.deleted_at IS NULL)
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

