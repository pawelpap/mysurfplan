-- Explicit ownership of school workspaces. No legal-business title inference.
SELECT assert_membership_authority();
ALTER TABLE schools ADD COLUMN ownership_revision bigint NOT NULL DEFAULT 1 CHECK(ownership_revision>0),
 ADD COLUMN explicit_owner_required_status text GENERATED ALWAYS AS
 (CASE WHEN owner_membership_id IS NOT NULL AND workspace_status<>'closed' THEN 'active'::text END) STORED,
 ADD CONSTRAINT fk_school_explicit_active_owner FOREIGN KEY(id,owner_membership_id,explicit_owner_required_status)
 REFERENCES school_memberships(school_id,id,status) DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION advance_school_ownership_revision()RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.owner_membership_id IS DISTINCT FROM OLD.owner_membership_id OR NEW.workspace_status IS DISTINCT FROM OLD.workspace_status
 OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN NEW.ownership_revision:=OLD.ownership_revision+1;
 ELSE NEW.ownership_revision:=OLD.ownership_revision; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER schools_ownership_revision BEFORE UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION advance_school_ownership_revision();
CREATE TABLE school_ownership_claims(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),environment text NOT NULL REFERENCES job_environment(environment),
 school_id uuid NOT NULL REFERENCES schools(id),claimant_id uuid NOT NULL REFERENCES users(id),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),ownership_revision bigint NOT NULL,
 statement text CHECK(length(statement) BETWEEN 1 AND 2000),status text NOT NULL DEFAULT 'submitted'
 CHECK(status IN('submitted','approved','rejected','withdrawn','expired','completed','superseded')),
 reviewed_by uuid REFERENCES users(id),reviewed_at timestamptz,decision_reason text CHECK(length(decision_reason)<=1000),
 case_reference text CHECK(length(case_reference)<=200),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),terminal_at timestamptz,
 CHECK(reviewed_by IS NULL OR reviewed_by<>claimant_id)
);
CREATE UNIQUE INDEX ownership_claim_open_person ON school_ownership_claims(school_id,claimant_id)WHERE status IN('submitted','approved');
CREATE TABLE school_ownership_offers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),environment text NOT NULL REFERENCES job_environment(environment),
 kind text NOT NULL CHECK(kind IN('claim','transfer')),claim_id uuid REFERENCES school_ownership_claims(id),
 school_id uuid NOT NULL REFERENCES schools(id),issued_by uuid NOT NULL REFERENCES users(id),issuer_auth_version integer NOT NULL,
 source_owner_membership_id uuid,ownership_revision bigint NOT NULL,recipient_user_id uuid NOT NULL REFERENCES users(id),
 recipient_auth_version integer NOT NULL,recipient_email text CHECK(length(recipient_email)<=254),
 token_hash text UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'),status text NOT NULL DEFAULT 'pending'
 CHECK(status IN('pending','accepted','declined','cancelled','expired','superseded')),
 email_job_id uuid REFERENCES job_outbox(id)ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,terminal_at timestamptz,
 FOREIGN KEY(school_id,source_owner_membership_id)REFERENCES school_memberships(school_id,id),
 CHECK((kind='claim' AND claim_id IS NOT NULL AND source_owner_membership_id IS NULL)OR(kind='transfer' AND claim_id IS NULL AND source_owner_membership_id IS NOT NULL))
);
CREATE UNIQUE INDEX ownership_offer_open_school ON school_ownership_offers(school_id)WHERE status='pending';
CREATE TABLE school_ownership_acceptances(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),offer_id uuid NOT NULL UNIQUE REFERENCES school_ownership_offers(id),
 school_id uuid NOT NULL REFERENCES schools(id),user_id uuid NOT NULL REFERENCES users(id),membership_id uuid NOT NULL,
 previous_owner_membership_id uuid,ownership_revision bigint NOT NULL,canonical_acceptance_id uuid NOT NULL REFERENCES legal_acceptances(id),
 document_id text NOT NULL,version text NOT NULL,language text NOT NULL,content_hash text NOT NULL,
 consequences_version text NOT NULL CHECK(consequences_version='ownership-workspace/1'),authorised_representative boolean NOT NULL CHECK(authorised_representative),
 accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(school_id,membership_id)REFERENCES school_memberships(school_id,id),
 FOREIGN KEY(school_id,previous_owner_membership_id)REFERENCES school_memberships(school_id,id),
 FOREIGN KEY(document_id,version,language,content_hash)REFERENCES legal_documents(document_id,version,language,content_hash)
);
CREATE TRIGGER ownership_acceptances_immutable BEFORE UPDATE ON school_ownership_acceptances FOR EACH ROW EXECUTE FUNCTION legal_document_immutable();
CREATE TABLE school_ownership_requests(
 actor_id uuid NOT NULL REFERENCES users(id),request_id uuid NOT NULL,action text NOT NULL,fingerprint text,
 school_id uuid NOT NULL REFERENCES schools(id),claim_id uuid REFERENCES school_ownership_claims(id),offer_id uuid REFERENCES school_ownership_offers(id),
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,request_id)
);
CREATE TABLE school_ownership_notice_jobs(
 job_id uuid PRIMARY KEY REFERENCES job_outbox(id)ON DELETE CASCADE,acceptance_id uuid NOT NULL REFERENCES school_ownership_acceptances(id),
 recipient_user_id uuid NOT NULL REFERENCES users(id),audience text NOT NULL CHECK(audience IN('new','previous')),
 UNIQUE(acceptance_id,audience)
);
ALTER TABLE job_outbox DROP CONSTRAINT job_outbox_type_check;
ALTER TABLE job_outbox ADD CONSTRAINT job_outbox_type_check CHECK(type IN('email.delivery_check','email.account_verify','email.account_reset',
 'email.account_created_notice','email.password_changed_notice','email.account_closed_notice','email.staff_invitation','email.ownership_offer','email.ownership_changed'));

CREATE FUNCTION ownership_account_eligible(person uuid)RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM users WHERE id=person AND deleted_at IS NULL AND disabled_at IS NULL AND self_closed_at IS NULL AND NOT is_demo AND email_verified_at IS NOT NULL)
$$;
CREATE FUNCTION ownership_school_eligible(s schools)RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT s.id<>'7abd47ea-705a-4a75-ad90-274c32c14f95'::uuid AND s.deleted_at IS NULL AND s.workspace_status IN('draft','active')
$$;
CREATE FUNCTION ownership_claimable(s schools)RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT ownership_school_eligible(s)AND s.workspace_kind='legacy' AND s.listing_status='published' AND s.owner_membership_id IS NULL
$$;
CREATE FUNCTION ownership_actor_proof(actor uuid,session_hash text,verified_hash text DEFAULT NULL,verified_epoch integer DEFAULT NULL)RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF NOT ownership_account_eligible(actor)OR(verified_hash IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND password_hash=verified_hash AND auth_version=verified_epoch))THEN
 RAISE EXCEPTION 'ownership.forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM auth_sessions a JOIN users u ON u.id=a.user_id WHERE a.token_hash=session_hash AND a.user_id=actor
 AND a.auth_version=u.auth_version AND a.revoked_at IS NULL AND a.expires_at>clock_timestamp() FOR SHARE OF a;
 IF NOT FOUND THEN RAISE EXCEPTION 'ownership.forbidden' USING ERRCODE='42501';END IF;
END $$;
CREATE FUNCTION ownership_roles(member uuid)RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT COALESCE(jsonb_agg(role ORDER BY role),'[]'::jsonb)FROM membership_roles WHERE membership_id=member AND revoked_at IS NULL
$$;
CREATE FUNCTION ownership_school_json(s schools)RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('id',s.id,'name',s.name,'slug',s.slug,'ownershipRevision',s.ownership_revision,'workspaceStatus',s.workspace_status)
$$;
CREATE FUNCTION ownership_offer_json(o school_ownership_offers)RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('id',o.id,'kind',o.kind,'status',CASE WHEN o.status='pending' AND o.expires_at<=now()THEN 'expired' ELSE o.status END,
 'recipientEmail',o.recipient_email,'expiresAt',o.expires_at,'createdAt',o.created_at,'deliveryStatus',
 (SELECT CASE WHEN status IN('pending','leased')THEN 'queued' WHEN status IN('accepted','delivered')THEN 'sent' WHEN status='delivery_unknown'THEN 'uncertain'
 WHEN status IN('failed','bounced','blocked','expired')THEN 'failed' ELSE 'cancelled' END FROM job_outbox WHERE id=o.email_job_id))
$$;
CREATE FUNCTION ownership_claim_json(c school_ownership_claims,reviewer boolean DEFAULT false)RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('id',c.id,'revision',c.revision,'school',ownership_school_json(s),'status',c.status,'createdAt',c.created_at,'updatedAt',c.updated_at,
 'statement',c.statement,'decisionReason',c.decision_reason,'offer',(SELECT ownership_offer_json(o)FROM school_ownership_offers o WHERE o.claim_id=c.id ORDER BY o.created_at DESC,o.id DESC LIMIT 1))
 ||CASE WHEN reviewer THEN jsonb_build_object('claimant',jsonb_build_object('id',u.id,'name',concat_ws(' ',u.name,u.family_name),'email',u.email),
 'review',CASE WHEN c.reviewed_by IS NOT NULL THEN jsonb_build_object('decision',CASE WHEN c.status='rejected'THEN 'reject' ELSE 'approve' END,
 'reason',c.decision_reason,'caseReference',c.case_reference,'reviewedAt',c.reviewed_at) END)ELSE '{}'::jsonb END
 FROM schools s JOIN users u ON u.id=c.claimant_id WHERE s.id=c.school_id
$$;
CREATE FUNCTION ownership_summary(actor uuid,target uuid)RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('school',ownership_school_json(s),'owner',CASE WHEN m.id IS NOT NULL THEN jsonb_build_object('membershipId',m.id,'userId',u.id,
 'name',concat_ws(' ',u.name,u.family_name),'email',u.email,'roles',ownership_roles(m.id))END,
 'canTransfer',ownership_account_eligible(actor)AND ownership_school_eligible(s)AND m.user_id=actor AND m.status='active',
 'formerOwnerRoles',ownership_roles(m.id),'pendingOffer',(SELECT ownership_offer_json(o)FROM school_ownership_offers o WHERE o.school_id=s.id AND o.status='pending' ORDER BY o.created_at DESC LIMIT 1),
 'closureSupportEmail','support@mywaveplan.com')FROM schools s LEFT JOIN school_memberships m ON m.id=s.owner_membership_id LEFT JOIN users u ON u.id=m.user_id
 WHERE s.id=target AND ownership_account_eligible(actor)AND(account_is_platform(actor)OR(m.user_id=actor AND m.status='active'))
$$;
CREATE FUNCTION ownership_offer_valid(o school_ownership_offers)RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT o.status='pending' AND o.expires_at>clock_timestamp() AND ownership_account_eligible(o.recipient_user_id)
 AND EXISTS(SELECT 1 FROM users WHERE id=o.recipient_user_id AND auth_version=o.recipient_auth_version AND lower(btrim(email))=o.recipient_email)
 AND ownership_account_eligible(o.issued_by) AND EXISTS(SELECT 1 FROM users WHERE id=o.issued_by AND auth_version=o.issuer_auth_version)
 AND EXISTS(SELECT 1 FROM schools s WHERE s.id=o.school_id AND ownership_school_eligible(s) AND s.ownership_revision=o.ownership_revision
 AND s.owner_membership_id IS NOT DISTINCT FROM o.source_owner_membership_id
 AND((o.kind='claim' AND account_is_platform(o.issued_by)AND EXISTS(SELECT 1 FROM school_ownership_claims c WHERE c.id=o.claim_id AND c.status='approved'))
 OR(o.kind='transfer' AND EXISTS(SELECT 1 FROM school_memberships m WHERE m.id=s.owner_membership_id AND m.user_id=o.issued_by AND m.status='active'))))
 AND NOT EXISTS(SELECT 1 FROM school_memberships WHERE school_id=o.school_id AND user_id=o.recipient_user_id AND status='suspended')
$$;
-- Called only after users, school and membership locks. Operational terminalisation precedes outbox locks.
CREATE FUNCTION ownership_expire_offers(target uuid)RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 UPDATE school_ownership_offers o SET status=CASE WHEN expires_at<=clock_timestamp()THEN 'expired' ELSE 'superseded' END,terminal_at=CASE WHEN expires_at<=clock_timestamp()THEN expires_at ELSE clock_timestamp()END
 WHERE o.school_id=target AND o.status='pending' AND NOT ownership_offer_valid(o);
 UPDATE school_ownership_claims c SET status=CASE WHEN EXISTS(SELECT 1 FROM school_ownership_offers o WHERE o.claim_id=c.id AND o.status='expired')THEN 'expired' ELSE 'superseded' END,
 terminal_at=clock_timestamp(),updated_at=clock_timestamp(),revision=revision+1
 WHERE c.school_id=target AND c.status='approved' AND NOT EXISTS(SELECT 1 FROM school_ownership_offers o WHERE o.claim_id=c.id AND o.status='pending');
END $$;
CREATE FUNCTION ownership_cancel_jobs(target uuid)RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 UPDATE job_outbox SET status='cancelled',payload=NULL,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp(),error_code='ownership_offer_obsolete'
 WHERE id IN(SELECT email_job_id FROM school_ownership_offers WHERE school_id=target AND status<>'pending')AND status IN('pending','leased');
END $$;
CREATE FUNCTION ownership_insert_mail(mail jsonb,person uuid,kind text,environment_arg text)RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE u users;job uuid;
BEGIN
 SELECT * INTO u FROM users WHERE id=person;
 IF mail IS NULL OR mail->>'email' IS DISTINCT FROM lower(btrim(u.email))OR(mail->>'userId')::uuid IS DISTINCT FROM person
 OR(mail->>'authVersion')::integer IS DISTINCT FROM u.auth_version OR mail->>'environment' IS DISTINCT FROM environment_arg
 OR jsonb_typeof(mail->'payload')<>'object' OR mail->>'recipientHash' IS NULL THEN
 RAISE EXCEPTION 'ownership.deliveryUnavailable' USING ERRCODE='23514';END IF;
 job:=(mail->>'jobId')::uuid;
 INSERT INTO job_outbox(id,environment,type,idempotency_key,user_id,requires_user,user_auth_version,recipient_hash,payload,expires_at)
 VALUES(job,environment_arg,kind,'ownership:'||job,person,true,u.auth_version,mail->>'recipientHash',mail->'payload',clock_timestamp()+interval '7 days');
 RETURN job;
END $$;
CREATE FUNCTION ownership_acceptance_result(o school_ownership_offers,actor uuid,replayed boolean)RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('school',ownership_school_json(s),'status','accepted','acceptedAt',a.accepted_at,
 'currentlyOwner',s.owner_membership_id=a.membership_id AND m.status='active' AND ownership_account_eligible(actor),
 'roles',ownership_roles(a.membership_id),'replayed',replayed)
 FROM school_ownership_acceptances a JOIN schools s ON s.id=a.school_id JOIN school_memberships m ON m.id=a.membership_id WHERE a.offer_id=o.id AND a.user_id=actor
$$;

-- HTTP bodies are strictly validated before this boundary. All authority is rechecked here.
CREATE FUNCTION school_ownership_action(actor uuid,operation text,b jsonb,session_hash text,
 verified_hash text DEFAULT NULL,verified_epoch integer DEFAULT NULL,mail jsonb DEFAULT '{}'::jsonb)RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE s schools;c school_ownership_claims;o school_ownership_offers;u users;issuer users;prior school_ownership_requests;
 target uuid;recipient uuid;owner_user uuid;member school_memberships;doc legal_documents;policy school_onboarding_policy;
 environment_arg text;request uuid;digest text;result jsonb;job uuid;offer_uuid uuid;canonical uuid;acceptance uuid;recipient_mail jsonb;
BEGIN
 PERFORM assert_membership_authority();
 SELECT environment INTO environment_arg FROM job_environment WHERE singleton;
 IF operation IN('preview','accept','decline')THEN
  SELECT * INTO o FROM school_ownership_offers WHERE token_hash=b->>'tokenHash';
  IF NOT FOUND THEN RAISE EXCEPTION 'ownership.invalidLink' USING ERRCODE='P0002';END IF;
  -- No school, recipient or offer details escape for the wrong account.
  IF o.recipient_user_id<>actor THEN RAISE EXCEPTION 'ownership.wrongAccount' USING ERRCODE='42501';END IF;
  target:=o.school_id;recipient:=o.recipient_user_id;
 ELSIF operation IN('review','withdraw')THEN
  SELECT * INTO c FROM school_ownership_claims WHERE id=(b->>'claimId')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'ownership.forbidden' USING ERRCODE='42501';END IF;
  target:=c.school_id;recipient:=c.claimant_id;
 ELSE
  target:=(b->>'schoolId')::uuid;
  IF operation='transfer'THEN
   SELECT id INTO recipient FROM users WHERE lower(btrim(email))=b->>'recipientEmail' AND deleted_at IS NULL;
  ELSIF operation IN('cancel','reissue')THEN
   SELECT * INTO o FROM school_ownership_offers WHERE id=(b->>'offerId')::uuid AND school_id=target;
   recipient:=o.recipient_user_id;
  ELSE recipient:=actor;END IF;
 END IF;
 SELECT m.user_id INTO owner_user FROM schools sc JOIN school_memberships m ON m.id=sc.owner_membership_id WHERE sc.id=target;
 PERFORM 1 FROM users WHERE id IN(actor,recipient,owner_user,o.issued_by,c.reviewed_by)ORDER BY id FOR UPDATE;
 PERFORM 1 FROM schools WHERE id=target FOR UPDATE;
 SELECT * INTO s FROM schools WHERE id=target;
 IF NOT FOUND THEN RAISE EXCEPTION 'ownership.forbidden' USING ERRCODE='42501';END IF;
 PERFORM ownership_actor_proof(actor,session_hash,verified_hash,verified_epoch);
 IF operation IN('review','transfer','reissue','cancel','accept')AND verified_hash IS NULL THEN RAISE EXCEPTION 'ownership.forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM school_memberships WHERE school_id=target AND user_id IN(actor,recipient,owner_user,o.issued_by)ORDER BY id FOR UPDATE;
 PERFORM 1 FROM school_ownership_claims WHERE school_id=target ORDER BY id FOR UPDATE;
 PERFORM 1 FROM school_ownership_offers WHERE school_id=target ORDER BY id FOR UPDATE;
 IF c.id IS NOT NULL THEN SELECT * INTO c FROM school_ownership_claims WHERE id=c.id;END IF;
 IF o.id IS NOT NULL THEN SELECT * INTO o FROM school_ownership_offers WHERE id=o.id;END IF;
 IF o.id IS NOT NULL AND o.environment<>environment_arg OR c.id IS NOT NULL AND c.environment<>environment_arg THEN RAISE EXCEPTION 'ownership.forbidden' USING ERRCODE='42501';END IF;
 -- Bound completion remains historical and cannot be used to restore an owner pointer.
 IF operation IN('accept','preview')AND o.status='accepted'THEN
  IF operation='accept'THEN RETURN ownership_acceptance_result(o,actor,true);END IF;
  RETURN jsonb_build_object('offer',ownership_offer_json(o),'school',ownership_school_json(s),'account',jsonb_build_object('id',actor,'email',(SELECT email FROM users WHERE id=actor)),
   'consequences',NULL,'agreement',NULL,'canAccept',false,'completed',ownership_acceptance_result(o,actor,true));
 END IF;
 IF operation='decline' AND o.status='declined'THEN RETURN jsonb_build_object('status','declined','replayed',true);END IF;
 IF operation IN('preview','accept','decline')THEN
  IF o.status<>'pending'THEN RAISE EXCEPTION 'ownership.revoked' USING ERRCODE='23514';END IF;
  IF o.expires_at<=clock_timestamp()THEN RAISE EXCEPTION 'ownership.expired' USING ERRCODE='23514';END IF;
  IF NOT ownership_offer_valid(o)THEN RAISE EXCEPTION 'ownership.revoked' USING ERRCODE='23514';END IF;
 END IF;
 IF operation IN('transfer','reissue','cancel')THEN
  IF NOT ownership_school_eligible(s)OR NOT EXISTS(SELECT 1 FROM school_memberships WHERE id=s.owner_membership_id AND user_id=actor AND status='active')THEN
   RAISE EXCEPTION 'ownership.forbidden' USING ERRCODE='42501';END IF;
  IF operation<>'transfer' AND(o.id IS NULL OR o.kind<>'transfer')THEN RAISE EXCEPTION 'ownership.forbidden' USING ERRCODE='42501';END IF;
 END IF;
 IF operation='review' AND(NOT account_is_platform(actor)OR c.claimant_id=actor)OR operation='withdraw' AND c.claimant_id<>actor THEN
  RAISE EXCEPTION 'ownership.forbidden' USING ERRCODE='42501';END IF;
 IF operation NOT IN('preview','accept','decline')THEN
  request:=(b->>'requestId')::uuid;
  IF request IS NULL THEN RAISE EXCEPTION 'ownership.invalidInput' USING ERRCODE='22023';END IF;
  digest:=encode(sha256(convert_to(jsonb_build_array(operation,b-'requestId'-'locale')::text,'UTF8')),'hex');
  SELECT * INTO prior FROM school_ownership_requests WHERE actor_id=actor AND request_id=request;
  IF FOUND THEN
   IF prior.fingerprint IS DISTINCT FROM digest OR prior.action<>operation THEN RAISE EXCEPTION 'ownership.conflict' USING ERRCODE='23514';END IF;
   IF prior.claim_id IS NOT NULL THEN SELECT * INTO c FROM school_ownership_claims WHERE id=prior.claim_id;
    RETURN jsonb_build_object('claim',ownership_claim_json(c,operation='review')||CASE WHEN operation='review'THEN jsonb_build_object('canReview',false)ELSE '{}'::jsonb END,'replayed',true);
   END IF;
   SELECT * INTO o FROM school_ownership_offers WHERE id=prior.offer_id;
   RETURN jsonb_build_object('schoolId',s.id,'ownershipRevision',s.ownership_revision,'offer',ownership_offer_json(o),'replayed',true);
  END IF;
 END IF;
 IF operation IN('submit','transfer','reissue','cancel','accept')AND s.ownership_revision<>(b->>'ownershipRevision')::bigint THEN
  RAISE EXCEPTION 'ownership.conflict' USING ERRCODE='40001';END IF;
 IF operation IN('review','withdraw')AND c.revision<>(b->>'revision')::integer THEN RAISE EXCEPTION 'ownership.conflict' USING ERRCODE='40001';END IF;
 IF operation='submit'THEN
  IF NOT ownership_claimable(s)THEN RAISE EXCEPTION 'ownership.forbidden' USING ERRCODE='42501';END IF;
  INSERT INTO school_ownership_claims(environment,school_id,claimant_id,ownership_revision,statement)
  VALUES(environment_arg,target,actor,s.ownership_revision,b->>'statement')RETURNING * INTO c;
 ELSIF operation='withdraw'THEN
  IF c.status NOT IN('submitted','approved')THEN RAISE EXCEPTION 'ownership.conflict' USING ERRCODE='23514';END IF;
  UPDATE school_ownership_claims SET status='withdrawn',revision=revision+1,updated_at=clock_timestamp(),terminal_at=clock_timestamp()WHERE id=c.id RETURNING * INTO c;
  UPDATE school_ownership_offers SET status='cancelled',terminal_at=clock_timestamp()WHERE claim_id=c.id AND status='pending';
 ELSIF operation='review'THEN
  IF c.status<>'submitted' OR NOT ownership_claimable(s)OR s.ownership_revision<>c.ownership_revision OR NOT ownership_account_eligible(recipient)THEN
   RAISE EXCEPTION 'ownership.conflict' USING ERRCODE='23514';END IF;
  PERFORM ownership_expire_offers(target);
  UPDATE school_ownership_claims SET status=CASE WHEN b->>'decision'='approve'THEN 'approved' ELSE 'rejected' END,
   revision=revision+1,updated_at=clock_timestamp(),terminal_at=CASE WHEN b->>'decision'='reject'THEN clock_timestamp()END,
   reviewed_by=actor,reviewed_at=clock_timestamp(),decision_reason=b->>'reason',case_reference=b->>'caseReference'WHERE id=c.id RETURNING * INTO c;
 ELSIF operation IN('transfer','reissue')THEN
  SELECT * INTO u FROM users WHERE id=recipient;
  IF recipient IS NULL OR recipient=actor OR NOT ownership_account_eligible(recipient)
   OR(operation='transfer'AND lower(btrim(u.email))IS DISTINCT FROM b->>'recipientEmail')
   OR EXISTS(SELECT 1 FROM school_memberships WHERE school_id=target AND user_id=recipient AND status='suspended')THEN
   RAISE EXCEPTION 'ownership.recipientUnavailable' USING ERRCODE='23514';END IF;
  IF operation='reissue'AND(o.status NOT IN('pending','expired','superseded')OR o.issued_by<>actor)THEN
   RAISE EXCEPTION 'ownership.conflict' USING ERRCODE='23514';END IF;
  PERFORM ownership_expire_offers(target);
  IF operation='reissue'THEN UPDATE school_ownership_offers SET status='cancelled',terminal_at=clock_timestamp()WHERE id=o.id AND status='pending';END IF;
 ELSIF operation='cancel'THEN
  IF o.status IN('accepted','declined')THEN RAISE EXCEPTION 'ownership.conflict' USING ERRCODE='23514';END IF;
  UPDATE school_ownership_offers SET status='cancelled',terminal_at=COALESCE(terminal_at,clock_timestamp())WHERE id=o.id RETURNING * INTO o;
 ELSIF operation='decline'THEN
  IF o.id<>(b->>'offerId')::uuid THEN RAISE EXCEPTION 'ownership.conflict' USING ERRCODE='23514';END IF;
  UPDATE school_ownership_offers SET status='declined',terminal_at=clock_timestamp()WHERE id=o.id RETURNING * INTO o;
  UPDATE school_ownership_claims SET status='withdrawn',revision=revision+1,updated_at=clock_timestamp(),terminal_at=clock_timestamp()WHERE id=o.claim_id AND status='approved';
  PERFORM ownership_cancel_jobs(target);
  INSERT INTO school_access_events(school_id,actor_id,person_id,action,details)VALUES(target,actor,actor,'ownership_declined',jsonb_build_object('offerId',o.id));
  RETURN jsonb_build_object('status','declined','replayed',false);
 ELSIF operation IN('preview','accept')THEN
  SELECT * INTO member FROM school_memberships WHERE school_id=target AND user_id=actor;
  SELECT * INTO policy FROM school_onboarding_policy WHERE singleton FOR SHARE;
  SELECT * INTO doc FROM legal_documents WHERE document_id='mywaveplan.school-processing' AND version=policy.required_agreement_version
   AND language=CASE WHEN operation='preview'THEN b->>'locale' ELSE b->>'language' END AND status='published'
   AND environment=environment_arg AND effective_at<=clock_timestamp();
  IF operation='preview'THEN
   RETURN jsonb_build_object('offer',ownership_offer_json(o),'school',ownership_school_json(s),'account',jsonb_build_object('id',actor,'email',(SELECT email FROM users WHERE id=actor)),
    'consequences',jsonb_build_object('version','ownership-workspace/1','formerOwnerRoles',ownership_roles(s.owner_membership_id),
    'recipientRoles',CASE WHEN member.status='left'THEN '[]'::jsonb ELSE ownership_roles(member.id)END,'membershipWillBeCreated',member.id IS NULL,'membershipWillBeReactivated',member.status='left'),
    'agreement',CASE WHEN doc.document_id IS NOT NULL AND school_required_documents_ready()THEN jsonb_build_object('documentId',doc.document_id,'version',doc.version,
    'language',doc.language,'contentHash',doc.content_hash,'title',doc.title,'content',doc.content,'effectiveAt',doc.effective_at)END,
    'canAccept',doc.document_id IS NOT NULL AND school_required_documents_ready(),'completed',NULL);
  END IF;
  IF o.id<>(b->>'offerId')::uuid OR b->>'consequencesVersion' IS DISTINCT FROM 'ownership-workspace/1'OR b->'acceptedOwnership' IS DISTINCT FROM 'true'::jsonb
   OR b->'authorisedRepresentative' IS DISTINCT FROM 'true'::jsonb OR b->'acceptedAgreement' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'ownership.invalidInput' USING ERRCODE='22023';END IF;
  IF doc.document_id IS NULL OR NOT school_required_documents_ready()OR doc.document_id IS DISTINCT FROM b->>'documentId'OR doc.version IS DISTINCT FROM b->>'version'
   OR doc.content_hash IS DISTINCT FROM b->>'contentHash'THEN RAISE EXCEPTION 'ownership.agreementChanged' USING ERRCODE='23514';END IF;
  IF member.status='suspended'THEN RAISE EXCEPTION 'ownership.forbidden' USING ERRCODE='42501';END IF;
  IF member.status='left'THEN UPDATE membership_roles SET revoked_at=COALESCE(revoked_at,clock_timestamp())WHERE membership_id=member.id;END IF;
  INSERT INTO school_memberships(school_id,user_id,status,origin)VALUES(target,actor,'active','explicit')
   ON CONFLICT(school_id,user_id)DO UPDATE SET status='active',origin='explicit'RETURNING * INTO member;
  UPDATE schools SET owner_membership_id=member.id,updated_at=clock_timestamp()WHERE id=target RETURNING * INTO s;
  INSERT INTO legal_acceptances(user_id,document_id,version,language,content_hash,kind,school_id,membership_id)
   VALUES(actor,doc.document_id,doc.version,doc.language,doc.content_hash,'school_processing',target,member.id)ON CONFLICT DO NOTHING RETURNING id INTO canonical;
  IF canonical IS NULL THEN SELECT id INTO canonical FROM legal_acceptances WHERE user_id=actor AND school_id=target AND membership_id=member.id
   AND document_id=doc.document_id AND version=doc.version AND language=doc.language AND content_hash=doc.content_hash;END IF;
  IF canonical IS NULL THEN RAISE EXCEPTION 'ownership.agreementChanged' USING ERRCODE='23514';END IF;
  INSERT INTO school_ownership_acceptances(offer_id,school_id,user_id,membership_id,previous_owner_membership_id,ownership_revision,
   canonical_acceptance_id,document_id,version,language,content_hash,consequences_version,authorised_representative)
   VALUES(o.id,target,actor,member.id,o.source_owner_membership_id,s.ownership_revision,canonical,doc.document_id,doc.version,doc.language,doc.content_hash,'ownership-workspace/1',true)RETURNING id INTO acceptance;
  UPDATE school_ownership_offers SET status=CASE WHEN id=o.id THEN 'accepted' ELSE 'superseded'END,terminal_at=clock_timestamp()WHERE school_id=target AND status='pending';
  UPDATE school_ownership_claims SET status=CASE WHEN id=o.claim_id THEN 'completed' ELSE 'superseded'END,revision=revision+1,updated_at=clock_timestamp(),terminal_at=clock_timestamp()
   WHERE school_id=target AND status IN('submitted','approved');
  PERFORM ownership_cancel_jobs(target);
  job:=ownership_insert_mail(mail->'new',actor,'email.ownership_changed',environment_arg);
  INSERT INTO school_ownership_notice_jobs(job_id,acceptance_id,recipient_user_id,audience)VALUES(job,acceptance,actor,'new');
  IF o.source_owner_membership_id IS NOT NULL THEN
   SELECT user_id INTO owner_user FROM school_memberships WHERE id=o.source_owner_membership_id;
   job:=ownership_insert_mail(mail->'previous',owner_user,'email.ownership_changed',environment_arg);
   INSERT INTO school_ownership_notice_jobs(job_id,acceptance_id,recipient_user_id,audience)VALUES(job,acceptance,owner_user,'previous');
  END IF;
  INSERT INTO school_access_events(school_id,actor_id,person_id,action,details)VALUES(target,actor,actor,'ownership_accepted',
   jsonb_build_object('offerId',o.id,'acceptanceId',acceptance,'previousOwnerMembershipId',o.source_owner_membership_id,'ownerMembershipId',member.id,'ownershipRevision',s.ownership_revision));
  RETURN ownership_acceptance_result(o,actor,false);
 ELSE RAISE EXCEPTION 'ownership.invalidInput' USING ERRCODE='22023';
 END IF;
 -- Every preceding claim/offer mutation occurs before outbox locks/inserts.
 IF operation IN('transfer','reissue')OR(operation='review'AND b->>'decision'='approve')THEN
  IF EXISTS(SELECT 1 FROM school_ownership_offers WHERE school_id=target AND status='pending')THEN RAISE EXCEPTION 'ownership.conflict' USING ERRCODE='23514';END IF;
  SELECT * INTO u FROM users WHERE id=recipient;SELECT * INTO issuer FROM users WHERE id=actor;
  recipient_mail:=mail->'offer';offer_uuid:=gen_random_uuid();
  INSERT INTO school_ownership_offers(id,environment,kind,claim_id,school_id,issued_by,issuer_auth_version,source_owner_membership_id,ownership_revision,
   recipient_user_id,recipient_auth_version,recipient_email,token_hash,expires_at)
   VALUES(offer_uuid,environment_arg,CASE WHEN operation='review'THEN 'claim' ELSE 'transfer'END,CASE WHEN operation='review'THEN c.id END,
   target,actor,issuer.auth_version,s.owner_membership_id,s.ownership_revision,recipient,u.auth_version,lower(btrim(u.email)),recipient_mail->>'tokenHash',clock_timestamp()+interval '7 days')RETURNING * INTO o;
  IF o.token_hash IS NULL THEN RAISE EXCEPTION 'ownership.deliveryUnavailable' USING ERRCODE='23514';END IF;
  PERFORM ownership_cancel_jobs(target);
  job:=ownership_insert_mail(recipient_mail,recipient,'email.ownership_offer',environment_arg);
  UPDATE school_ownership_offers SET email_job_id=job WHERE id=o.id RETURNING * INTO o;
 ELSE PERFORM ownership_cancel_jobs(target);END IF;
 INSERT INTO school_ownership_requests(actor_id,request_id,action,fingerprint,school_id,claim_id,offer_id)
  VALUES(actor,request,operation,digest,target,CASE WHEN operation IN('submit','withdraw','review')THEN c.id END,o.id);
 INSERT INTO school_access_events(school_id,actor_id,person_id,action,details)VALUES(target,actor,recipient,'ownership_'||operation,
  jsonb_build_object('claimId',c.id,'offerId',o.id,'ownershipRevision',s.ownership_revision,'decision',CASE WHEN operation='review'THEN b->>'decision'END));
 IF operation IN('submit','withdraw','review')THEN
  RETURN jsonb_build_object('claim',ownership_claim_json(c,operation='review')||CASE WHEN operation='review'THEN jsonb_build_object('canReview',false)ELSE '{}'::jsonb END,'replayed',false);
 END IF;
 RETURN jsonb_build_object('schoolId',s.id,'ownershipRevision',s.ownership_revision,'offer',ownership_offer_json(o),'replayed',false);
END $$;

CREATE FUNCTION maintain_school_ownership(environment_arg text)RETURNS TABLE(expired integer,purged integer)LANGUAGE plpgsql AS $$
DECLARE target uuid;amount integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM job_environment WHERE singleton AND environment=environment_arg)THEN RAISE EXCEPTION 'Wrong environment' USING ERRCODE='22023';END IF;
 expired:=0;purged:=0;
 -- School-first maintenance never acquires user locks. It only terminalises expired offers.
 FOR target IN SELECT s.id FROM schools s WHERE EXISTS(SELECT 1 FROM school_ownership_offers o WHERE o.school_id=s.id AND o.status='pending'AND o.expires_at<=clock_timestamp())
 ORDER BY s.id LIMIT 50 FOR UPDATE OF s SKIP LOCKED LOOP
  UPDATE school_ownership_claims SET status='expired',terminal_at=clock_timestamp(),updated_at=clock_timestamp(),revision=revision+1 WHERE school_id=target AND status='approved'
   AND id IN(SELECT claim_id FROM school_ownership_offers WHERE school_id=target AND status='pending' AND expires_at<=clock_timestamp());
  UPDATE school_ownership_offers SET status='expired',terminal_at=expires_at WHERE school_id=target AND status='pending'AND expires_at<=clock_timestamp();
  GET DIAGNOSTICS amount=ROW_COUNT;expired:=expired+amount;PERFORM ownership_cancel_jobs(target);
 END LOOP;
 UPDATE school_ownership_claims SET statement=NULL,decision_reason=NULL,case_reference=NULL WHERE id IN(SELECT id FROM school_ownership_claims
  WHERE environment=environment_arg AND terminal_at<clock_timestamp()-interval '30 days'AND(statement IS NOT NULL OR decision_reason IS NOT NULL OR case_reference IS NOT NULL)
  ORDER BY terminal_at,id LIMIT 100 FOR UPDATE SKIP LOCKED);
 GET DIAGNOSTICS purged=ROW_COUNT;
 -- Token hashes and email snapshots are operational data, not retained legal evidence.
 UPDATE school_ownership_offers SET token_hash=NULL,recipient_email=NULL WHERE id IN(SELECT id FROM school_ownership_offers WHERE environment=environment_arg
  AND terminal_at<clock_timestamp()-interval '30 days'AND(token_hash IS NOT NULL OR recipient_email IS NOT NULL)ORDER BY terminal_at,id LIMIT 100 FOR UPDATE SKIP LOCKED);
 UPDATE school_ownership_requests r SET fingerprint=NULL WHERE r.fingerprint IS NOT NULL AND r.created_at<clock_timestamp()-interval '30 days'
 AND(EXISTS(SELECT 1 FROM school_ownership_claims c WHERE c.id=r.claim_id AND c.terminal_at<clock_timestamp()-interval '30 days')
 OR EXISTS(SELECT 1 FROM school_ownership_offers o WHERE o.id=r.offer_id AND o.terminal_at<clock_timestamp()-interval '30 days'));
 RETURN NEXT;
END $$;
