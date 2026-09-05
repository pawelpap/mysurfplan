-- Use São João’s established regional wave input for both neighbouring beaches.
-- Retain separate local exposure, weather and tide settings.
WITH changed AS (
 UPDATE surf_spots SET marine_latitude=38.66,marine_longitude=-9.37,
 calibration=calibration || '{"marineModel":"ncep_gfswave025","sourceRevision":"caparica-sao-joao-20260905"}'::jsonb,
 version=version+1,updated_at=now()
 WHERE slug IN ('sao-joao-caparica','cornelia-caparica')
 AND calibration->>'sourceRevision' IS DISTINCT FROM 'caparica-sao-joao-20260905'
 RETURNING *
), history AS (
 INSERT INTO spot_calibration_history(spot_id,version,calibration,notes)
 SELECT id,version,calibration,notes FROM changed RETURNING id
), expired AS (
 UPDATE spot_forecasts SET expires_at=now(),retry_after=NULL WHERE spot_id IN (SELECT id FROM changed) RETURNING spot_id
)
SELECT slug,version FROM changed;
