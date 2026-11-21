SELECT assert_membership_authority();
CREATE TABLE school_onboarding_policy(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),ready boolean NOT NULL DEFAULT false,
 required_agreement_version text,required_privacy_version text,
 CHECK(NOT ready OR(required_agreement_version IS NOT NULL AND required_privacy_version IS NOT NULL))
);
INSERT INTO school_onboarding_policy(singleton)VALUES(true);
CREATE TABLE school_pilot_approvals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL UNIQUE REFERENCES schools(id),
 approved_by uuid NOT NULL REFERENCES users(id),owner_user_id uuid NOT NULL REFERENCES users(id),
 owner_membership_id uuid NOT NULL,acceptance_id uuid NOT NULL REFERENCES legal_acceptances(id),
 settings_revision integer NOT NULL,request_id uuid NOT NULL,fingerprint text NOT NULL,
 document_id text NOT NULL,version text NOT NULL,language text NOT NULL,content_hash text NOT NULL,
 approved_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(approved_by,request_id),FOREIGN KEY(school_id,owner_membership_id)REFERENCES school_memberships(school_id,id),
 FOREIGN KEY(document_id,version,language,content_hash)REFERENCES legal_documents(document_id,version,language,content_hash)
);
CREATE FUNCTION school_required_documents_ready()RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT p.ready AND (SELECT count(DISTINCT d.language)FROM legal_documents d
 WHERE d.document_id='mywaveplan.school-processing' AND d.version=p.required_agreement_version
 AND d.status='published' AND d.effective_at<=now() AND d.environment=j.environment)=4
 AND (SELECT count(DISTINCT d.language)FROM legal_documents d WHERE d.document_id='mywaveplan.privacy'
 AND d.version=p.required_privacy_version AND d.status='published' AND d.effective_at<=now() AND d.environment=j.environment)=4
 FROM school_onboarding_policy p CROSS JOIN job_environment j WHERE p.singleton AND j.singleton
$$;
CREATE FUNCTION school_pilot_review(target uuid,actor uuid)RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('schoolId',s.id,'status',s.pilot_access_status,'workspaceStatus',s.workspace_status,
 'settingsRevision',s.settings_revision,'agreementVersion',p.required_agreement_version,
 'legalReady',school_required_documents_ready(),'agreementAccepted',a.id IS NOT NULL,
 'detailsReady',btrim(s.description)<>'' AND(COALESCE(s.contact_email,'')<>'' OR s.contact_phone<>'') AND
 EXISTS(SELECT 1 FROM school_operating_spots os JOIN surf_spots sp ON sp.id=os.spot_id WHERE os.school_id=s.id AND sp.active),
 'canApprove',account_is_platform(actor) AND m.user_id IS DISTINCT FROM actor AND
 EXISTS(SELECT 1 FROM users WHERE id=actor AND email_verified_at IS NOT NULL AND deleted_at IS NULL AND disabled_at IS NULL AND NOT is_demo),
 'acceptanceId',CASE WHEN account_is_platform(actor)THEN a.id ELSE NULL END,
 'acceptedAt',a.accepted_at,'agreementLanguage',a.language)
 FROM schools s CROSS JOIN school_onboarding_policy p
 LEFT JOIN school_memberships m ON m.id=s.owner_membership_id AND m.school_id=s.id AND m.status='active'
 LEFT JOIN LATERAL(SELECT a.* FROM legal_acceptances a JOIN legal_documents d USING(document_id,version,language,content_hash)
 WHERE a.user_id=m.user_id AND a.membership_id=m.id AND a.school_id=s.id AND a.document_id='mywaveplan.school-processing'
 AND a.version=p.required_agreement_version AND d.status='published' AND d.effective_at<=now()
 AND d.environment=(SELECT environment FROM job_environment WHERE singleton) ORDER BY a.accepted_at DESC LIMIT 1)a ON true
 WHERE s.id=target AND p.singleton AND account_reads_school_settings(actor,target)
$$;
CREATE FUNCTION approve_school_pilot(actor uuid,target uuid,revision integer,evidence uuid,request uuid,
 verified_hash text,verified_epoch integer,session_hash text)RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE owner_user uuid;owner_member uuid;school schools;acceptance legal_acceptances;policy school_onboarding_policy;
 prior school_pilot_approvals;digest text;approval uuid;
BEGIN
 PERFORM assert_membership_authority();
 SELECT m.user_id INTO owner_user FROM schools s JOIN school_memberships m ON m.id=s.owner_membership_id AND m.school_id=s.id WHERE s.id=target;
 PERFORM 1 FROM users WHERE id IN(actor,owner_user)ORDER BY id FOR UPDATE;
 PERFORM 1 FROM schools WHERE id=target FOR UPDATE;
 SELECT * INTO school FROM schools WHERE id=target;
 IF NOT FOUND OR NOT account_is_platform(actor) OR actor=owner_user OR NOT EXISTS(
 SELECT 1 FROM users WHERE id=actor AND password_hash=verified_hash AND auth_version=verified_epoch
 AND deleted_at IS NULL AND disabled_at IS NULL AND self_closed_at IS NULL AND NOT is_demo AND email_verified_at IS NOT NULL)THEN
 RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM auth_sessions WHERE token_hash=session_hash AND user_id=actor AND auth_version=verified_epoch
 AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Session changed' USING ERRCODE='42501';END IF;
 IF request IS NULL OR evidence IS NULL OR revision IS NULL THEN RAISE EXCEPTION 'Invalid approval' USING ERRCODE='22023';END IF;
 digest:=encode(sha256(convert_to(jsonb_build_array(target,revision,evidence)::text,'UTF8')),'hex');
 SELECT * INTO prior FROM school_pilot_approvals WHERE approved_by=actor AND request_id=request;
 IF FOUND THEN
  IF prior.fingerprint<>digest THEN RAISE EXCEPTION 'Approval request changed' USING ERRCODE='23514';END IF;
  RETURN jsonb_build_object('approvalId',prior.id,'school',school_settings_json(school,actor),'replayed',true);
 END IF;
 IF school.workspace_kind<>'self_service' OR school.deleted_at IS NOT NULL OR school.workspace_status NOT IN('draft','active')
 OR school.settings_revision<>revision OR school.pilot_access_status<>'pending' THEN RAISE EXCEPTION 'School changed' USING ERRCODE='40001';END IF;
 SELECT id INTO owner_member FROM school_memberships WHERE id=school.owner_membership_id AND school_id=target AND user_id=owner_user AND status='active' FOR UPDATE;
 IF owner_member IS NULL OR NOT EXISTS(SELECT 1 FROM users WHERE id=owner_user AND deleted_at IS NULL AND disabled_at IS NULL
 AND self_closed_at IS NULL AND NOT is_demo AND email_verified_at IS NOT NULL)THEN RAISE EXCEPTION 'Owner changed' USING ERRCODE='42501';END IF;
 SELECT * INTO policy FROM school_onboarding_policy WHERE singleton FOR SHARE;
 IF NOT school_required_documents_ready()THEN RAISE EXCEPTION 'Published documents required' USING ERRCODE='23514';END IF;
 SELECT a.* INTO acceptance FROM legal_acceptances a JOIN legal_documents d USING(document_id,version,language,content_hash)
 WHERE a.id=evidence AND a.user_id=owner_user AND a.membership_id=owner_member AND a.school_id=target
 AND a.document_id='mywaveplan.school-processing' AND a.version=policy.required_agreement_version
 AND d.status='published' AND d.effective_at<=clock_timestamp() AND d.environment=(SELECT environment FROM job_environment WHERE singleton);
 IF NOT FOUND THEN RAISE EXCEPTION 'Exact owner agreement required' USING ERRCODE='23514';END IF;
 IF btrim(school.description)='' OR(COALESCE(school.contact_email,'')='' AND school.contact_phone='')OR NOT EXISTS(
 SELECT 1 FROM school_operating_spots os JOIN surf_spots sp ON sp.id=os.spot_id WHERE os.school_id=target AND sp.active)THEN
 RAISE EXCEPTION 'Complete school details first' USING ERRCODE='23514';END IF;
 INSERT INTO school_pilot_approvals(school_id,approved_by,owner_user_id,owner_membership_id,acceptance_id,settings_revision,
 request_id,fingerprint,document_id,version,language,content_hash)
 VALUES(target,actor,owner_user,owner_member,evidence,revision,request,digest,acceptance.document_id,acceptance.version,acceptance.language,acceptance.content_hash)RETURNING id INTO approval;
 UPDATE schools SET pilot_access_status='approved',workspace_status='active',updated_at=now()WHERE id=target RETURNING * INTO school;
 INSERT INTO school_access_events(school_id,actor_id,person_id,action,details)VALUES(target,actor,owner_user,'pilot_approved',jsonb_build_object('approvalId',approval,'acceptanceId',evidence));
 RETURN jsonb_build_object('approvalId',approval,'school',school_settings_json(school,actor),'replayed',false);
END $$;
