SELECT assert_membership_authority();
CREATE TABLE school_branding_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 details jsonb NOT NULL DEFAULT '{"accent":"sea","logoAssetId":null,"logoAlt":"","coverAssetId":null,"coverAlt":"","gallery":[]}',
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO school_branding_drafts(school_id) SELECT id FROM schools;
CREATE FUNCTION initialise_school_branding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO school_branding_drafts(school_id) VALUES(NEW.id);RETURN NEW;END $$;
CREATE TRIGGER school_branding_initialise AFTER INSERT ON schools FOR EACH ROW EXECUTE FUNCTION initialise_school_branding();
CREATE TABLE school_branding_versions (
 id uuid PRIMARY KEY,
 school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 version_number integer NOT NULL CHECK(version_number>0),
 source_revision integer NOT NULL,
 source_settings_revision integer NOT NULL,
 snapshot jsonb NOT NULL,
 published_by uuid NOT NULL REFERENCES users(id),
 published_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(school_id,id), UNIQUE(school_id,version_number)
);
CREATE FUNCTION school_branding_version_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Publish a new branding version instead' USING ERRCODE='23514';END $$;
CREATE TRIGGER school_branding_versions_immutable BEFORE UPDATE ON school_branding_versions
 FOR EACH ROW EXECUTE FUNCTION school_branding_version_immutable();
ALTER TABLE schools ADD COLUMN published_branding_version_id uuid;
ALTER TABLE schools ADD CONSTRAINT school_published_branding_owner
 FOREIGN KEY(id,published_branding_version_id) REFERENCES school_branding_versions(school_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE school_publication_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES users(id), request_id uuid NOT NULL,
 source_revision integer NOT NULL, source_settings_revision integer NOT NULL,
 fingerprint text NOT NULL, snapshot jsonb NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','published','failed')),
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 UNIQUE(actor_id,request_id)
);
CREATE TABLE school_branding_version_pins (
 version_id uuid NOT NULL REFERENCES school_branding_versions(id),
 reference_id uuid NOT NULL, expires_at timestamptz,
 PRIMARY KEY(version_id,reference_id)
);
COMMENT ON TABLE school_branding_version_pins IS 'Exact immutable branding-version retention for future C4 retries. No live email jobs are created by B5.';

CREATE FUNCTION school_branding_edit_allowed(actor uuid,target uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT account_edits_school_settings(actor,target)
 AND (target<>'7abd47ea-705a-4a75-ad90-274c32c14f95'::uuid OR account_is_platform(actor))
$$;
CREATE FUNCTION lock_school_branding_actor(actor uuid,target uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM assert_membership_authority();
 PERFORM 1 FROM users WHERE id=actor FOR UPDATE;
 PERFORM 1 FROM schools WHERE id=target FOR UPDATE;
 PERFORM 1 FROM school_memberships WHERE school_id=target AND user_id=actor FOR UPDATE;
 IF NOT school_branding_edit_allowed(actor,target) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
END $$;
CREATE FUNCTION school_branding_asset_ids(details jsonb) RETURNS uuid[] LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE(array_agg(DISTINCT id ORDER BY id),ARRAY[]::uuid[]) FROM (
 SELECT NULLIF(details->>'logoAssetId','')::uuid AS id UNION ALL
 SELECT NULLIF(details->>'coverAssetId','')::uuid UNION ALL
 SELECT (item->>'assetId')::uuid FROM jsonb_array_elements(details->'gallery') item
 ) q WHERE id IS NOT NULL
$$;
CREATE FUNCTION validate_school_branding(target uuid,details jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE item jsonb; field text; asset uuid; purpose_arg text; assets uuid[];
BEGIN
 IF details IS NULL OR jsonb_typeof(details)<>'object'
 OR (details-ARRAY['accent','logoAssetId','logoAlt','coverAssetId','coverAlt','gallery'])<>'{}'::jsonb
 OR NOT details ?& ARRAY['accent','logoAssetId','logoAlt','coverAssetId','coverAlt','gallery']
 OR jsonb_typeof(details->'accent')<>'string' OR details->>'accent' NOT IN ('sea','atlantic','forest','clay')
 OR jsonb_typeof(details->'gallery')<>'array' OR jsonb_array_length(details->'gallery')>6 THEN
 RAISE EXCEPTION 'Invalid branding' USING ERRCODE='22023';END IF;
 FOREACH field IN ARRAY ARRAY['logoAlt','coverAlt'] LOOP
  IF jsonb_typeof(details->field)<>'string' OR length(details->>field)>300 OR (details->>field)~'[[:cntrl:]]' THEN
   RAISE EXCEPTION 'Invalid alternative text' USING ERRCODE='22023';END IF;
 END LOOP;
 FOREACH purpose_arg IN ARRAY ARRAY['logo','cover'] LOOP
  field:=purpose_arg||'AssetId';
  IF jsonb_typeof(details->field) NOT IN ('null','string') THEN RAISE EXCEPTION 'Invalid asset' USING ERRCODE='22023';END IF;
  IF jsonb_typeof(details->field)='string' THEN
   asset:=(details->>field)::uuid;
   PERFORM 1 FROM media_assets WHERE id=asset AND owner_school_id=target AND purpose=purpose_arg AND state='ready' FOR UPDATE;
   IF NOT FOUND OR length(btrim(details->>(purpose_arg||'Alt')))=0 THEN RAISE EXCEPTION 'Invalid owned image' USING ERRCODE='22023';END IF;
  END IF;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(details->'gallery') LOOP
  IF jsonb_typeof(item)<>'object' OR (item-ARRAY['assetId','alt'])<>'{}'::jsonb
  OR NOT item ?& ARRAY['assetId','alt'] OR jsonb_typeof(item->'assetId')<>'string'
  OR jsonb_typeof(item->'alt')<>'string' OR length(btrim(item->>'alt')) NOT BETWEEN 1 AND 300
  OR (item->>'alt')~'[[:cntrl:]]' THEN RAISE EXCEPTION 'Invalid gallery' USING ERRCODE='22023';END IF;
  asset:=(item->>'assetId')::uuid;
  PERFORM 1 FROM media_assets WHERE id=asset AND owner_school_id=target AND purpose='gallery' AND state='ready' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid owned gallery image' USING ERRCODE='22023';END IF;
 END LOOP;
 assets:=school_branding_asset_ids(details);
 IF cardinality(assets)<>(CASE WHEN details->>'logoAssetId' IS NULL THEN 0 ELSE 1 END+
 CASE WHEN details->>'coverAssetId' IS NULL THEN 0 ELSE 1 END+jsonb_array_length(details->'gallery')) THEN
 RAISE EXCEPTION 'Duplicate image' USING ERRCODE='22023';END IF;
END $$;

CREATE FUNCTION school_public_snapshot(target uuid,details jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('schoolId',s.id,'name',s.name,'slug',s.slug,'description',s.description,
 'timezone',s.timezone,'contactEmail',COALESCE(s.contact_email,''),'contactPhone',s.contact_phone,
 'website',s.website,'socialLinks',s.social_links,'branding',details,
 'demo',s.id='7abd47ea-705a-4a75-ad90-274c32c14f95'::uuid,
 'baseLocation',CASE WHEN (school_settings_json(s,NULL)->'baseLocation'->>'hasFixedBase')::boolean
 AND (school_settings_json(s,NULL)->'baseLocation'->>'publicVisible')::boolean
 THEN school_settings_json(s,NULL)->'baseLocation' ELSE NULL END,
 'operatingSpots',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',sp.id,'name',sp.name,'timezone',sp.timezone) ORDER BY sp.name,sp.id)
 FROM school_operating_spots os JOIN surf_spots sp ON sp.id=os.spot_id WHERE os.school_id=s.id),'[]'::jsonb))
 FROM schools s WHERE s.id=target
$$;
CREATE FUNCTION school_branding_json(target uuid,actor uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('schoolId',d.school_id,'draftId',d.id,'revision',d.revision,'settingsRevision',s.settings_revision,
 'details',d.details,'preview',school_public_snapshot(target,d.details),
 'canEdit',school_branding_edit_allowed(actor,target),'publishedVersionId',s.published_branding_version_id,
 'publishedVersion',(SELECT version_number FROM school_branding_versions WHERE id=s.published_branding_version_id),
 'publishedSourceRevision',(SELECT source_revision FROM school_branding_versions WHERE id=s.published_branding_version_id),
 'publishedSettingsRevision',(SELECT source_settings_revision FROM school_branding_versions WHERE id=s.published_branding_version_id))
 FROM school_branding_drafts d JOIN schools s ON s.id=d.school_id WHERE d.school_id=target
$$;
CREATE FUNCTION save_school_branding(actor uuid,target uuid,expected_revision integer,settings_revision_arg integer,details_arg jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE draft school_branding_drafts;
BEGIN
 PERFORM lock_school_branding_actor(actor,target);
 SELECT * INTO draft FROM school_branding_drafts WHERE school_id=target FOR UPDATE;
 IF expected_revision IS NULL OR draft.revision<>expected_revision OR NOT EXISTS(
 SELECT 1 FROM schools WHERE id=target AND settings_revision=settings_revision_arg) THEN
 RAISE EXCEPTION 'Draft changed' USING ERRCODE='40001';END IF;
 PERFORM validate_school_branding(target,details_arg);
 INSERT INTO media_asset_references(asset_id,owner_kind,owner_id,kind,reference_id)
 SELECT unnest(school_branding_asset_ids(details_arg)),'school',target,'school_draft',draft.id ON CONFLICT DO NOTHING;
 DELETE FROM media_asset_references WHERE kind='school_draft' AND reference_id=draft.id
 AND NOT asset_id=ANY(school_branding_asset_ids(details_arg));
 UPDATE school_branding_drafts SET details=details_arg,revision=revision+1,updated_at=now() WHERE id=draft.id;
 INSERT INTO school_access_events(school_id,actor_id,action) VALUES(target,actor,'branding_draft_saved');
 RETURN school_branding_json(target,actor);
END $$;

CREATE FUNCTION begin_school_publication(actor uuid,target uuid,expected_revision integer,settings_revision_arg integer,request uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE draft school_branding_drafts; intent school_publication_intents; digest text;
BEGIN
 PERFORM lock_school_branding_actor(actor,target);
 IF request IS NULL OR expected_revision IS NULL OR settings_revision_arg IS NULL THEN RAISE EXCEPTION 'Invalid publication request' USING ERRCODE='22023';END IF;
 digest:=encode(sha256(convert_to(jsonb_build_array(target,expected_revision,settings_revision_arg)::text,'UTF8')),'hex');
 SELECT * INTO intent FROM school_publication_intents WHERE actor_id=actor AND request_id=request FOR UPDATE;
 IF FOUND THEN
  IF intent.fingerprint<>digest OR intent.state='failed' THEN RAISE EXCEPTION 'Publication request changed' USING ERRCODE='23514';END IF;
  RETURN to_jsonb(intent);
 END IF;
 SELECT * INTO draft FROM school_branding_drafts WHERE school_id=target FOR UPDATE;
 IF draft.revision<>expected_revision OR NOT EXISTS(SELECT 1 FROM schools WHERE id=target AND settings_revision=settings_revision_arg) THEN
 RAISE EXCEPTION 'Draft changed' USING ERRCODE='40001';END IF;
 PERFORM validate_school_branding(target,draft.details);
 INSERT INTO school_publication_intents(school_id,actor_id,request_id,source_revision,source_settings_revision,fingerprint,snapshot)
 VALUES(target,actor,request,draft.revision,settings_revision_arg,digest,school_public_snapshot(target,draft.details)) RETURNING * INTO intent;
 INSERT INTO media_asset_references(asset_id,owner_kind,owner_id,kind,reference_id)
 SELECT unnest(school_branding_asset_ids(draft.details)),'school',target,'publish_intent',intent.id;
 RETURN to_jsonb(intent);
END $$;

CREATE FUNCTION finish_school_publication(actor uuid,publication uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE intent school_publication_intents; target uuid; asset uuid; number integer; objects jsonb;
BEGIN
 SELECT school_id INTO target FROM school_publication_intents WHERE id=publication AND actor_id=actor;
 IF target IS NULL THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 PERFORM lock_school_branding_actor(actor,target);
 SELECT * INTO intent FROM school_publication_intents WHERE id=publication FOR UPDATE;
 IF intent.state='published' THEN RETURN school_branding_json(target,actor);END IF;
 IF intent.state<>'pending' OR NOT EXISTS(SELECT 1 FROM schools s JOIN school_branding_drafts d ON d.school_id=s.id
 WHERE s.id=target AND s.settings_revision=intent.source_settings_revision AND d.revision=intent.source_revision) THEN
 RAISE EXCEPTION 'Publication changed' USING ERRCODE='40001';END IF;
 PERFORM validate_school_branding(target,intent.snapshot->'branding');
 FOREACH asset IN ARRAY school_branding_asset_ids(intent.snapshot->'branding') LOOP
  IF NOT EXISTS(SELECT 1 FROM media_asset_references WHERE asset_id=asset AND kind='publish_intent' AND reference_id=publication)
  OR (SELECT count(*) FROM media_objects o WHERE o.asset_id=asset AND o.publication_id=publication
   AND o.access='public' AND o.state='written' AND o.role<>'master')<>2 THEN
   RAISE EXCEPTION 'Published derivatives not ready' USING ERRCODE='23514';END IF;
 END LOOP;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('objectId',o.id,'assetId',o.asset_id,'role',o.role) ORDER BY o.asset_id,o.role),'[]'::jsonb)
 INTO objects FROM media_objects o WHERE o.publication_id=publication AND o.access='public' AND o.state='written';
 SELECT COALESCE(max(version_number),0)+1 INTO number FROM school_branding_versions WHERE school_id=target;
 INSERT INTO school_branding_versions(id,school_id,version_number,source_revision,source_settings_revision,snapshot,published_by)
 VALUES(publication,target,number,intent.source_revision,intent.source_settings_revision,intent.snapshot||jsonb_build_object('objects',objects),actor);
 INSERT INTO media_asset_references(asset_id,owner_kind,owner_id,kind,reference_id)
 SELECT unnest(school_branding_asset_ids(intent.snapshot->'branding')),'school',target,'school_publication',publication;
 UPDATE schools SET published_branding_version_id=publication,listing_status='published',updated_at=now() WHERE id=target;
 UPDATE school_publication_intents SET state='published',finished_at=now() WHERE id=publication;
 DELETE FROM media_asset_references WHERE kind='publish_intent' AND reference_id=publication;
 INSERT INTO school_access_events(school_id,actor_id,action,details) VALUES(target,actor,'branding_published',jsonb_build_object('versionId',publication,'version',number));
 RETURN school_branding_json(target,actor);
END $$;

CREATE FUNCTION abort_school_publication(actor uuid,publication uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE intent school_publication_intents; object_id uuid;
BEGIN
 SELECT * INTO intent FROM school_publication_intents WHERE id=publication AND actor_id=actor FOR UPDATE;
 IF NOT FOUND OR intent.state<>'pending' THEN RETURN;END IF;
 -- Compensation must survive revocation; it only withdraws this actor's pending intent.
 UPDATE school_publication_intents SET state='failed',finished_at=now() WHERE id=publication;
 DELETE FROM media_asset_references WHERE kind='publish_intent' AND reference_id=publication;
 FOR object_id IN SELECT id FROM media_objects WHERE publication_id=publication AND access='public' LOOP
  PERFORM queue_media_object_cleanup(object_id,'failed_publication');
 END LOOP;
END $$;
