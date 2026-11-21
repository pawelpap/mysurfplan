-- Optional explicit server-side lookup. Disabled until exact legal/provider review.
SELECT assert_membership_authority();
CREATE TABLE school_geocoding_policy (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false,
 provider_reviewed_at timestamptz,
 required_agreement_version text,
 required_privacy_version text,
 CHECK(NOT enabled OR (provider_reviewed_at IS NOT NULL AND required_agreement_version IS NOT NULL AND required_privacy_version IS NOT NULL))
);
INSERT INTO school_geocoding_policy(singleton) VALUES(true);
CREATE TABLE school_geocoding_budget (
 scope text NOT NULL CHECK(scope IN ('global','actor','school')),
 subject uuid NOT NULL,
 bucket timestamptz NOT NULL,
 used integer NOT NULL CHECK(used>0),
 PRIMARY KEY(scope,subject,bucket)
);
CREATE TABLE school_geocoding_dispatch (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 last_dispatch_at timestamptz
);
INSERT INTO school_geocoding_dispatch(singleton) VALUES(true);

CREATE FUNCTION reserve_school_address_lookup(actor uuid,target uuid,expected_environment text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE policy school_geocoding_policy; actual_environment text; instant timestamptz;
 day_bucket timestamptz; hour_bucket timestamptz; cap integer;
 global_id constant uuid:='00000000-0000-0000-0000-000000000000';
BEGIN
 PERFORM assert_membership_authority();
 PERFORM 1 FROM users WHERE id=actor FOR UPDATE;
 PERFORM 1 FROM schools WHERE id=target FOR UPDATE;
 PERFORM 1 FROM school_memberships WHERE school_id=target AND user_id=actor FOR UPDATE;
 IF NOT account_edits_school_settings(actor,target) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT j.environment INTO actual_environment FROM job_environment j WHERE singleton;
 IF actual_environment NOT IN ('staging','production') OR actual_environment IS DISTINCT FROM expected_environment THEN
  RAISE EXCEPTION 'Environment mismatch' USING ERRCODE='42501'; END IF;
 -- Serialise reservations across all replicas/deployments of this environment.
 SELECT * INTO policy FROM school_geocoding_policy WHERE singleton FOR UPDATE;
 IF NOT policy.enabled OR policy.provider_reviewed_at IS NULL OR policy.required_privacy_version IS NULL
 OR (SELECT count(DISTINCT d.language) FROM legal_documents d
  WHERE d.document_id='mywaveplan.privacy' AND d.version=policy.required_privacy_version
  AND d.status='published' AND d.environment=actual_environment AND d.effective_at<=clock_timestamp()
  AND d.language IN ('en-GB','pt-PT','es','fr'))<>4
 OR (SELECT count(DISTINCT d.language) FROM legal_documents d
  WHERE d.document_id='mywaveplan.school-processing' AND d.version=policy.required_agreement_version
  AND d.status='published' AND d.environment=actual_environment AND d.effective_at<=clock_timestamp()
  AND d.language IN ('en-GB','pt-PT','es','fr'))<>4
 OR NOT EXISTS(
  SELECT 1 FROM legal_acceptances a JOIN legal_documents d USING(document_id,version,language,content_hash)
  WHERE a.user_id=actor AND a.school_id=target AND a.document_id='mywaveplan.school-processing'
  AND a.version=policy.required_agreement_version AND d.status='published'
  AND d.environment=actual_environment AND d.effective_at<=clock_timestamp()
  AND EXISTS(SELECT 1 FROM school_memberships m JOIN schools s ON s.id=m.school_id
   WHERE m.id=a.membership_id AND m.user_id=actor AND m.school_id=target AND m.status='active'
   AND (s.owner_membership_id=m.id OR EXISTS(SELECT 1 FROM membership_roles r
    WHERE r.membership_id=m.id AND r.role='school_admin' AND r.revoked_at IS NULL)))) THEN
  RETURN jsonb_build_object('allowed',false,'reason','not_ready'); END IF;
 instant:=clock_timestamp();
 day_bucket:=date_trunc('day',instant AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 hour_bucket:=date_trunc('hour',instant AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 -- Combined application allowance <=2,000/day. Reservations are spaced by 1s;
 -- this is not a guarantee about upstream arrival times after network delays.
 cap:=CASE WHEN actual_environment='staging' THEN 200 ELSE 1800 END;
 IF EXISTS(SELECT 1 FROM school_geocoding_dispatch WHERE singleton AND last_dispatch_at>instant-interval '1 second')
 OR EXISTS(SELECT 1 FROM school_geocoding_budget WHERE scope='global' AND subject=global_id AND bucket=day_bucket AND used>=cap)
 OR EXISTS(SELECT 1 FROM school_geocoding_budget WHERE scope='actor' AND subject=actor AND bucket=hour_bucket AND used>=20)
 OR EXISTS(SELECT 1 FROM school_geocoding_budget WHERE scope='school' AND subject=target AND bucket=day_bucket AND used>=50) THEN
  RETURN jsonb_build_object('allowed',false,'reason','limited'); END IF;
 INSERT INTO school_geocoding_budget(scope,subject,bucket,used) VALUES
 ('global',global_id,day_bucket,1),('actor',actor,hour_bucket,1),('school',target,day_bucket,1)
 ON CONFLICT(scope,subject,bucket) DO UPDATE SET used=school_geocoding_budget.used+1;
 UPDATE school_geocoding_dispatch SET last_dispatch_at=instant WHERE singleton;
 -- No addresses/results are cached. Counters are removed opportunistically.
 DELETE FROM school_geocoding_budget WHERE bucket<day_bucket-interval '2 days';
 RETURN jsonb_build_object('allowed',true);
END $$;
COMMENT ON TABLE school_geocoding_policy IS 'Disabled by default. Enable only with applicable provider DPA and exact translated published school-provider authorisation; no public configuration API.';
COMMENT ON TABLE school_geocoding_budget IS 'Counts only, never addresses/results/keys. UTC buckets, old rows cleaned on allowed requests; no guaranteed no-traffic purge. Exact QA subjects removed at closeout.';
