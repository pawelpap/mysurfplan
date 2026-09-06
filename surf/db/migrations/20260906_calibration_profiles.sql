-- Additive rollout: retain legacy calibration for rollback until old releases retire.
CREATE EXTENSION IF NOT EXISTS pg_jsonschema;
CREATE TABLE IF NOT EXISTS calibration_schema_versions (
 version integer PRIMARY KEY,
 schema jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION validate_surf_configuration(c jsonb, v integer)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE s jsonb; k text; p jsonb; prev numeric; first_p jsonb; last_p jsonb; total numeric;
BEGIN
 SELECT schema INTO s FROM calibration_schema_versions WHERE version=v;
 IF s IS NULL OR c IS NULL OR NOT jsonb_matches_schema(s::json,c) THEN RETURN false; END IF;
 FOREACH k IN ARRAY ARRAY['exposureByDirection','windDirectionCurve','heightFitCurve','periodFitCurve','sizeCeilingCurve'] LOOP
   IF k='exposureByDirection' AND jsonb_array_length(c->k)=0 THEN CONTINUE; END IF;
   IF jsonb_array_length(c->k)<2 THEN RETURN false; END IF;
   first_p=c->k->0; last_p=c->k->-1;
   IF (first_p->>0)::numeric<>0 THEN RETURN false; END IF;
   prev=-1;
   FOR p IN SELECT value FROM jsonb_array_elements(c->k) LOOP
     IF (p->>0)::numeric<=prev THEN RETURN false; END IF;
     prev=(p->>0)::numeric;
   END LOOP;
   IF k IN ('exposureByDirection','windDirectionCurve') AND ((last_p->>0)::numeric<>360 OR first_p->1<>last_p->1) THEN RETURN false; END IF;
 END LOOP;
 prev=-1;
 FOR p IN SELECT value FROM jsonb_array_elements(c->'tideRules') LOOP
   IF (prev=-1 AND (p->>'minimumSwell')::numeric<>0) OR (p->>'minimumSwell')::numeric<=prev OR (p->>'low')::numeric>(p->>'high')::numeric THEN RETURN false; END IF;
   prev=(p->>'minimumSwell')::numeric;
 END LOOP;
 SELECT sum(value::numeric) INTO total FROM jsonb_each_text(c->'weights');
 IF abs(total-1)>0.000000001 OR (c#>>'{weights,tide}')::numeric=1 THEN RETURN false; END IF;
 IF (c->>'periodFactorMin')::numeric>(c->>'periodFactorMax')::numeric OR (c#>>'{windFit,offshoreAngleBelow}')::numeric>=(c#>>'{windFit,onshoreAngleAbove}')::numeric OR (c#>>'{tideDisplay,lowAtMost}')::numeric>=(c#>>'{tideDisplay,highAtLeast}')::numeric THEN RETURN false; END IF;
 prev=101;
 FOR p IN SELECT value FROM jsonb_array_elements(c->'qualityBands') LOOP
   IF (p->>'minimumScore')::numeric>=prev THEN RETURN false; END IF;
   prev=(p->>'minimumScore')::numeric;
 END LOOP;
 IF prev<>0 OR c#>>'{experienceRules,-1,level}'<>'Advanced' THEN RETURN false; END IF;
 prev=0; last_p=NULL;
 FOR p IN SELECT value FROM jsonb_array_elements(c->'experienceRules') LOOP
   total=CASE p->>'level' WHEN 'Beginner' THEN 1 WHEN 'Intermediate' THEN 2 WHEN 'Advanced' THEN 3 END;
   IF total<=prev THEN RETURN false; END IF;
   IF last_p IS NOT NULL AND ((p->>'maxSurf')::numeric<(last_p->>'maxSurf')::numeric OR (p->>'maxWind')::numeric<(last_p->>'maxWind')::numeric OR (p->>'maxPeriod')::numeric<(last_p->>'maxPeriod')::numeric) THEN RETURN false; END IF;
   prev=total; last_p=p;
 END LOOP;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
CREATE TABLE IF NOT EXISTS surf_calibration_profiles (
 id text NOT NULL,
 version integer NOT NULL CHECK(version>0),
 name text NOT NULL,
 schema_version integer NOT NULL REFERENCES calibration_schema_versions(version),
 configuration jsonb NOT NULL,
 change_note text NOT NULL,
 sources jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(sources)='array'),
 changed_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(id,version),
 CHECK(validate_surf_configuration(configuration,schema_version))
);
CREATE TABLE IF NOT EXISTS surf_calibration_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 default_profile_id text NOT NULL,
 default_profile_version integer NOT NULL,
 FOREIGN KEY(default_profile_id,default_profile_version) REFERENCES surf_calibration_profiles(id,version)
);
CREATE OR REPLACE FUNCTION prevent_calibration_revision_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Calibration revisions are immutable; create a new version'; END $$;
DROP TRIGGER IF EXISTS immutable_calibration_schema ON calibration_schema_versions;
CREATE TRIGGER immutable_calibration_schema BEFORE UPDATE OR DELETE ON calibration_schema_versions FOR EACH ROW EXECUTE FUNCTION prevent_calibration_revision_change();
DROP TRIGGER IF EXISTS immutable_calibration_profile ON surf_calibration_profiles;
CREATE TRIGGER immutable_calibration_profile BEFORE UPDATE OR DELETE ON surf_calibration_profiles FOR EACH ROW EXECUTE FUNCTION prevent_calibration_revision_change();
ALTER TABLE surf_spots ADD COLUMN IF NOT EXISTS calibration_config jsonb;
ALTER TABLE surf_spots ADD COLUMN IF NOT EXISTS calibration_schema_version integer REFERENCES calibration_schema_versions(version);
ALTER TABLE surf_spots ADD COLUMN IF NOT EXISTS calibration_profile_id text;
ALTER TABLE surf_spots ADD COLUMN IF NOT EXISTS calibration_profile_version integer;
ALTER TABLE surf_spots ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
ALTER TABLE spot_calibration_history ADD COLUMN IF NOT EXISTS schema_version integer REFERENCES calibration_schema_versions(version);
ALTER TABLE spot_calibration_history ADD COLUMN IF NOT EXISTS change_note text NOT NULL DEFAULT '';
ALTER TABLE spot_calibration_history ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]';
DO $$ BEGIN
 ALTER TABLE surf_spots ADD CONSTRAINT surf_spots_configuration_valid CHECK(calibration_config IS NULL OR validate_surf_configuration(calibration_config,calibration_schema_version));
 ALTER TABLE surf_spots ADD CONSTRAINT surf_spots_calibration_profile_fk FOREIGN KEY(calibration_profile_id,calibration_profile_version) REFERENCES surf_calibration_profiles(id,version);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Database-owned first choice in the selector; no spot identity in runtime code.
UPDATE surf_spots SET display_order=10 WHERE slug='sao-pedro-bico' AND display_order=0;
