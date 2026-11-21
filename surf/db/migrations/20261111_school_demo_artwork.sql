-- Dedicated fictional Demo artwork, pinned in new immutable snapshots only.
-- No assets/Blob objects, quotas, account grants, owner changes or data backfill.
SELECT assert_membership_authority();
CREATE OR REPLACE FUNCTION school_public_snapshot(target uuid,details jsonb)RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('schoolId',s.id,'name',s.name,'slug',s.slug,'description',s.description,
 'timezone',s.timezone,'contactEmail',COALESCE(s.contact_email,''),'contactPhone',s.contact_phone,
 'website',s.website,'socialLinks',s.social_links,'branding',details,
 'defaultArtworkVersion',CASE WHEN s.id='7abd47ea-705a-4a75-ad90-274c32c14f95'::uuid THEN 'demo-v1' ELSE 'v1' END,
 'demo',s.id='7abd47ea-705a-4a75-ad90-274c32c14f95'::uuid,
 'baseLocation',CASE WHEN(school_settings_json(s,NULL)->'baseLocation'->>'hasFixedBase')::boolean
 AND(school_settings_json(s,NULL)->'baseLocation'->>'publicVisible')::boolean
 THEN school_settings_json(s,NULL)->'baseLocation' ELSE NULL END,
 'operatingSpots',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',sp.id,'name',sp.name,'timezone',sp.timezone)ORDER BY sp.name,sp.id)
 FROM school_operating_spots os JOIN surf_spots sp ON sp.id=os.spot_id WHERE os.school_id=s.id),'[]'::jsonb))
 FROM schools s WHERE s.id=target
$$;
