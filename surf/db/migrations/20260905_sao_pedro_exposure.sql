-- Staging first. Preserve all tide rules and other admin calibration changes.
-- 282° is an owner observation, not a measured universal cutoff.
WITH changed AS (
 UPDATE surf_spots SET
  calibration=calibration || '{"marineModel":"ncep_gfswave016","exposureByDirection":[[0,0.002],[90,0.005],[180,0.7],[225,1],[270,0.85],[275,0.65],[280,0.32],[282,0.18],[285,0.08],[290,0.02],[300,0.005],[315,0.003],[360,0.002]],"modelVersion":"surf-heuristic-v2","directionRevision":"sao-pedro-20260905"}'::jsonb,
  marine_latitude=latitude, marine_longitude=longitude,
  sources=sources || '[{"title":"Owner comparison with Surfline, 5 September 2026","note":"São Pedro is strongly direction-dependent; useful swell around 272°, marginal near 282–283°, usually flat above 290°. Initial curve is a local observation, not a verified universal cutoff. GFS bearings are retained as supplied."}]'::jsonb,
  notes=notes || ' Strong swell shadow: west and south-west swell preferred; exposure falls sharply around 282–290°. This initial local curve needs checking against beach observations, especially on large, long-period swells.',
  version=version+1,updated_at=now()
 WHERE slug IN ('sao-pedro-estoril','sao-pedro-bico','sao-pedro-bafureira')
  AND calibration->>'directionRevision' IS DISTINCT FROM 'sao-pedro-20260905'
 RETURNING *
), history AS (
 INSERT INTO spot_calibration_history(spot_id,version,calibration,notes)
 SELECT id,version,calibration,notes FROM changed RETURNING id
), expired AS (
 UPDATE spot_forecasts SET expires_at=now(),retry_after=NULL
 WHERE spot_id IN (SELECT id FROM changed) RETURNING spot_id
)
SELECT slug,version FROM changed;
