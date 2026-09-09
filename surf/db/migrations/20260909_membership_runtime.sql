-- B2 preparation: deploy this while the B1 bridge still owns legacy writes.
CREATE VIEW account_school_access AS
WITH state AS (SELECT authority FROM identity_migration_state WHERE singleton), relations AS (
  SELECT u.id AS user_id,u.school_id,NULL::uuid AS membership_id,'active'::text AS status,
    CASE WHEN u.role::text IN ('coach','school_admin') THEN ARRAY[u.role::text] ELSE ARRAY[]::text[] END AS roles,
    false AS is_owner
  FROM users u,state WHERE state.authority='legacy_shadow' AND u.school_id IS NOT NULL AND u.deleted_at IS NULL
  UNION ALL
  SELECT m.user_id,m.school_id,m.id,m.status,
    COALESCE((SELECT array_agg(r.role ORDER BY r.role) FROM membership_roles r WHERE r.membership_id=m.id AND r.revoked_at IS NULL),ARRAY[]::text[]),
    sc.owner_membership_id=m.id
  FROM school_memberships m JOIN schools sc ON sc.id=m.school_id,state
  WHERE state.authority='memberships'
  UNION ALL
  SELECT s.user_id,s.school_id,NULL::uuid,'customer',ARRAY[]::text[],false
  FROM students s,state WHERE state.authority='memberships' AND s.user_id IS NOT NULL AND s.deleted_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM school_memberships m WHERE m.user_id=s.user_id AND m.school_id=s.school_id)
  UNION ALL
  -- Retain existing school context, without using the old role as a grant.
  SELECT u.id,u.school_id,NULL::uuid,'customer',ARRAY[]::text[],false FROM users u,state
  WHERE state.authority='memberships' AND u.school_id IS NOT NULL AND u.deleted_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM school_memberships m WHERE m.user_id=u.id AND m.school_id=u.school_id)
    AND NOT EXISTS(SELECT 1 FROM students s WHERE s.user_id=u.id AND s.school_id=u.school_id AND s.deleted_at IS NULL)
)
SELECT r.*, sc.slug,sc.name,sc.workspace_kind,sc.workspace_status,
 sc.deleted_at IS NULL AND sc.workspace_status NOT IN ('closed','suspended') AS school_open
FROM relations r JOIN schools sc ON sc.id=r.school_id;

CREATE FUNCTION account_is_platform(actor uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM users u,identity_migration_state st WHERE u.id=actor AND u.deleted_at IS NULL AND u.disabled_at IS NULL AND st.singleton AND
   CASE WHEN st.authority='legacy_shadow' THEN u.role::text IN ('admin','platform_admin')
   ELSE EXISTS(SELECT 1 FROM platform_role_assignments p WHERE p.user_id=u.id AND p.revoked_at IS NULL) END)
$$;
CREATE FUNCTION account_manages_school(actor uuid, school uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM users u JOIN schools sc ON sc.id=school WHERE u.id=actor AND u.deleted_at IS NULL AND u.disabled_at IS NULL
 AND sc.deleted_at IS NULL AND sc.workspace_status NOT IN ('closed','suspended') AND
 (account_is_platform(actor) OR EXISTS(SELECT 1 FROM account_school_access a WHERE a.user_id=actor AND a.school_id=school
 AND a.status='active' AND (a.is_owner OR 'school_admin'=ANY(a.roles)))))
$$;
CREATE FUNCTION assert_membership_authority() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM identity_migration_state WHERE singleton AND authority='memberships') THEN
 RAISE EXCEPTION 'Membership transition is in progress' USING ERRCODE='55000'; END IF;
END $$;

CREATE FUNCTION set_school_access(actor uuid, person uuid, school uuid, requested_roles text[], requested_status text)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE target_id uuid; existing_status text;
BEGIN
 PERFORM assert_membership_authority();
 IF requested_status NOT IN ('active','suspended','left') OR requested_roles IS NULL OR
 cardinality(requested_roles)>2 OR NOT requested_roles <@ ARRAY['coach','school_admin']::text[] OR
 array_position(requested_roles,NULL) IS NOT NULL OR
 (cardinality(requested_roles)=2 AND requested_roles[1]=requested_roles[2]) THEN
 RAISE EXCEPTION 'Invalid school access' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM schools WHERE id=school FOR SHARE;
 PERFORM 1 FROM users WHERE id IN(actor,person) ORDER BY id FOR SHARE;
 PERFORM 1 FROM school_memberships WHERE school_id=school AND user_id IN(actor,person) ORDER BY id FOR UPDATE;
 IF NOT account_manages_school(actor,school) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=person AND deleted_at IS NULL) THEN
 RAISE EXCEPTION 'Person not found' USING ERRCODE='P0002'; END IF;
 SELECT id,status INTO target_id,existing_status FROM school_memberships WHERE school_id=school AND user_id=person;
 -- New affiliations require the platform operator until verified invitations ship in B4.
 IF target_id IS NULL AND NOT account_is_platform(actor) THEN RAISE EXCEPTION 'Invite through the platform administrator' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM schools WHERE id=school AND owner_membership_id=target_id) AND requested_status<>'active' THEN
 RAISE EXCEPTION 'Transfer ownership before removing the owner' USING ERRCODE='23514'; END IF;
 IF actor=person AND NOT account_is_platform(actor) AND
 (requested_status<>'active' OR NOT 'school_admin'=ANY(requested_roles)) THEN
 RAISE EXCEPTION 'Another administrator must change your own access' USING ERRCODE='23514'; END IF;
 INSERT INTO school_memberships(school_id,user_id,status,origin) VALUES(school,person,requested_status,'explicit')
 ON CONFLICT(school_id,user_id) DO UPDATE SET status=EXCLUDED.status,origin='explicit' RETURNING id INTO target_id;
 UPDATE membership_roles SET revoked_at=COALESCE(revoked_at,now()),origin='explicit'
 WHERE membership_id=target_id AND NOT role=ANY(requested_roles);
 INSERT INTO membership_roles(membership_id,role,origin,granted_by)
 SELECT target_id,role,'explicit',actor FROM unnest(requested_roles) role
 ON CONFLICT(membership_id,role) DO UPDATE SET revoked_at=NULL,origin='explicit',granted_by=actor,granted_at=now();
 IF 'coach'=ANY(requested_roles) AND requested_status='active' THEN
  INSERT INTO coaches(school_id,user_id,name,email)
  SELECT school,u.id,concat_ws(' ',u.name,u.family_name),u.email FROM users u WHERE u.id=person
   AND NOT EXISTS(SELECT 1 FROM coaches c WHERE c.school_id=school AND c.user_id=person AND c.deleted_at IS NULL)
   AND NOT EXISTS(SELECT 1 FROM coaches c WHERE c.school_id=school AND lower(c.email)=lower(u.email));
 END IF;
 RETURN target_id;
END $$;

CREATE FUNCTION create_global_account(actor uuid, details jsonb, secret_hash text, school uuid, roles text[], platform boolean)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE person uuid;
BEGIN
 PERFORM assert_membership_authority();
 IF NOT account_is_platform(actor) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 INSERT INTO users(name,family_name,email,phone,description,password_hash,role,school_id)
 VALUES(details->>'name',details->>'familyName',details->>'email',details->>'phone',details->>'description',secret_hash,'student',NULL) RETURNING id INTO person;
 IF platform THEN INSERT INTO platform_role_assignments(user_id,origin,granted_by) VALUES(person,'explicit',actor); END IF;
 IF school IS NOT NULL THEN
  IF cardinality(roles)>0 THEN PERFORM set_school_access(actor,person,school,roles,'active');
  ELSE INSERT INTO students(school_id,user_id,name,email) VALUES(school,person,concat_ws(' ',details->>'name',details->>'familyName'),details->>'email'); END IF;
 END IF;
 RETURN person;
END $$;
CREATE FUNCTION update_global_account(actor uuid, person uuid, details jsonb)
RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
 PERFORM assert_membership_authority();
 -- Serialise platform grants and sensitive account changes, including last-admin checks.
 PERFORM pg_advisory_xact_lock(90490902);
 PERFORM 1 FROM users WHERE id IN(actor,person) ORDER BY id FOR UPDATE;
 IF NOT account_is_platform(actor) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=person AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Person not found' USING ERRCODE='P0002'; END IF;
 IF person=actor AND (details->>'disabled'='true' OR details->>'deleted'='true' OR details->>'platform'='false') THEN
 RAISE EXCEPTION 'Another platform administrator must change your access' USING ERRCODE='23514'; END IF;
 IF (details->>'disabled'='true' OR details->>'deleted'='true') AND EXISTS(
 SELECT 1 FROM school_memberships m JOIN schools s ON s.owner_membership_id=m.id WHERE m.user_id=person AND s.deleted_at IS NULL AND s.workspace_status<>'closed') THEN
 RAISE EXCEPTION 'Transfer school ownership first' USING ERRCODE='23514'; END IF;
 UPDATE users SET
 name=COALESCE(details->>'name',name),family_name=COALESCE(details->>'familyName',family_name),
 email=COALESCE(details->>'email',email),phone=COALESCE(details->>'phone',phone),
 description=COALESCE(details->>'description',description),
 password_hash=COALESCE(NULLIF(details->>'passwordHash',''),password_hash),
 email_verified_at=CASE WHEN details ? 'email' AND details->>'email'<>email THEN NULL ELSE email_verified_at END,
 auth_version=auth_version+CASE WHEN details ? 'email' AND details->>'email'<>email THEN 1 ELSE 0 END,
 disabled_at=CASE WHEN details ? 'disabled' THEN CASE WHEN (details->>'disabled')::boolean THEN COALESCE(disabled_at,now()) ELSE NULL END ELSE disabled_at END,
 deleted_at=CASE WHEN details->>'deleted'='true' THEN now() ELSE deleted_at END
 WHERE id=person;
 IF details ? 'platform' THEN
  IF (details->>'platform')::boolean THEN
   INSERT INTO platform_role_assignments(user_id,origin,granted_by) VALUES(person,'explicit',actor)
   ON CONFLICT(user_id,role) WHERE revoked_at IS NULL DO NOTHING;
  ELSE UPDATE platform_role_assignments SET revoked_at=now() WHERE user_id=person AND revoked_at IS NULL;
  END IF;
 END IF;
 RETURN person;
END $$;

CREATE FUNCTION reserve_lesson(actor uuid, lesson_id_arg uuid, on_behalf boolean, guest_name text, guest_email text)
RETURNS TABLE(student_id uuid,email text,outcome text) LANGUAGE plpgsql AS $$
DECLARE l lessons%ROWTYPE; u users%ROWTYPE; student_row students%ROWTYPE; booking_row bookings%ROWTYPE; n integer;
BEGIN
 SELECT * INTO u FROM users WHERE id=actor AND deleted_at IS NULL AND disabled_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM lessons WHERE id=lesson_id_arg AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lesson not found' USING ERRCODE='P0002'; END IF;
 IF NOT EXISTS(SELECT 1 FROM schools WHERE id=l.school_id AND deleted_at IS NULL AND workspace_status NOT IN ('closed','suspended')) OR
  NOT EXISTS(SELECT 1 FROM surf_spots WHERE id=l.spot_id AND active) OR l.start_at<=now() THEN
 RAISE EXCEPTION 'Lesson is unavailable' USING ERRCODE='23514'; END IF;
 IF on_behalf THEN
  IF NOT account_manages_school(actor,l.school_id) AND NOT EXISTS(
   SELECT 1 FROM account_school_access a JOIN coaches c ON c.school_id=a.school_id AND c.user_id=a.user_id
   JOIN lesson_coaches lc ON lc.coach_id=c.id WHERE a.user_id=actor AND a.school_id=l.school_id AND a.school_open
   AND a.status='active' AND 'coach'=ANY(a.roles) AND c.deleted_at IS NULL AND lc.lesson_id=l.id) THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO student_row FROM students s WHERE s.school_id=l.school_id AND s.email=guest_email AND s.deleted_at IS NULL;
 ELSE
  IF NOT account_is_platform(actor) AND NOT EXISTS(SELECT 1 FROM account_school_access WHERE user_id=actor AND school_id=l.school_id AND school_open) THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  -- Reuse explicit identity, even after a personal email change. Never claim by matching email.
  SELECT * INTO student_row FROM students s WHERE s.school_id=l.school_id AND s.user_id=actor AND s.deleted_at IS NULL;
  guest_email:=u.email; guest_name:=concat_ws(' ',u.name,u.family_name);
 END IF;
 IF student_row.id IS NULL THEN
  INSERT INTO students(school_id,user_id,name,email) VALUES(l.school_id,CASE WHEN on_behalf THEN NULL ELSE actor END,guest_name,guest_email)
  RETURNING * INTO student_row;
 END IF;
 SELECT * INTO booking_row FROM bookings b WHERE b.lesson_id=l.id AND b.student_id=student_row.id
 ORDER BY (b.status='booked') DESC,b.created_at DESC LIMIT 1;
 IF booking_row.status='booked' THEN RETURN QUERY SELECT student_row.id,student_row.email,'already_booked'::text; RETURN; END IF;
 SELECT count(*)::int INTO n FROM bookings b WHERE b.lesson_id=l.id AND b.status='booked';
 IF l.capacity IS NOT NULL AND n>=l.capacity THEN RAISE EXCEPTION 'Lesson is full' USING ERRCODE='P0003'; END IF;
 IF booking_row.id IS NOT NULL THEN UPDATE bookings SET status='booked',cancelled_at=NULL,updated_at=now() WHERE id=booking_row.id;
 ELSE INSERT INTO bookings(lesson_id,student_id,status) VALUES(l.id,student_row.id,'booked'); END IF;
 RETURN QUERY SELECT student_row.id,student_row.email,'booked'::text;
END $$;
