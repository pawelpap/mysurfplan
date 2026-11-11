-- B4: additive invitations and stricter school administration. No owner inference.
CREATE TABLE school_access_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id),
 actor_id uuid REFERENCES users(id), person_id uuid REFERENCES users(id), invitation_id uuid REFERENCES school_invitations(id),
 action text NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE school_invitations ADD COLUMN email_job_id uuid REFERENCES job_outbox(id) ON DELETE SET NULL;
ALTER TABLE job_outbox DROP CONSTRAINT job_outbox_type_check;
ALTER TABLE job_outbox ADD CONSTRAINT job_outbox_type_check CHECK (type IN (
 'email.delivery_check','email.account_verify','email.account_reset','email.account_created_notice',
 'email.password_changed_notice','email.account_closed_notice','email.staff_invitation'));
CREATE FUNCTION invitation_can_admin(actor uuid, school uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT account_manages_school(actor,school) AND (account_is_platform(actor) OR EXISTS(
 SELECT 1 FROM schools s JOIN school_memberships m ON m.id=s.owner_membership_id
 WHERE s.id=school AND m.user_id=actor AND m.status='active'))
$$;
CREATE FUNCTION invitation_authorised(actor uuid, school uuid, roles text[]) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT account_manages_school(actor,school) AND
 (NOT 'school_admin'=ANY(roles) OR invitation_can_admin(actor,school))
$$;
CREATE OR REPLACE FUNCTION set_school_access(actor uuid, person uuid, school uuid, requested_roles text[], requested_status text)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE target_id uuid; existing_status text;
BEGIN
 PERFORM assert_membership_authority();
 IF requested_status NOT IN ('active','suspended','left') OR requested_roles IS NULL OR
 cardinality(requested_roles)>2 OR NOT requested_roles <@ ARRAY['coach','school_admin']::text[] OR
 array_position(requested_roles,NULL) IS NOT NULL OR
 (cardinality(requested_roles)=2 AND requested_roles[1]=requested_roles[2]) THEN
 RAISE EXCEPTION 'Invalid school access' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM users WHERE id IN(actor,person) ORDER BY id FOR SHARE;
 PERFORM 1 FROM schools WHERE id=school FOR UPDATE;
 PERFORM 1 FROM school_memberships WHERE school_id=school AND user_id IN(actor,person) ORDER BY id FOR UPDATE;
 IF NOT account_manages_school(actor,school) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=person AND deleted_at IS NULL) THEN
 RAISE EXCEPTION 'Person not found' USING ERRCODE='P0002'; END IF;
 SELECT id,status INTO target_id,existing_status FROM school_memberships WHERE school_id=school AND user_id=person;
 IF NOT invitation_can_admin(actor,school) AND (
 'school_admin'=ANY(requested_roles) OR EXISTS(SELECT 1 FROM membership_roles WHERE membership_id=target_id AND role='school_admin' AND revoked_at IS NULL)
 OR EXISTS(SELECT 1 FROM schools WHERE id=school AND owner_membership_id=target_id)) THEN
 RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF existing_status='suspended' AND requested_status<>'suspended' AND NOT invitation_can_admin(actor,school) THEN
 RAISE EXCEPTION 'Owner approval required to restore suspended access' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=person AND disabled_at IS NULL AND deleted_at IS NULL AND self_closed_at IS NULL) THEN
 RAISE EXCEPTION 'Account unavailable' USING ERRCODE='23514'; END IF;
 -- New affiliations require the platform operator until verified invitations ship in B4.
 IF target_id IS NULL AND NOT account_is_platform(actor) THEN RAISE EXCEPTION 'Invite through the platform administrator' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM schools WHERE id=school AND owner_membership_id=target_id) AND requested_status<>'active' THEN
 RAISE EXCEPTION 'Transfer ownership before removing the owner' USING ERRCODE='23514'; END IF;
 IF actor=person AND NOT invitation_can_admin(actor,school) AND
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
 INSERT INTO school_access_events(school_id,actor_id,person_id,action,details) VALUES(school,actor,person,'access_changed',jsonb_build_object('roles',requested_roles,'status',requested_status));
 RETURN target_id;
END $$;


CREATE FUNCTION manage_staff_invitation(actor uuid, school uuid, operation text, invitation uuid,
 email text, roles text[], coach uuid, hash text, job uuid, environment text, recipient text, encrypted jsonb)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE i school_invitations; result uuid;
BEGIN
 PERFORM assert_membership_authority();
 -- Account locks precede school, membership, invitation and outbox locks everywhere in B4.
 PERFORM 1 FROM users WHERE id=actor FOR SHARE;
 PERFORM 1 FROM schools WHERE id=school FOR UPDATE;
 IF NOT account_manages_school(actor,school) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF operation NOT IN ('invite','reissue','revoke') THEN RAISE EXCEPTION 'Invalid action' USING ERRCODE='22023'; END IF;
 IF operation<>'invite' THEN
  SELECT * INTO i FROM school_invitations WHERE id=invitation AND school_id=school FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='P0002'; END IF;
  email:=i.invited_email; roles:=i.requested_roles; coach:=i.legacy_coach_id;
  IF i.status='accepted' OR (operation='reissue' AND i.status<>'pending') THEN RAISE EXCEPTION 'Invitation consumed' USING ERRCODE='23514'; END IF;
 END IF;
 IF roles IS NULL OR cardinality(roles) NOT BETWEEN 1 AND 2 OR NOT roles <@ ARRAY['coach','school_admin']::text[]
 OR array_position(roles,NULL) IS NOT NULL OR (cardinality(roles)=2 AND roles[1]=roles[2])
 OR email IS NULL OR email<>lower(btrim(email)) OR length(email)>254 THEN
 RAISE EXCEPTION 'Invalid invitation' USING ERRCODE='22023'; END IF;
 IF NOT invitation_authorised(actor,school,roles) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF operation='invite' AND EXISTS(SELECT 1 FROM school_invitations WHERE school_id=school AND invited_email=email AND status='pending' AND expires_at>now()) THEN
  -- Identical generic response, with no account lookup and no duplicate email.
  RETURN NULL;
 END IF;
 IF operation<>'revoke' AND coach IS NOT NULL AND (NOT 'coach'=ANY(roles) OR NOT EXISTS(
 SELECT 1 FROM coaches WHERE id=coach AND school_id=school AND user_id IS NULL AND deleted_at IS NULL AND lower(btrim(coaches.email))=$5)) THEN
 RAISE EXCEPTION 'Invalid instructor claim' USING ERRCODE='22023'; END IF;
 UPDATE school_invitations SET status='revoked',revoked_at=now()
 WHERE school_id=school AND status='pending' AND
 ((operation='invite' AND invited_email=email AND expires_at<=now()) OR (operation<>'invite' AND id=invitation));
 UPDATE job_outbox SET status='cancelled',payload=NULL,lease_token=NULL,lease_until=NULL,updated_at=now(),error_code='invitation_obsolete'
 WHERE id IN(SELECT email_job_id FROM school_invitations WHERE school_id=school AND status='revoked' AND (id=invitation OR invited_email=email)) AND status IN ('pending','leased');
 IF operation='revoke' THEN
 INSERT INTO school_access_events(school_id,actor_id,invitation_id,action) VALUES(school,actor,invitation,'invitation_revoked');
 RETURN NULL; END IF;
 INSERT INTO job_outbox(id,environment,type,idempotency_key,recipient_hash,payload,expires_at)
 VALUES(job,environment,'email.staff_invitation','staff-invitation:'||job,recipient,encrypted,now()+interval '7 days');
 INSERT INTO school_invitations(school_id,invited_email,requested_roles,invited_by,token_hash,expires_at,legacy_coach_id,email_job_id)
 VALUES(school,email,roles,actor,hash,now()+interval '7 days',coach,job) RETURNING id INTO result;
 INSERT INTO school_access_events(school_id,actor_id,invitation_id,action) VALUES(school,actor,result,'invitation_'||operation);
 RETURN job;
END $$;

CREATE FUNCTION accept_staff_invitation(person uuid, hash text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE i school_invitations; u users; member uuid; state text; linked uuid;
BEGIN
 PERFORM assert_membership_authority();
 SELECT * INTO i FROM school_invitations WHERE token_hash=hash;
 IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM 1 FROM users WHERE id IN(person,i.invited_by) ORDER BY id FOR SHARE;
 PERFORM 1 FROM schools WHERE id=i.school_id FOR UPDATE;
 SELECT * INTO i FROM school_invitations WHERE token_hash=hash FOR UPDATE;
 IF i.status<>'pending' OR i.expires_at<=clock_timestamp() OR NOT invitation_authorised(i.invited_by,i.school_id,i.requested_roles) THEN RETURN NULL; END IF;
 SELECT * INTO u FROM users WHERE id=person AND deleted_at IS NULL AND disabled_at IS NULL AND self_closed_at IS NULL AND email_verified_at IS NOT NULL AND NOT is_demo;
 IF NOT FOUND OR lower(btrim(u.email))<>i.invited_email THEN RETURN NULL; END IF;
 SELECT id,status INTO member,state FROM school_memberships WHERE user_id=person AND school_id=i.school_id FOR UPDATE;
 IF state='suspended' THEN RETURN NULL; END IF;
 -- An administrator cannot alter an existing administrator/owner via an instructor invitation.
 IF NOT invitation_can_admin(i.invited_by,i.school_id) AND ((state='active' AND EXISTS(
 SELECT 1 FROM membership_roles WHERE membership_id=member AND role='school_admin' AND revoked_at IS NULL))
 OR EXISTS(SELECT 1 FROM schools WHERE id=i.school_id AND owner_membership_id=member)) THEN RETURN NULL; END IF;
 IF 'coach'=ANY(i.requested_roles) THEN
  SELECT id INTO linked FROM coaches WHERE school_id=i.school_id AND user_id=person AND deleted_at IS NULL FOR UPDATE;
  IF i.legacy_coach_id IS NOT NULL THEN
   IF linked IS NOT NULL AND linked<>i.legacy_coach_id THEN RETURN NULL; END IF;
   PERFORM 1 FROM coaches WHERE id=i.legacy_coach_id AND school_id=i.school_id AND user_id IS NULL AND deleted_at IS NULL AND lower(btrim(email))=i.invited_email FOR UPDATE;
   IF NOT FOUND THEN RETURN NULL; END IF;
   UPDATE coaches SET user_id=person WHERE id=i.legacy_coach_id;
  ELSIF linked IS NULL THEN
   -- Never infer ownership of an unclaimed historical record.
   IF EXISTS(SELECT 1 FROM coaches WHERE school_id=i.school_id AND lower(btrim(email))=i.invited_email) THEN RETURN NULL; END IF;
   INSERT INTO coaches(school_id,user_id,name,email) VALUES(i.school_id,person,concat_ws(' ',u.name,u.family_name),u.email);
  END IF;
 END IF;
 -- Departed memberships must not revive roles outside this new invitation.
 IF state='left' THEN
 UPDATE membership_roles SET revoked_at=COALESCE(revoked_at,now()),origin='explicit' WHERE membership_id=member;
 END IF;
 INSERT INTO school_memberships(school_id,user_id,status,origin) VALUES(i.school_id,person,'active','explicit')
 ON CONFLICT(school_id,user_id) DO UPDATE SET status='active',origin='explicit' RETURNING id INTO member;
 INSERT INTO membership_roles(membership_id,role,origin,granted_by)
 SELECT member,r,'explicit',i.invited_by FROM unnest(i.requested_roles) r
 ON CONFLICT(membership_id,role) DO UPDATE SET revoked_at=NULL,origin='explicit',granted_by=EXCLUDED.granted_by,granted_at=now();
 UPDATE school_invitations SET status='accepted',accepted_by_user_id=person,accepted_at=now() WHERE id=i.id;
 UPDATE job_outbox SET status='cancelled',payload=NULL,lease_token=NULL,lease_until=NULL,updated_at=now(),error_code='invitation_consumed'
 WHERE id=i.email_job_id AND status IN ('pending','leased');
 INSERT INTO school_access_events(school_id,actor_id,person_id,invitation_id,action) VALUES(i.school_id,person,person,i.id,'invitation_accepted');
 RETURN i.school_id;
END $$;
