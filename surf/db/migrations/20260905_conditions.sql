-- Additive migration. Apply to staging only until production is approved.
CREATE TABLE IF NOT EXISTS tide_stations (
  id text PRIMARY KEY,
  name text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  timezone text NOT NULL,
  data jsonb NOT NULL,
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS surf_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  region text NOT NULL,
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -85 AND 85),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  timezone text NOT NULL,
  marine_latitude double precision NOT NULL,
  marine_longitude double precision NOT NULL,
  break_type text NOT NULL DEFAULT 'Beach',
  tide_station_id text REFERENCES tide_stations(id),
  calibration jsonb NOT NULL,
  notes text NOT NULL DEFAULT '',
  sources jsonb NOT NULL DEFAULT '[]',
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS spot_calibration_history (
  id bigserial PRIMARY KEY,
  spot_id uuid NOT NULL REFERENCES surf_spots(id),
  version integer NOT NULL,
  calibration jsonb NOT NULL,
  notes text NOT NULL,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (spot_id, version)
);
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS spot_id uuid REFERENCES surf_spots(id);
CREATE INDEX IF NOT EXISTS idx_lessons_spot ON lessons(spot_id) WHERE deleted_at IS NULL;
-- Legacy lessons are retained. Creation/editing/booking APIs require an active spot.
CREATE TABLE IF NOT EXISTS spot_forecasts (
  spot_id uuid PRIMARY KEY REFERENCES surf_spots(id),
  payload jsonb,
  fetched_at timestamptz,
  expires_at timestamptz,
  retry_after timestamptz,
  refreshing_until timestamptz,
  last_error text
);
