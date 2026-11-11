-- B5 stage 2. Base locations never become forecast spots or meeting points.
SELECT assert_membership_authority();
CREATE TABLE school_base_locations (
 school_id uuid PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
 has_fixed_base boolean NOT NULL DEFAULT false,
 address text NOT NULL DEFAULT '' CHECK(length(address)<=400),
 latitude double precision CHECK(latitude BETWEEN -90 AND 90),
 longitude double precision CHECK(longitude BETWEEN -180 AND 180),
 public_visible boolean NOT NULL DEFAULT false,
 CHECK((latitude IS NULL)=(longitude IS NULL)),
 CHECK(has_fixed_base OR (address='' AND latitude IS NULL AND longitude IS NULL AND NOT public_visible)),
 CHECK(NOT public_visible OR (has_fixed_base AND latitude IS NOT NULL AND longitude IS NOT NULL))
);
CREATE FUNCTION school_base_location_json(target uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT COALESCE((SELECT jsonb_build_object('hasFixedBase',b.has_fixed_base,'address',b.address,
 'latitude',b.latitude,'longitude',b.longitude,'publicVisible',b.public_visible)
 FROM school_base_locations b WHERE b.school_id=target),
 '{"hasFixedBase":false,"address":"","latitude":null,"longitude":null,"publicVisible":false}'::jsonb)
$$;
CREATE FUNCTION validate_school_base_location(base jsonb) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF base IS NULL OR jsonb_typeof(base)<>'object'
 OR (base-ARRAY['hasFixedBase','address','latitude','longitude','publicVisible'])<>'{}'::jsonb
 OR NOT base ?& ARRAY['hasFixedBase','address','latitude','longitude','publicVisible']
 OR jsonb_typeof(base->'hasFixedBase')<>'boolean' OR jsonb_typeof(base->'publicVisible')<>'boolean'
 OR jsonb_typeof(base->'address')<>'string' OR length(base->>'address')>400
 OR base->>'address' ~ '[[:cntrl:]]'
 OR jsonb_typeof(base->'latitude') NOT IN ('number','null') OR jsonb_typeof(base->'longitude') NOT IN ('number','null')
 OR (base->'latitude'='null'::jsonb)<>(base->'longitude'='null'::jsonb) THEN
 RAISE EXCEPTION 'Invalid school base location' USING ERRCODE='22023'; END IF;
 IF base->'latitude'<>'null'::jsonb AND ((base->>'latitude')::double precision NOT BETWEEN -90 AND 90
 OR (base->>'longitude')::double precision NOT BETWEEN -180 AND 180) THEN
 RAISE EXCEPTION 'Invalid school base coordinates' USING ERRCODE='22023'; END IF;
 IF NOT (base->>'hasFixedBase')::boolean AND (base->>'address'<>'' OR base->'latitude'<>'null'::jsonb
 OR base->'longitude'<>'null'::jsonb OR (base->>'publicVisible')::boolean) THEN
 RAISE EXCEPTION 'No fixed base must omit base data' USING ERRCODE='22023'; END IF;
 IF (base->>'publicVisible')::boolean AND (NOT (base->>'hasFixedBase')::boolean OR base->'latitude'='null'::jsonb) THEN
 RAISE EXCEPTION 'Choose a pin before making the base public' USING ERRCODE='22023'; END IF;
END $$;
CREATE FUNCTION save_school_base_location(target uuid,base jsonb) RETURNS void LANGUAGE sql AS $$
 INSERT INTO school_base_locations(school_id,has_fixed_base,address,latitude,longitude,public_visible)
 VALUES(target,(base->>'hasFixedBase')::boolean,base->>'address',(base->>'latitude')::double precision,
 (base->>'longitude')::double precision,(base->>'publicVisible')::boolean)
 ON CONFLICT(school_id) DO UPDATE SET has_fixed_base=EXCLUDED.has_fixed_base,address=EXCLUDED.address,
 latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,public_visible=EXCLUDED.public_visible
$$;

-- Existing teaching history is evidence of an operating association. No blanket
-- catalogue backfill, no lesson rewrites, and inactive historical spots survive.
INSERT INTO school_operating_spots(school_id,spot_id)
 SELECT DISTINCT l.school_id,l.spot_id FROM lessons l JOIN schools s ON s.id=l.school_id
 WHERE l.deleted_at IS NULL AND l.spot_id IS NOT NULL AND s.workspace_kind='legacy'
 ON CONFLICT DO NOTHING;
CREATE INDEX school_future_spot_lessons ON lessons(school_id,spot_id,start_at) WHERE deleted_at IS NULL;

ALTER FUNCTION validate_school_settings(jsonb) RENAME TO validate_school_settings_v1;
CREATE FUNCTION validate_school_settings(details jsonb,target uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE item jsonb; spots uuid[];
BEGIN
 -- Reuse the installed text/link validator with no spot selections. Catalogue
 -- validation below distinguishes retained inactive choices from new choices.
 PERFORM validate_school_settings_v1((details-'baseLocation')||jsonb_build_object('operatingSpotIds','[]'::jsonb));
 PERFORM validate_school_base_location(COALESCE(details->'baseLocation',school_base_location_json(NULL)));
 IF jsonb_typeof(details->'operatingSpotIds') IS DISTINCT FROM 'array' OR jsonb_array_length(details->'operatingSpotIds')>30 THEN
 RAISE EXCEPTION 'Invalid operating spots' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(details->'operatingSpotIds') LOOP
  IF jsonb_typeof(item)<>'string' OR item#>>'{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
   RAISE EXCEPTION 'Invalid operating spot' USING ERRCODE='22023'; END IF;
 END LOOP;
 SELECT COALESCE(array_agg(value::uuid),ARRAY[]::uuid[]) INTO spots FROM jsonb_array_elements_text(details->'operatingSpotIds');
 PERFORM 1 FROM surf_spots WHERE id=ANY(spots) ORDER BY id FOR SHARE;
 IF cardinality(spots)<>(SELECT count(DISTINCT sp.id) FROM surf_spots sp WHERE sp.id=ANY(spots)
  AND (sp.active OR EXISTS(SELECT 1 FROM school_operating_spots a WHERE a.school_id=target AND a.spot_id=sp.id))) THEN
 RAISE EXCEPTION 'Choose active operating spots' USING ERRCODE='22023'; END IF;
END $$;
CREATE FUNCTION validate_school_settings(details jsonb) RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM validate_school_settings(details,NULL); END $$;

CREATE FUNCTION lock_school_lesson_editor(actor uuid,target uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM assert_membership_authority();
 PERFORM 1 FROM users WHERE id=actor FOR SHARE;
 PERFORM 1 FROM schools WHERE id=target FOR UPDATE;
 PERFORM 1 FROM school_memberships WHERE school_id=target AND user_id=actor FOR UPDATE;
 IF NOT account_manages_school(actor,target) OR NOT EXISTS(SELECT 1 FROM users
  WHERE id=actor AND deleted_at IS NULL AND disabled_at IS NULL AND self_closed_at IS NULL AND NOT is_demo) THEN
 RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION validate_school_lesson_coaches(target uuid,ids uuid[]) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF ids IS NULL OR cardinality(ids)>100 OR array_position(ids,NULL) IS NOT NULL THEN
  RAISE EXCEPTION 'Invalid instructors' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM users WHERE id IN(SELECT user_id FROM coaches WHERE id=ANY(ids)) ORDER BY id FOR SHARE;
 PERFORM 1 FROM school_memberships WHERE school_id=target AND user_id IN(SELECT user_id FROM coaches WHERE id=ANY(ids)) ORDER BY id FOR SHARE;
 PERFORM 1 FROM coaches WHERE id=ANY(ids) ORDER BY id FOR SHARE;
 IF cardinality(ids)<>(SELECT count(DISTINCT c.id) FROM coaches c JOIN users u ON u.id=c.user_id
 JOIN school_memberships m ON m.school_id=c.school_id AND m.user_id=c.user_id
 WHERE c.school_id=target AND c.id=ANY(ids) AND c.deleted_at IS NULL AND m.status='active'
 AND u.deleted_at IS NULL AND u.disabled_at IS NULL AND u.self_closed_at IS NULL AND NOT u.is_demo
 AND EXISTS(SELECT 1 FROM membership_roles r WHERE r.membership_id=m.id AND r.role='coach' AND r.revoked_at IS NULL)) THEN
 RAISE EXCEPTION 'Choose active teaching members from this school' USING ERRCODE='22023'; END IF;
END $$;
CREATE FUNCTION mutate_school_lesson(actor uuid,target uuid,operation text,lesson_arg uuid,details jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE current_lesson lessons; output lessons; spot uuid; starts timestamptz; duration integer; seats integer; coaches_arg uuid[];
BEGIN
 PERFORM lock_school_lesson_editor(actor,target);
 IF operation NOT IN ('create','update','delete') OR operation IS NULL THEN RAISE EXCEPTION 'Invalid operation' USING ERRCODE='22023'; END IF;
 IF operation<>'create' THEN
  SELECT * INTO current_lesson FROM lessons WHERE id=lesson_arg AND school_id=target AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lesson not found' USING ERRCODE='P0002'; END IF;
 END IF;
 IF operation='delete' THEN
  UPDATE lessons SET deleted_at=now(),updated_at=now() WHERE id=lesson_arg;
  RETURN jsonb_build_object('id',lesson_arg);
 END IF;
 IF details IS NULL OR jsonb_typeof(details)<>'object' OR (details-ARRAY['startAt','durationMin','difficulty','place','capacity','spotId','coachIds'])<>'{}'::jsonb
 OR NOT details ?& ARRAY['startAt','durationMin','difficulty','place','capacity','spotId','coachIds']
 OR jsonb_typeof(details->'startAt')<>'string' OR jsonb_typeof(details->'durationMin')<>'number'
 OR jsonb_typeof(details->'difficulty')<>'string' OR details->>'difficulty' NOT IN ('Beginner','Intermediate','Advanced')
 OR jsonb_typeof(details->'place')<>'string' OR length(btrim(details->>'place')) NOT BETWEEN 1 AND 200
 OR jsonb_typeof(details->'spotId')<>'string' OR jsonb_typeof(details->'coachIds')<>'array'
 OR jsonb_typeof(details->'capacity') NOT IN ('number','null') THEN RAISE EXCEPTION 'Invalid lesson' USING ERRCODE='22023'; END IF;
 BEGIN
  spot:=(details->>'spotId')::uuid; starts:=(details->>'startAt')::timestamptz;
  duration:=(details->>'durationMin')::integer; seats:=(details->>'capacity')::integer;
  SELECT COALESCE(array_agg(value::uuid),ARRAY[]::uuid[]) INTO coaches_arg FROM jsonb_array_elements_text(details->'coachIds');
 EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow OR numeric_value_out_of_range THEN
 RAISE EXCEPTION 'Invalid lesson' USING ERRCODE='22023'; END;
 IF NOT isfinite(starts) OR duration NOT BETWEEN 15 AND 720 OR (seats IS NOT NULL AND seats NOT BETWEEN 1 AND 1000)
 OR (details->>'durationMin')::numeric<>duration OR (seats IS NOT NULL AND (details->>'capacity')::numeric<>seats) THEN
 RAISE EXCEPTION 'Invalid lesson' USING ERRCODE='22023'; END IF;
 -- Existing historical records remain editable without inventing an active
 -- association. New lessons and future/ongoing reschedules use current choices.
 IF operation='create' OR starts+duration*interval '1 minute'>clock_timestamp() OR spot IS DISTINCT FROM current_lesson.spot_id THEN
  PERFORM 1 FROM surf_spots WHERE id=spot FOR SHARE;
  IF NOT EXISTS(SELECT 1 FROM surf_spots sp JOIN school_operating_spots a ON a.spot_id=sp.id
   WHERE a.school_id=target AND sp.id=spot AND sp.active) THEN
   RAISE EXCEPTION 'Choose an active school operating spot' USING ERRCODE='22023'; END IF;
 END IF;
 IF operation='update' THEN
  IF seats IS NOT NULL AND seats<(SELECT count(*) FROM bookings WHERE lesson_id=lesson_arg AND status='booked') THEN
   RAISE EXCEPTION 'Capacity is below current bookings' USING ERRCODE='23514'; END IF;
  UPDATE lessons SET start_at=starts,duration_min=duration,difficulty=(details->>'difficulty')::difficulty_level,
   place=btrim(details->>'place'),capacity=seats,spot_id=spot,updated_at=now() WHERE id=lesson_arg RETURNING * INTO output;
 ELSE
  PERFORM validate_school_lesson_coaches(target,coaches_arg);
  INSERT INTO lessons(school_id,start_at,duration_min,difficulty,place,capacity,spot_id)
  VALUES(target,starts,duration,(details->>'difficulty')::difficulty_level,btrim(details->>'place'),seats,spot) RETURNING * INTO output;
  INSERT INTO lesson_coaches(lesson_id,coach_id) SELECT output.id,id FROM unnest(coaches_arg) id;
 END IF;
 RETURN jsonb_build_object('id',output.id,'schoolId',output.school_id,'startAt',output.start_at,'durationMin',output.duration_min,
  'difficulty',output.difficulty,'place',output.place,'spotId',output.spot_id,'capacity',output.capacity);
END $$;
CREATE FUNCTION set_school_lesson_coaches(actor uuid,target uuid,lesson_arg uuid,ids uuid[]) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM lock_school_lesson_editor(actor,target);
 PERFORM 1 FROM lessons WHERE id=lesson_arg AND school_id=target AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lesson not found' USING ERRCODE='P0002'; END IF;
 PERFORM validate_school_lesson_coaches(target,ids);
 DELETE FROM lesson_coaches WHERE lesson_id=lesson_arg AND NOT coach_id=ANY(ids);
 INSERT INTO lesson_coaches(lesson_id,coach_id) SELECT lesson_arg,id FROM unnest(ids) id ON CONFLICT DO NOTHING;
END $$;


CREATE OR REPLACE FUNCTION school_settings_json(s schools,actor uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('id',s.id,'name',s.name,'slug',s.slug,'description',s.description,'timezone',s.timezone,
 'contactEmail',COALESCE(s.contact_email,''),'contactPhone',s.contact_phone,'website',s.website,'socialLinks',s.social_links,
 'operatingSpotIds',COALESCE((SELECT jsonb_agg(spot_id ORDER BY spot_id) FROM school_operating_spots WHERE school_id=s.id),'[]'::jsonb),
 'baseLocation',school_base_location_json(s.id),'revision',s.settings_revision,'workspaceKind',s.workspace_kind,'workspaceStatus',s.workspace_status,'listingStatus',s.listing_status,
 'pilotAccessStatus',s.pilot_access_status,'canEdit',account_edits_school_settings(actor,s.id),
 'owner',EXISTS(SELECT 1 FROM school_memberships m WHERE m.id=s.owner_membership_id AND m.user_id=actor AND m.status='active'))
$$;

CREATE OR REPLACE FUNCTION create_draft_school(actor uuid,request uuid,details jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE existing school_creation_requests; school schools; membership uuid:=gen_random_uuid(); fingerprint text;
BEGIN
 PERFORM assert_membership_authority();
 -- Serialise with self-closure and deactivation BEFORE inserting school/owner rows.
 PERFORM 1 FROM users WHERE id=actor FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND deleted_at IS NULL AND disabled_at IS NULL
 AND self_closed_at IS NULL AND NOT is_demo AND email_verified_at IS NOT NULL) THEN
 RAISE EXCEPTION 'Verified account required' USING ERRCODE='42501'; END IF;
 IF request IS NULL THEN RAISE EXCEPTION 'Request ID required' USING ERRCODE='22023'; END IF;
 details:=(details-'baseLocation')||jsonb_build_object('baseLocation',COALESCE(details->'baseLocation',school_base_location_json(NULL)));
 fingerprint:=encode(sha256(convert_to(details::text,'UTF8')),'hex');
 SELECT * INTO existing FROM school_creation_requests WHERE actor_id=actor AND request_id=request;
 IF FOUND THEN
  IF existing.payload_fingerprint IS DISTINCT FROM fingerprint AND NOT (details->'baseLocation'=school_base_location_json(NULL) AND existing.payload_fingerprint=encode(sha256(convert_to((details-'baseLocation')::text,'UTF8')),'hex')) THEN RAISE EXCEPTION 'Request changed' USING ERRCODE='23514'; END IF;
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
 PERFORM save_school_base_location(school.id,details->'baseLocation');
 INSERT INTO school_creation_requests(actor_id,request_id,payload_fingerprint,school_id) VALUES(actor,request,fingerprint,school.id);
 INSERT INTO school_access_events(school_id,actor_id,person_id,action) VALUES(school.id,actor,actor,'school_draft_created');
 RETURN jsonb_build_object('data',school_settings_json(school,actor),'replayed',false);
END $$;

CREATE OR REPLACE FUNCTION update_school_settings(actor uuid,target uuid,revision integer,details jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
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
 details:=(details-'baseLocation')||jsonb_build_object('baseLocation',COALESCE(details->'baseLocation',school_base_location_json(target)));
 PERFORM validate_school_settings(details,target);
 IF EXISTS(SELECT 1 FROM school_operating_spots a JOIN lessons l ON l.school_id=a.school_id AND l.spot_id=a.spot_id
 WHERE a.school_id=target AND NOT details->'operatingSpotIds' ? a.spot_id::text AND l.deleted_at IS NULL
 AND l.start_at+l.duration_min*interval '1 minute'>clock_timestamp()) THEN
 RAISE EXCEPTION 'Reschedule or cancel upcoming lessons before removing this operating spot' USING ERRCODE='P0004'; END IF;
 UPDATE schools SET name=details->>'name',contact_email=NULLIF(details->>'contactEmail',''),description=details->>'description',
 timezone=details->>'timezone',contact_phone=details->>'contactPhone',website=details->>'website',social_links=details->'socialLinks',
 settings_revision=settings_revision+1,updated_at=now() WHERE id=target RETURNING * INTO school;
 PERFORM save_school_base_location(target,details->'baseLocation');
 DELETE FROM school_operating_spots WHERE school_id=target AND NOT details->'operatingSpotIds' ? spot_id::text;
 INSERT INTO school_operating_spots(school_id,spot_id) SELECT target,value::uuid FROM jsonb_array_elements_text(details->'operatingSpotIds') ON CONFLICT DO NOTHING;
 INSERT INTO school_access_events(school_id,actor_id,action) VALUES(target,actor,'school_settings_updated');
 RETURN jsonb_build_object('data',school_settings_json(school,actor));
END $$;
