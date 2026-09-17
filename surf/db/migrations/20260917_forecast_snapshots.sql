CREATE TABLE spot_forecast_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  spot_id uuid NOT NULL REFERENCES surf_spots(id),
  retrieved_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL,
  sample_slot timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  engine_version text NOT NULL,
  calibration_version integer NOT NULL CHECK (calibration_version > 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  UNIQUE (spot_id, sample_slot, engine_version, calibration_version),
  CHECK (recorded_at >= retrieved_at AND expires_at > recorded_at)
);
CREATE INDEX spot_forecast_snapshots_expiry ON spot_forecast_snapshots(expires_at);
CREATE INDEX spot_forecast_snapshots_retrieved ON spot_forecast_snapshots(spot_id, retrieved_at);

CREATE FUNCTION protect_forecast_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR OLD.expires_at >= now() THEN
    RAISE EXCEPTION 'Forecast snapshots are immutable until retention expires';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER immutable_forecast_snapshot BEFORE UPDATE OR DELETE
  ON spot_forecast_snapshots FOR EACH ROW EXECUTE FUNCTION protect_forecast_snapshot();
