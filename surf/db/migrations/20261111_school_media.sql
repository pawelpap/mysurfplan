-- B7: private media ownership, bounded reservations and exact-object cleanup.
SELECT assert_membership_authority();
CREATE TABLE media_storage_config (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 environment text NOT NULL REFERENCES job_environment(environment),
 private_store_id text, public_store_id text,
 CHECK(private_store_id IS NULL OR private_store_id ~ '^store_[A-Za-z0-9]+$'),
 CHECK(public_store_id IS NULL OR public_store_id ~ '^store_[A-Za-z0-9]+$'),
 CHECK(private_store_id IS NULL OR public_store_id IS NULL OR private_store_id<>public_store_id)
);
INSERT INTO media_storage_config(singleton,environment,private_store_id,public_store_id)
 SELECT true,environment,CASE WHEN environment='staging' THEN 'store_u6aKFjGejriy7AVL' END,
 CASE WHEN environment='staging' THEN 'store_XyK8KhFlbMPHDAmZ' END FROM job_environment WHERE singleton;
CREATE TABLE media_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_user_id uuid REFERENCES users(id), owner_school_id uuid REFERENCES schools(id),
 owner_kind text GENERATED ALWAYS AS (CASE WHEN owner_user_id IS NOT NULL THEN 'user' ELSE 'school' END) STORED,
 owner_id uuid GENERATED ALWAYS AS (COALESCE(owner_user_id,owner_school_id)) STORED,
 uploaded_by uuid NOT NULL REFERENCES users(id), environment text NOT NULL REFERENCES job_environment(environment),
 purpose text NOT NULL CHECK(purpose IN ('profile','logo','cover','gallery')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready','deleting','deleted')),
 request_id uuid NOT NULL, fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 source_hash text NOT NULL CHECK(source_hash ~ '^[0-9a-f]{64}$'),
 source_width integer,source_height integer,
 reserved_bytes bigint NOT NULL DEFAULT 16777216 CHECK(reserved_bytes BETWEEN 0 AND 16777216),
 byte_count bigint NOT NULL DEFAULT 0 CHECK(byte_count BETWEEN 0 AND 16777216),
 expected_revision integer, expires_at timestamptz DEFAULT now()+interval '15 minutes',
 created_at timestamptz NOT NULL DEFAULT now(),ready_at timestamptz,
 CHECK((owner_user_id IS NOT NULL)::int+(owner_school_id IS NOT NULL)::int=1),
 CHECK((purpose='profile' AND owner_user_id IS NOT NULL) OR (purpose<>'profile' AND owner_school_id IS NOT NULL)),
 UNIQUE(uploaded_by,request_id),UNIQUE(id,owner_kind,owner_id),UNIQUE(owner_user_id,id)
);
CREATE INDEX media_assets_owner ON media_assets(owner_kind,owner_id,state);
ALTER TABLE users ADD COLUMN photo_mode text NOT NULL DEFAULT 'legacy' CHECK(photo_mode IN ('legacy','uploaded','none')),
 ADD COLUMN photo_asset_id uuid, ADD COLUMN photo_revision integer NOT NULL DEFAULT 1 CHECK(photo_revision>0),
 ADD CONSTRAINT personal_photo_asset FOREIGN KEY(id,photo_asset_id) REFERENCES media_assets(owner_user_id,id),
 ADD CONSTRAINT personal_photo_mode CHECK((photo_mode='uploaded')=(photo_asset_id IS NOT NULL));
CREATE TABLE media_asset_references (
 asset_id uuid NOT NULL,owner_kind text NOT NULL,owner_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('profile','school_draft','school_publication','email_pin','publish_intent')),
 reference_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(asset_id,kind,reference_id),
 FOREIGN KEY(asset_id,owner_kind,owner_id) REFERENCES media_assets(id,owner_kind,owner_id),
 CHECK((kind='profile' AND owner_kind='user') OR (kind<>'profile' AND owner_kind='school'))
);
CREATE FUNCTION guard_media_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM media_assets WHERE id=NEW.asset_id AND state='ready' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Media is unavailable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER media_reference_ready BEFORE INSERT OR UPDATE ON media_asset_references
 FOR EACH ROW EXECUTE FUNCTION guard_media_reference();
CREATE TABLE media_objects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),asset_id uuid NOT NULL REFERENCES media_assets(id),
 access text NOT NULL CHECK(access IN ('private','public')),publication_id uuid,
 role text NOT NULL CHECK(role IN ('master','w128','w384','w512','w600','w800','w1200','w1600')),
 store_id text NOT NULL,pathname text NOT NULL UNIQUE,
 byte_count bigint NOT NULL CHECK(byte_count BETWEEN 1 AND 16777216),
 checksum text NOT NULL CHECK(checksum ~ '^[0-9a-f]{64}$'),
 width integer NOT NULL CHECK(width BETWEEN 1 AND 2560),height integer NOT NULL CHECK(height BETWEEN 1 AND 2560),
 state text NOT NULL DEFAULT 'planned' CHECK(state IN ('planned','written','deleting','deleted')),
 created_at timestamptz NOT NULL DEFAULT now(),written_at timestamptz,
 CHECK((access='private' AND publication_id IS NULL) OR (access='public' AND publication_id IS NOT NULL AND role<>'master')),
 UNIQUE NULLS NOT DISTINCT(asset_id,access,publication_id,role)
);
CREATE TABLE media_asset_cleanup (
 asset_id uuid PRIMARY KEY REFERENCES media_assets(id),not_before timestamptz NOT NULL,
 reason text NOT NULL CHECK(length(reason)<=80)
);
CREATE TABLE media_cleanup_queue (
 object_id uuid PRIMARY KEY REFERENCES media_objects(id),not_before timestamptz NOT NULL DEFAULT now(),
 reason text NOT NULL CHECK(length(reason)<=80),lease_id uuid,lease_until timestamptz,
 attempts integer NOT NULL DEFAULT 0,completed_at timestamptz
);

CREATE FUNCTION media_lock_actor(actor uuid,school uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM assert_membership_authority();
 PERFORM 1 FROM users WHERE id=actor FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND deleted_at IS NULL AND disabled_at IS NULL
  AND self_closed_at IS NULL AND NOT is_demo AND email_verified_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Verified account required' USING ERRCODE='42501'; END IF;
 IF school IS NOT NULL THEN
  PERFORM 1 FROM schools WHERE id=school FOR UPDATE;
  PERFORM 1 FROM school_memberships WHERE school_id=school AND user_id=actor FOR UPDATE;
  IF NOT account_edits_school_settings(actor,school) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 END IF;
END $$;
CREATE FUNCTION media_owner_usage(owner_kind_arg text,owner_id_arg uuid) RETURNS bigint LANGUAGE sql STABLE AS $$
 SELECT COALESCE(sum(GREATEST(a.reserved_bytes,COALESCE((SELECT sum(o.byte_count) FROM media_objects o WHERE o.asset_id=a.id AND o.state<>'deleted'),0))),0)::bigint
 FROM media_assets a WHERE a.owner_kind=owner_kind_arg AND a.owner_id=owner_id_arg AND a.state<>'deleted'
$$;
CREATE FUNCTION media_profile_json(actor uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('mode',photo_mode,'assetId',photo_asset_id,'revision',photo_revision,
  'url',CASE WHEN photo_mode='uploaded' THEN '/api/media/'||photo_asset_id||'?variant=w384'
   WHEN photo_mode='legacy' THEN photo_url ELSE NULL END)
 FROM users WHERE id=actor AND deleted_at IS NULL AND disabled_at IS NULL AND NOT is_demo
$$;
CREATE FUNCTION reserve_media_upload(actor uuid,school uuid,purpose_arg text,request uuid,fingerprint_arg text,source_hash_arg text,revision integer,replacing uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE a media_assets;prior media_assets;scope text;subject uuid;cap bigint;allowance bigint:=0;env text;
BEGIN
 PERFORM media_lock_actor(actor,school);
 IF purpose_arg NOT IN ('profile','logo','cover','gallery') OR (purpose_arg='profile')<>(school IS NULL)
 OR request IS NULL OR fingerprint_arg !~ '^[0-9a-f]{64}$' OR source_hash_arg !~ '^[0-9a-f]{64}$' THEN
  RAISE EXCEPTION 'Invalid upload' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM media_assets WHERE uploaded_by=actor AND request_id=request FOR UPDATE;
 IF FOUND THEN
  IF a.fingerprint<>fingerprint_arg THEN RAISE EXCEPTION 'Upload request changed' USING ERRCODE='23514'; END IF;
  IF a.state NOT IN ('pending','ready') OR (a.state='pending' AND a.expires_at<=now()) THEN
   RAISE EXCEPTION 'Upload expired' USING ERRCODE='23514'; END IF;
  RETURN to_jsonb(a);
 END IF;
 scope:=CASE WHEN school IS NULL THEN 'user' ELSE 'school' END;subject:=COALESCE(school,actor);
 cap:=CASE WHEN school IS NULL THEN 25165824 ELSE 167772160 END;
 IF school IS NULL AND (revision IS NULL OR revision<>(SELECT photo_revision FROM users WHERE id=actor)) THEN
  RAISE EXCEPTION 'Photo changed' USING ERRCODE='40001'; END IF;
 IF replacing IS NOT NULL THEN
  SELECT * INTO prior FROM media_assets WHERE id=replacing AND owner_kind=scope AND owner_id=subject AND purpose=purpose_arg AND state='ready' FOR UPDATE;
  IF NOT FOUND OR (school IS NULL AND replacing IS DISTINCT FROM (SELECT photo_asset_id FROM users WHERE id=actor)) THEN
   RAISE EXCEPTION 'Invalid replacement' USING ERRCODE='42501'; END IF;
  allowance:=16777216;
 END IF;
 IF (SELECT count(*) FROM media_assets WHERE owner_kind=scope AND owner_id=subject AND state='pending')>=2
 OR media_owner_usage(scope,subject)+16777216>cap+allowance THEN RAISE EXCEPTION 'Media quota reached' USING ERRCODE='P0003'; END IF;
 SELECT environment INTO env FROM job_environment WHERE singleton;
 INSERT INTO media_assets(owner_user_id,owner_school_id,uploaded_by,environment,purpose,request_id,fingerprint,source_hash,expected_revision)
 VALUES(CASE WHEN school IS NULL THEN actor END,school,actor,env,purpose_arg,request,fingerprint_arg,source_hash_arg,revision) RETURNING * INTO a;
 INSERT INTO media_asset_cleanup VALUES(a.id,a.expires_at,'expired_upload');
 RETURN to_jsonb(a);
END $$;

CREATE FUNCTION journal_media_objects(actor uuid,asset uuid,variants jsonb,access_arg text DEFAULT 'private',publication uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE a media_assets;cfg media_storage_config;v jsonb;o media_objects;objects jsonb:='[]';store text;total bigint:=0;extra bigint:=0;scope_cap bigint;roles text[];
BEGIN
 SELECT * INTO a FROM media_assets WHERE id=asset;
 IF NOT FOUND THEN RAISE EXCEPTION 'Media missing' USING ERRCODE='P0002'; END IF;
 PERFORM media_lock_actor(actor,a.owner_school_id);
 SELECT * INTO a FROM media_assets WHERE id=asset FOR UPDATE;
 IF (a.owner_user_id IS NOT NULL AND a.owner_user_id<>actor) OR (access_arg='private' AND (a.uploaded_by<>actor OR a.state<>'pending' OR a.expires_at<=now())) THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO cfg FROM media_storage_config WHERE singleton;
 IF cfg.environment IS DISTINCT FROM a.environment OR cfg.environment IS DISTINCT FROM (SELECT environment FROM job_environment WHERE singleton)
 OR cfg.private_store_id IS NULL OR cfg.public_store_id IS NULL THEN RAISE EXCEPTION 'Media storage unavailable' USING ERRCODE='23514'; END IF;
 IF access_arg NOT IN ('private','public') OR jsonb_typeof(variants)<>'array' OR jsonb_array_length(variants) NOT BETWEEN 1 AND 3 THEN
  RAISE EXCEPTION 'Invalid media objects' USING ERRCODE='22023'; END IF;
 SELECT array_agg(value->>'role' ORDER BY value->>'role') INTO roles FROM jsonb_array_elements(variants);
 IF cardinality(roles)<>(SELECT count(DISTINCT value->>'role') FROM jsonb_array_elements(variants)) OR
  (access_arg='private' AND roles IS DISTINCT FROM CASE a.purpose WHEN 'profile' THEN ARRAY['master','w128','w384']
   WHEN 'logo' THEN ARRAY['master','w128','w512'] WHEN 'cover' THEN ARRAY['master','w1600','w800'] ELSE ARRAY['master','w1200','w600'] END) THEN
  RAISE EXCEPTION 'Invalid media variants' USING ERRCODE='22023'; END IF;
 IF access_arg='public' AND (publication IS NULL OR a.owner_school_id IS NULL OR a.state<>'ready' OR NOT EXISTS(
  SELECT 1 FROM media_asset_references WHERE asset_id=asset AND kind='publish_intent' AND reference_id=publication)) THEN
  RAISE EXCEPTION 'Publish intent required' USING ERRCODE='42501'; END IF;
 IF access_arg='private' AND publication IS NOT NULL THEN RAISE EXCEPTION 'Invalid publication' USING ERRCODE='22023'; END IF;
 store:=CASE WHEN access_arg='private' THEN cfg.private_store_id ELSE cfg.public_store_id END;
 FOR v IN SELECT value FROM jsonb_array_elements(variants) LOOP
  IF (v-ARRAY['role','byteCount','checksum','width','height'])<>'{}'::jsonb OR NOT v ?& ARRAY['role','byteCount','checksum','width','height']
   OR v->>'role' NOT IN ('master','w128','w384','w512','w600','w800','w1200','w1600') OR v->>'checksum' !~ '^[0-9a-f]{64}$'
   OR (v->>'byteCount')::bigint NOT BETWEEN 1 AND 16777216 OR (v->>'width')::int NOT BETWEEN 1 AND 2560 OR (v->>'height')::int NOT BETWEEN 1 AND 2560 THEN
   RAISE EXCEPTION 'Invalid media object' USING ERRCODE='22023'; END IF;
  IF access_arg='public' AND (v->>'role'='master' OR NOT EXISTS(SELECT 1 FROM media_objects p WHERE p.asset_id=asset AND p.access='private' AND p.state='written'
    AND p.role=v->>'role' AND p.checksum=v->>'checksum' AND p.byte_count=(v->>'byteCount')::bigint AND p.width=(v->>'width')::int AND p.height=(v->>'height')::int)) THEN
   RAISE EXCEPTION 'Only sanitised derivatives may be published' USING ERRCODE='23514'; END IF;
  total:=total+(v->>'byteCount')::bigint;
  IF NOT EXISTS(SELECT 1 FROM media_objects WHERE asset_id=asset AND access=access_arg AND publication_id IS NOT DISTINCT FROM publication AND role=v->>'role') THEN
   extra:=extra+(v->>'byteCount')::bigint; END IF;
 END LOOP;
 IF total>16777216 THEN RAISE EXCEPTION 'Media quota reached' USING ERRCODE='P0003'; END IF;
 scope_cap:=CASE WHEN a.owner_user_id IS NULL THEN 167772160 ELSE 25165824 END;
 IF access_arg='public' AND media_owner_usage(a.owner_kind,a.owner_id)+extra>scope_cap THEN RAISE EXCEPTION 'Media quota reached' USING ERRCODE='P0003'; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(variants) LOOP
  SELECT * INTO o FROM media_objects WHERE asset_id=asset AND access=access_arg AND publication_id IS NOT DISTINCT FROM publication AND role=v->>'role';
  IF FOUND THEN
   IF o.checksum<>v->>'checksum' OR o.byte_count<>(v->>'byteCount')::bigint OR o.width<>(v->>'width')::int OR o.height<>(v->>'height')::int OR o.state NOT IN ('planned','written') THEN
    RAISE EXCEPTION 'Media object changed' USING ERRCODE='23514'; END IF;
  ELSE
   o.id:=gen_random_uuid();
   INSERT INTO media_objects(id,asset_id,access,publication_id,role,store_id,pathname,byte_count,checksum,width,height)
   VALUES(o.id,asset,access_arg,publication,v->>'role',store,a.environment||'/'||access_arg||'/'||asset||'/'||o.id||'.webp',
    (v->>'byteCount')::bigint,v->>'checksum',(v->>'width')::int,(v->>'height')::int) RETURNING * INTO o;
  END IF;
  objects:=objects||jsonb_build_array(to_jsonb(o));
 END LOOP;
 RETURN objects;
END $$;

CREATE FUNCTION finish_media_asset(actor uuid,asset uuid,width_arg integer,height_arg integer) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE a media_assets;expected text[];actual text[];total bigint;photo jsonb;
BEGIN
 SELECT * INTO a FROM media_assets WHERE id=asset;
 IF NOT FOUND THEN RAISE EXCEPTION 'Media missing' USING ERRCODE='P0002'; END IF;
 PERFORM media_lock_actor(actor,a.owner_school_id);
 SELECT * INTO a FROM media_assets WHERE id=asset FOR UPDATE;
 IF a.uploaded_by<>actor OR (a.owner_user_id IS NOT NULL AND a.owner_user_id<>actor) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF a.state='ready' THEN
  IF a.owner_user_id IS NOT NULL AND (SELECT photo_asset_id FROM users WHERE id=actor) IS DISTINCT FROM asset THEN RAISE EXCEPTION 'Photo changed' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('assetId',asset,'photo',CASE WHEN a.owner_user_id IS NOT NULL THEN media_profile_json(actor) END);
 END IF;
 IF a.state<>'pending' OR a.expires_at<=now() OR width_arg IS NULL OR height_arg IS NULL OR width_arg NOT BETWEEN 64 AND 8192 OR height_arg NOT BETWEEN 64 AND 8192 OR width_arg::bigint*height_arg>16000000 THEN
  RAISE EXCEPTION 'Upload unavailable' USING ERRCODE='23514'; END IF;
 IF a.owner_user_id IS NOT NULL AND a.expected_revision<>(SELECT photo_revision FROM users WHERE id=actor) THEN RAISE EXCEPTION 'Photo changed' USING ERRCODE='40001'; END IF;
 expected:=CASE a.purpose WHEN 'profile' THEN ARRAY['master','w128','w384'] WHEN 'logo' THEN ARRAY['master','w128','w512']
  WHEN 'cover' THEN ARRAY['master','w1600','w800'] ELSE ARRAY['master','w1200','w600'] END;
 SELECT array_agg(role ORDER BY role),sum(byte_count) INTO actual,total FROM media_objects WHERE asset_id=asset AND access='private' AND state='written';
 IF actual IS DISTINCT FROM expected OR total>16777216 OR EXISTS(SELECT 1 FROM media_objects WHERE asset_id=asset AND access='private' AND state<>'written') THEN
  RAISE EXCEPTION 'Upload incomplete' USING ERRCODE='23514'; END IF;
 UPDATE media_assets SET state='ready',reserved_bytes=0,byte_count=total,source_width=width_arg,source_height=height_arg,expires_at=NULL,ready_at=now() WHERE id=asset;
 UPDATE media_asset_cleanup SET not_before=now()+interval '24 hours',reason='unreferenced_asset' WHERE asset_id=asset;
 IF a.owner_user_id IS NOT NULL THEN
  DELETE FROM media_asset_references WHERE owner_kind='user' AND owner_id=actor AND kind='profile';
  INSERT INTO media_asset_references(asset_id,owner_kind,owner_id,kind,reference_id) VALUES(asset,'user',actor,'profile',actor);
  UPDATE users SET photo_mode='uploaded',photo_asset_id=asset,photo_revision=photo_revision+1 WHERE id=actor;
  photo:=media_profile_json(actor);
 END IF;
 RETURN jsonb_build_object('assetId',asset,'photo',photo);
END $$;
CREATE FUNCTION remove_personal_photo(actor uuid,revision integer) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
 PERFORM media_lock_actor(actor,NULL);
 IF revision IS NULL OR revision<>(SELECT photo_revision FROM users WHERE id=actor) THEN RAISE EXCEPTION 'Photo changed' USING ERRCODE='40001'; END IF;
 DELETE FROM media_asset_references WHERE owner_kind='user' AND owner_id=actor AND kind='profile';
 UPDATE users SET photo_mode='none',photo_asset_id=NULL,photo_revision=photo_revision+1 WHERE id=actor;
 RETURN media_profile_json(actor);
END $$;
CREATE FUNCTION queue_media_object_cleanup(object uuid,reason_arg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO media_cleanup_queue(object_id,reason,not_before) VALUES(object,left(reason_arg,80),now()+CASE WHEN reason_arg='unreferenced_asset' THEN interval '0 seconds' ELSE interval '2 minutes' END)
 ON CONFLICT(object_id) DO UPDATE SET completed_at=NULL;
END $$;
CREATE FUNCTION fail_media_upload(actor uuid,asset uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM media_assets WHERE id=asset AND uploaded_by=actor AND state='pending' FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 -- Allow an aborted remote write to settle before exact deletion; no quota is
 -- released until the object has subsequently been verified absent.
 UPDATE media_asset_cleanup SET not_before=now()+interval '2 minutes',reason='failed_upload' WHERE asset_id=asset;
END $$;
CREATE FUNCTION claim_media_cleanup(batch integer DEFAULT 10) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE a media_assets;o media_objects;q media_cleanup_queue;items jsonb:='[]';lease uuid;
BEGIN
 IF batch NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Invalid cleanup batch' USING ERRCODE='22023'; END IF;
 FOR a IN SELECT m.* FROM media_assets m JOIN media_asset_cleanup c ON c.asset_id=m.id WHERE c.not_before<=now() AND m.state IN ('pending','ready')
  ORDER BY c.not_before LIMIT batch FOR UPDATE OF m SKIP LOCKED LOOP
  IF EXISTS(SELECT 1 FROM media_asset_references WHERE asset_id=a.id) THEN CONTINUE; END IF;
  UPDATE media_assets SET state='deleting' WHERE id=a.id;
  FOR o IN SELECT * FROM media_objects WHERE asset_id=a.id AND state<>'deleted' LOOP PERFORM queue_media_object_cleanup(o.id,'unreferenced_asset'); END LOOP;
  IF NOT EXISTS(SELECT 1 FROM media_objects WHERE asset_id=a.id AND state<>'deleted') THEN
   UPDATE media_assets SET state='deleted',reserved_bytes=0,byte_count=0 WHERE id=a.id; END IF;
 END LOOP;
 FOR q IN SELECT * FROM media_cleanup_queue WHERE completed_at IS NULL AND not_before<=now() AND (lease_until IS NULL OR lease_until<now())
  ORDER BY not_before LIMIT batch FOR UPDATE SKIP LOCKED LOOP
  SELECT * INTO o FROM media_objects WHERE id=q.object_id;
  PERFORM 1 FROM media_assets WHERE id=o.asset_id FOR UPDATE;
  SELECT * INTO o FROM media_objects WHERE id=q.object_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM media_asset_references r WHERE r.asset_id=o.asset_id AND
   (o.access='private' OR (r.kind IN ('school_publication','publish_intent') AND r.reference_id=o.publication_id))) THEN CONTINUE; END IF;
  lease:=gen_random_uuid();
  UPDATE media_cleanup_queue SET lease_id=lease,lease_until=now()+interval '2 minutes',attempts=attempts+1 WHERE object_id=o.id;
  UPDATE media_objects SET state='deleting' WHERE id=o.id;
  items:=items||jsonb_build_array(to_jsonb(o)||jsonb_build_object('leaseId',lease));
 END LOOP;
 RETURN items;
END $$;
CREATE FUNCTION finish_media_cleanup(object uuid,lease uuid,success boolean) RETURNS void LANGUAGE plpgsql AS $$
DECLARE asset uuid;
BEGIN
 UPDATE media_cleanup_queue SET completed_at=CASE WHEN success THEN now() END,lease_id=NULL,lease_until=NULL,
  not_before=CASE WHEN success THEN not_before ELSE now()+LEAST(3600,30*power(2,LEAST(attempts,7))) * interval '1 second' END
 WHERE object_id=object AND lease_id=lease AND completed_at IS NULL RETURNING (SELECT asset_id FROM media_objects WHERE id=object) INTO asset;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cleanup lease changed' USING ERRCODE='40001'; END IF;
 IF success THEN
  UPDATE media_objects SET state='deleted' WHERE id=object;
  UPDATE media_assets SET state='deleted',reserved_bytes=0,byte_count=0 WHERE id=asset AND state='deleting'
   AND NOT EXISTS(SELECT 1 FROM media_objects WHERE asset_id=asset AND state<>'deleted');
 END IF;
END $$;
