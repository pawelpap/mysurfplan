-- B5 release 1: private draft setup only. No agreement publication or activation.
SELECT assert_membership_authority();
ALTER TABLE schools
 ADD COLUMN description text NOT NULL DEFAULT '' CHECK (length(description)<=5000),
 ADD COLUMN timezone text NOT NULL DEFAULT 'Europe/Lisbon' CHECK (length(timezone) BETWEEN 1 AND 100),
 ADD COLUMN contact_phone text NOT NULL DEFAULT '' CHECK (length(contact_phone)<=40),
 ADD COLUMN website text NOT NULL DEFAULT '' CHECK (length(website)<=2048 AND (website='' OR website ~ '^https://[^[:space:]]+$')),
 ADD COLUMN social_links jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(social_links)='array' AND jsonb_array_length(social_links)<=5),
 ADD COLUMN settings_revision integer NOT NULL DEFAULT 1 CHECK (settings_revision>0),
 ADD COLUMN pilot_access_status text NOT NULL DEFAULT 'pending' CHECK (pilot_access_status IN ('pending','approved'));
CREATE TABLE school_operating_spots (
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 spot_id uuid NOT NULL REFERENCES surf_spots(id),
 PRIMARY KEY (school_id,spot_id)
);
CREATE TABLE school_creation_requests (
 actor_id uuid NOT NULL REFERENCES users(id),
 request_id uuid NOT NULL,
 payload_fingerprint text NOT NULL CHECK (payload_fingerprint ~ '^[0-9a-f]{64}$'),
 school_id uuid NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,request_id)
);

CREATE FUNCTION school_is_operational(s schools) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT s.deleted_at IS NULL AND s.workspace_status NOT IN ('closed','suspended')
 AND (s.workspace_kind='legacy' OR (s.workspace_status='active' AND s.pilot_access_status='approved'))
$$;
CREATE OR REPLACE VIEW account_school_access AS
WITH state AS (SELECT authority FROM identity_migration_state WHERE singleton), relations AS (
 SELECT u.id AS user_id,u.school_id,NULL::uuid AS membership_id,'active'::text AS status,
 CASE WHEN u.role::text IN ('coach','school_admin') THEN ARRAY[u.role::text] ELSE ARRAY[]::text[] END AS roles,false AS is_owner
 FROM users u,state WHERE state.authority='legacy_shadow' AND u.school_id IS NOT NULL AND u.deleted_at IS NULL
 UNION ALL
 SELECT m.user_id,m.school_id,m.id,m.status,
 COALESCE((SELECT array_agg(r.role ORDER BY r.role) FROM membership_roles r WHERE r.membership_id=m.id AND r.revoked_at IS NULL),ARRAY[]::text[]),
 sc.owner_membership_id=m.id
 FROM school_memberships m JOIN schools sc ON sc.id=m.school_id,state WHERE state.authority='memberships'
 UNION ALL
 SELECT s.user_id,s.school_id,NULL::uuid,'customer',ARRAY[]::text[],false FROM students s,state
 WHERE state.authority='memberships' AND s.user_id IS NOT NULL AND s.deleted_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM school_memberships m WHERE m.user_id=s.user_id AND m.school_id=s.school_id)
 UNION ALL
 SELECT u.id,u.school_id,NULL::uuid,'customer',ARRAY[]::text[],false FROM users u,state
 WHERE state.authority='memberships' AND u.school_id IS NOT NULL AND u.deleted_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM school_memberships m WHERE m.user_id=u.id AND m.school_id=u.school_id)
 AND NOT EXISTS(SELECT 1 FROM students s WHERE s.user_id=u.id AND s.school_id=u.school_id AND s.deleted_at IS NULL)
)
SELECT r.*,sc.slug,sc.name,sc.workspace_kind,sc.workspace_status,school_is_operational(sc) AS school_open
FROM relations r JOIN schools sc ON sc.id=r.school_id;
CREATE OR REPLACE FUNCTION account_manages_school(actor uuid,school uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM users u JOIN schools sc ON sc.id=school
 WHERE u.id=actor AND u.deleted_at IS NULL AND u.disabled_at IS NULL AND school_is_operational(sc)
 AND (account_is_platform(actor) OR EXISTS(SELECT 1 FROM account_school_access a WHERE a.user_id=actor AND a.school_id=school
 AND a.status='active' AND (a.is_owner OR 'school_admin'=ANY(a.roles)))))
$$;

-- Private settings authority is separate from operational staff authority.
-- A draft has only its explicit owner as editor, even for platform administrators.
CREATE FUNCTION account_reads_school_settings(actor uuid,school uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM users u JOIN schools s ON s.id=school
 WHERE u.id=actor AND u.deleted_at IS NULL AND u.disabled_at IS NULL AND u.self_closed_at IS NULL AND NOT u.is_demo
 AND s.deleted_at IS NULL AND s.workspace_status NOT IN ('closed','suspended')
 AND (account_is_platform(actor) OR account_manages_school(actor,school) OR EXISTS(
 SELECT 1 FROM school_memberships m WHERE m.id=s.owner_membership_id AND m.school_id=s.id AND m.user_id=actor AND m.status='active')))
$$;
CREATE FUNCTION account_edits_school_settings(actor uuid,school uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT account_reads_school_settings(actor,school)
 AND EXISTS(SELECT 1 FROM users WHERE id=actor AND email_verified_at IS NOT NULL)
 AND EXISTS(SELECT 1 FROM schools s WHERE s.id=school AND
 (account_manages_school(actor,school) OR EXISTS(SELECT 1 FROM school_memberships m WHERE m.id=s.owner_membership_id
 AND m.school_id=s.id AND m.user_id=actor AND m.status='active')))
$$;
CREATE FUNCTION school_settings_json(s schools,actor uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('id',s.id,'name',s.name,'slug',s.slug,'description',s.description,'timezone',s.timezone,
 'contactEmail',COALESCE(s.contact_email,''),'contactPhone',s.contact_phone,'website',s.website,'socialLinks',s.social_links,
 'operatingSpotIds',COALESCE((SELECT jsonb_agg(spot_id ORDER BY spot_id) FROM school_operating_spots WHERE school_id=s.id),'[]'::jsonb),
 'revision',s.settings_revision,'workspaceKind',s.workspace_kind,'workspaceStatus',s.workspace_status,'listingStatus',s.listing_status,
 'pilotAccessStatus',s.pilot_access_status,'canEdit',account_edits_school_settings(actor,s.id),
 'owner',EXISTS(SELECT 1 FROM school_memberships m WHERE m.id=s.owner_membership_id AND m.user_id=actor AND m.status='active'))
$$;

CREATE FUNCTION validate_school_settings(details jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE field text; link jsonb; spots uuid[];
BEGIN
 IF details IS NULL OR jsonb_typeof(details)<>'object' OR
 (details-ARRAY['name','description','timezone','contactEmail','contactPhone','website','socialLinks','operatingSpotIds'])<>'{}'::jsonb
 OR NOT details ?& ARRAY['name','description','timezone','contactEmail','contactPhone','website','socialLinks','operatingSpotIds'] THEN
 RAISE EXCEPTION 'Invalid school settings' USING ERRCODE='22023'; END IF;
 FOREACH field IN ARRAY ARRAY['name','description','timezone','contactEmail','contactPhone','website'] LOOP
  IF jsonb_typeof(details->field)<>'string' THEN RAISE EXCEPTION 'Invalid school settings' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF length(btrim(details->>'name')) NOT BETWEEN 1 AND 160 OR details->>'name' !~ '[a-zA-Z0-9]'
 OR length(details->>'description')>5000 OR length(details->>'timezone')>100
 OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=details->>'timezone')
 OR length(details->>'contactEmail')>254 OR (details->>'contactEmail'<>'' AND details->>'contactEmail' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
 OR length(details->>'contactPhone')>40 OR (details->>'contactPhone'<>'' AND details->>'contactPhone' !~ '^\+?[0-9 ()/.-]{3,40}$')
 OR length(details->>'website')>2048 OR (details->>'website'<>'' AND details->>'website' !~ '^https://[^[:space:]/@?#]+([/?#][^[:space:]]*)?$') THEN
 RAISE EXCEPTION 'Invalid school settings' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(details->'socialLinks')<>'array' OR jsonb_typeof(details->'operatingSpotIds')<>'array' THEN
 RAISE EXCEPTION 'Invalid school settings' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(details->'socialLinks')>5 OR jsonb_array_length(details->'operatingSpotIds')>30 THEN
 RAISE EXCEPTION 'Invalid school settings' USING ERRCODE='22023'; END IF;
 FOR link IN SELECT value FROM jsonb_array_elements(details->'socialLinks') LOOP
  IF jsonb_typeof(link)<>'string' OR length(link#>>'{}')>2048 OR link#>>'{}' !~ '^https://[^[:space:]/@?#]+([/?#][^[:space:]]*)?$' THEN
  RAISE EXCEPTION 'Invalid social link' USING ERRCODE='22023'; END IF;
 END LOOP;
 FOR link IN SELECT value FROM jsonb_array_elements(details->'operatingSpotIds') LOOP
  IF jsonb_typeof(link)<>'string' OR link#>>'{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
  RAISE EXCEPTION 'Invalid operating spot' USING ERRCODE='22023'; END IF;
 END LOOP;
 SELECT COALESCE(array_agg(value::uuid),ARRAY[]::uuid[]) INTO spots FROM jsonb_array_elements_text(details->'operatingSpotIds');
 -- Hold the active catalogue rows until commit, so concurrent deactivation waits.
 PERFORM 1 FROM surf_spots WHERE id=ANY(spots) ORDER BY id FOR SHARE;
 IF cardinality(spots)<>(SELECT count(DISTINCT id) FROM surf_spots WHERE id=ANY(spots) AND active) THEN
 RAISE EXCEPTION 'Choose active operating spots' USING ERRCODE='22023'; END IF;
END $$;

CREATE FUNCTION create_draft_school(actor uuid,request uuid,details jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE existing school_creation_requests; school schools; membership uuid:=gen_random_uuid(); fingerprint text;
BEGIN
 PERFORM assert_membership_authority();
 -- Serialise with self-closure and deactivation BEFORE inserting school/owner rows.
 PERFORM 1 FROM users WHERE id=actor FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND deleted_at IS NULL AND disabled_at IS NULL
 AND self_closed_at IS NULL AND NOT is_demo AND email_verified_at IS NOT NULL) THEN
 RAISE EXCEPTION 'Verified account required' USING ERRCODE='42501'; END IF;
 IF request IS NULL THEN RAISE EXCEPTION 'Request ID required' USING ERRCODE='22023'; END IF;
 fingerprint:=encode(sha256(convert_to(details::text,'UTF8')),'hex');
 SELECT * INTO existing FROM school_creation_requests WHERE actor_id=actor AND request_id=request;
 IF FOUND THEN
  IF existing.payload_fingerprint IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'Request changed' USING ERRCODE='23514'; END IF;
  IF NOT account_reads_school_settings(actor,existing.school_id) THEN RAISE EXCEPTION 'School unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO school FROM schools WHERE id=existing.school_id;
  RETURN jsonb_build_object('data',school_settings_json(school,actor),'replayed',true);
 END IF;
 PERFORM validate_school_settings(details);
 INSERT INTO schools(name,contact_email,description,timezone,contact_phone,website,social_links,
 workspace_kind,workspace_status,listing_status,pilot_access_status,owner_membership_id)
 VALUES(details->>'name',NULLIF(details->>'contactEmail',''),details->>'description',details->>'timezone',details->>'contactPhone',
 details->>'website',details->'socialLinks','self_service','draft','unlisted','pending',membership) RETURNING * INTO school;
 INSERT INTO school_memberships(id,school_id,user_id,status,origin) VALUES(membership,school.id,actor,'active','explicit');
 INSERT INTO school_operating_spots(school_id,spot_id) SELECT school.id,value::uuid FROM jsonb_array_elements_text(details->'operatingSpotIds');
 INSERT INTO school_creation_requests(actor_id,request_id,payload_fingerprint,school_id) VALUES(actor,request,fingerprint,school.id);
 INSERT INTO school_access_events(school_id,actor_id,person_id,action) VALUES(school.id,actor,actor,'school_draft_created');
 RETURN jsonb_build_object('data',school_settings_json(school,actor),'replayed',false);
END $$;

CREATE FUNCTION update_school_settings(actor uuid,target uuid,revision integer,details jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE school schools;
BEGIN
 PERFORM assert_membership_authority();
 PERFORM 1 FROM users WHERE id=actor FOR UPDATE;
 PERFORM 1 FROM schools WHERE id=target FOR UPDATE;
 PERFORM 1 FROM school_memberships WHERE school_id=target AND user_id=actor FOR UPDATE;
 -- Recheck after all locks: stale sessions/roles/lifecycle never authorise a write.
 IF NOT account_edits_school_settings(actor,target) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO school FROM schools WHERE id=target;
 IF revision IS NULL OR school.settings_revision<>revision THEN RAISE EXCEPTION 'School settings changed' USING ERRCODE='40001'; END IF;
 PERFORM validate_school_settings(details);
 UPDATE schools SET name=details->>'name',contact_email=NULLIF(details->>'contactEmail',''),description=details->>'description',
 timezone=details->>'timezone',contact_phone=details->>'contactPhone',website=details->>'website',social_links=details->'socialLinks',
 settings_revision=settings_revision+1,updated_at=now() WHERE id=target RETURNING * INTO school;
 DELETE FROM school_operating_spots WHERE school_id=target;
 INSERT INTO school_operating_spots(school_id,spot_id) SELECT target,value::uuid FROM jsonb_array_elements_text(details->'operatingSpotIds');
 INSERT INTO school_access_events(school_id,actor_id,action) VALUES(target,actor,'school_settings_updated');
 RETURN jsonb_build_object('data',school_settings_json(school,actor));
END $$;

COMMENT ON COLUMN schools.pilot_access_status IS 'Independent operator decision. B5 release 1 has no endpoint that approves access or activates a school.';
COMMENT ON TABLE school_creation_requests IS 'Actor-scoped create retry evidence; never grants ownership or accepts an agreement on replay.';

-- The database booking boundary must reject a draft even for platform actors.
CREATE OR REPLACE FUNCTION reserve_lesson(actor uuid, lesson_id_arg uuid, on_behalf boolean, guest_name text, guest_email text)
RETURNS TABLE(student_id uuid,email text,outcome text) LANGUAGE plpgsql AS $$
DECLARE l lessons%ROWTYPE; u users%ROWTYPE; student_row students%ROWTYPE; booking_row bookings%ROWTYPE; n integer;
BEGIN
 SELECT * INTO u FROM users WHERE id=actor AND deleted_at IS NULL AND disabled_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM lessons WHERE id=lesson_id_arg AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lesson not found' USING ERRCODE='P0002'; END IF;
 IF NOT EXISTS(SELECT 1 FROM schools s WHERE id=l.school_id AND school_is_operational(s)) OR
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

-- Platform account creation must not enrol customers into a draft.
CREATE OR REPLACE FUNCTION create_global_account(actor uuid, details jsonb, secret_hash text, school uuid, roles text[], platform boolean)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE person uuid;
BEGIN
 PERFORM assert_membership_authority();
 PERFORM 1 FROM users WHERE id=actor FOR SHARE;
 IF school IS NOT NULL THEN
  PERFORM 1 FROM schools WHERE id=school FOR UPDATE;
  IF NOT account_manages_school(actor,school) THEN RAISE EXCEPTION 'School unavailable' USING ERRCODE='42501'; END IF;
 END IF;
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
