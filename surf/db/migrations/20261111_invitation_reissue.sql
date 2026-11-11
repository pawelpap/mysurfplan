-- Restore expired-link resend and require renewed acceptance after school departure.
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
 IF existing_status='left' AND requested_status<>'left' AND NOT account_is_platform(actor) THEN
 RAISE EXCEPTION 'A new invitation must be accepted' USING ERRCODE='42501'; END IF;
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

CREATE OR REPLACE FUNCTION manage_staff_invitation(actor uuid, school uuid, operation text, invitation uuid,
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
  IF operation='reissue' AND EXISTS(SELECT 1 FROM school_invitations newer WHERE newer.school_id=school AND newer.invited_email=i.invited_email AND newer.status='pending' AND newer.id<>i.id) THEN
   RAISE EXCEPTION 'A newer invitation already exists' USING ERRCODE='23514'; END IF;
  IF i.status='accepted' OR (operation='reissue' AND i.status NOT IN ('pending','expired')) THEN RAISE EXCEPTION 'Invitation consumed' USING ERRCODE='23514'; END IF;
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
