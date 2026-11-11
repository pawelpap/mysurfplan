-- Additive correction: preserve recroppable wide/tall masters. Installed media SQL stays immutable.
SELECT assert_membership_authority();
ALTER TABLE media_objects DROP CONSTRAINT media_objects_width_check,
 DROP CONSTRAINT media_objects_height_check,
 ADD CONSTRAINT media_objects_width_check CHECK(width BETWEEN 1 AND (CASE WHEN role='master' THEN 8192 ELSE 2560 END)),
 ADD CONSTRAINT media_objects_height_check CHECK(height BETWEEN 1 AND (CASE WHEN role='master' THEN 8192 ELSE 2560 END));

CREATE OR REPLACE FUNCTION journal_media_objects(actor uuid,asset uuid,variants jsonb,access_arg text DEFAULT 'private',publication uuid DEFAULT NULL)
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
   OR (v->>'byteCount')::bigint NOT BETWEEN 1 AND 16777216
   OR (v->>'width')::int NOT BETWEEN 1 AND (CASE WHEN v->>'role'='master' THEN 8192 ELSE 2560 END)
   OR (v->>'height')::int NOT BETWEEN 1 AND (CASE WHEN v->>'role'='master' THEN 8192 ELSE 2560 END) THEN
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

