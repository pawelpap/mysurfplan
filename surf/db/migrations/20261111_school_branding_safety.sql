-- Additive correction after isolated real-race reproduction; installed SQL stays immutable.
ALTER TABLE school_publication_intents ADD COLUMN expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes';
CREATE OR REPLACE FUNCTION abort_school_publication(actor uuid,publication uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE intent school_publication_intents;target uuid;object_id uuid;
BEGIN
 SELECT school_id INTO target FROM school_publication_intents WHERE id=publication AND actor_id=actor;
 IF target IS NULL THEN RETURN;END IF;
 -- Match journal/finalisation order. Authority may have been revoked, but
 -- withdrawing one's pending intent must still compensate exact objects.
 PERFORM 1 FROM users WHERE id=actor FOR UPDATE;
 PERFORM 1 FROM schools WHERE id=target FOR UPDATE;
 SELECT * INTO intent FROM school_publication_intents WHERE id=publication AND actor_id=actor FOR UPDATE;
 IF NOT FOUND OR intent.state='published' THEN RETURN;END IF;
 UPDATE school_publication_intents SET state='failed',finished_at=COALESCE(finished_at,now()) WHERE id=publication;
 DELETE FROM media_asset_references WHERE kind='publish_intent' AND reference_id=publication;
 FOR object_id IN SELECT id FROM media_objects WHERE publication_id=publication AND access='public' AND state<>'deleted' LOOP
  PERFORM queue_media_object_cleanup(object_id,'failed_publication');
 END LOOP;
END $$;
ALTER FUNCTION finish_school_publication(uuid,uuid) RENAME TO finish_school_publication_v1;
CREATE FUNCTION finish_school_publication(actor uuid,publication uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE target uuid;intent school_publication_intents;
BEGIN
 SELECT school_id INTO target FROM school_publication_intents WHERE id=publication AND actor_id=actor;
 IF target IS NULL THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 PERFORM lock_school_branding_actor(actor,target);
 SELECT * INTO intent FROM school_publication_intents WHERE id=publication FOR UPDATE;
 IF intent.state='pending' AND intent.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Publication expired' USING ERRCODE='40001';END IF;
 RETURN finish_school_publication_v1(actor,publication);
END $$;
CREATE FUNCTION expire_school_publication_intents(batch integer DEFAULT 20) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE item record;n integer:=0;
BEGIN
 IF batch NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid batch' USING ERRCODE='22023';END IF;
 FOR item IN SELECT id,actor_id FROM school_publication_intents WHERE state='pending' AND expires_at<=clock_timestamp() ORDER BY expires_at LIMIT batch LOOP
  PERFORM abort_school_publication(item.actor_id,item.id);n:=n+1;
 END LOOP;
 RETURN n;
END $$;
CREATE FUNCTION prune_school_branding_versions(batch integer DEFAULT 20) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE item record;object_id uuid;n integer:=0;
BEGIN
 IF batch NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid batch' USING ERRCODE='22023';END IF;
 FOR item IN SELECT v.id,v.school_id FROM school_branding_versions v
 WHERE v.published_at<clock_timestamp()-interval '30 days'
 AND NOT EXISTS(SELECT 1 FROM schools s WHERE s.published_branding_version_id=v.id)
 AND NOT EXISTS(SELECT 1 FROM school_branding_version_pins p WHERE p.version_id=v.id AND (p.expires_at IS NULL OR p.expires_at>clock_timestamp()))
 ORDER BY v.published_at LIMIT batch LOOP
  PERFORM 1 FROM schools WHERE id=item.school_id FOR UPDATE;
  PERFORM 1 FROM school_branding_versions WHERE id=item.id FOR UPDATE;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM schools WHERE published_branding_version_id=item.id)
  OR EXISTS(SELECT 1 FROM school_branding_version_pins WHERE version_id=item.id AND (expires_at IS NULL OR expires_at>clock_timestamp())) THEN CONTINUE;END IF;
  DELETE FROM school_branding_version_pins WHERE version_id=item.id AND expires_at<=clock_timestamp();
  DELETE FROM media_asset_references WHERE kind='school_publication' AND reference_id=item.id;
  FOR object_id IN SELECT id FROM media_objects WHERE publication_id=item.id AND access='public' AND state<>'deleted' LOOP
   PERFORM queue_media_object_cleanup(object_id,'expired_publication');
  END LOOP;
  DELETE FROM school_branding_versions WHERE id=item.id;n:=n+1;
 END LOOP;
 RETURN n;
END $$;
CREATE FUNCTION school_branding_maintenance(batch integer DEFAULT 10) RETURNS jsonb LANGUAGE plpgsql SET lock_timeout='5s' AS $$
DECLARE expired integer;pruned integer;
BEGIN
 expired:=expire_school_publication_intents(batch);pruned:=prune_school_branding_versions(batch);
 -- Retain request/replay/audit metadata, remove old terminal presentation copies.
 WITH old AS(SELECT id FROM school_publication_intents WHERE state<>'pending' AND finished_at<clock_timestamp()-interval '30 days'
 AND snapshot<>'{}'::jsonb ORDER BY finished_at LIMIT batch FOR UPDATE SKIP LOCKED)
 UPDATE school_publication_intents SET snapshot='{}'::jsonb WHERE id IN(SELECT id FROM old);
 RETURN jsonb_build_object('expiredIntents',expired,'prunedVersions',pruned);
END $$;
