import fs from "node:fs";
import pg from "pg";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
if (process.argv[2] !== "--staging")
  throw new Error(
    "Pass --staging only when DATABASE_URL is the verified staging branch.",
  );
const url = new URL(process.env.DATABASE_URL || process.env.POSTGRES_URL);
url.hostname = url.hostname.replace("-pooler", "");
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(
    fs.readFileSync("db/migrations/20260905_conditions.sql", "utf8"),
  );
  const t = JSON.parse(fs.readFileSync("db/seeds/cascais-tides.json", "utf8"));
  await client.query(
    "INSERT INTO tide_stations(id,name,latitude,longitude,timezone,data,source_url) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING",
    [
      "ticon/" + t.source.id,
      t.name,
      t.latitude,
      t.longitude,
      t.timezone,
      JSON.stringify(t),
      "https://github.com/openwatersio/tide-database/blob/c7e1aa84f50830f1b48a88d69bb1d853761baceb/data/ticon/" +
        t.source.id +
        ".json",
    ],
  );
  const spots = JSON.parse(
    fs.readFileSync("db/seeds/portugal-spots.json", "utf8"),
  );
  for (const s of spots) {
    await client.query(
      "INSERT INTO surf_spots(slug,name,region,country_code,latitude,longitude,timezone,marine_latitude,marine_longitude,break_type,tide_station_id,calibration,notes,sources) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(slug) DO NOTHING",
      [
        s.slug,
        s.name,
        s.region,
        s.countryCode,
        s.latitude,
        s.longitude,
        s.timezone,
        s.marineLatitude,
        s.marineLongitude,
        s.breakType,
        s.tideStationId,
        JSON.stringify(s.calibration),
        s.notes,
        JSON.stringify(s.sources),
      ],
    );
  }
  await client.query(
    "INSERT INTO spot_calibration_history(spot_id,version,calibration,notes) SELECT id,version,calibration,notes FROM surf_spots ON CONFLICT(spot_id,version) DO NOTHING",
  );
  // Exact, reviewed legacy names only. Never guess a break from a generic name.
  for (const [place, slug] of [
    ["Sao Pedro", "sao-pedro-estoril"],
    ["Pequena", "praia-pequena-sintra"],
    ["Carcavelos beach · west entrance (demo)", "carcavelos"],
    ["Guincho beach · school flag (demo)", "guincho"],
  ])
    await client.query(
      "UPDATE lessons SET spot_id=(SELECT id FROM surf_spots WHERE slug=$2) WHERE spot_id IS NULL AND place=$1",
      [place, slug],
    );
  await client.query("COMMIT");
  const counts = await client.query(
    "SELECT (SELECT count(*) FROM surf_spots)::int AS spots,(SELECT count(*) FROM lessons WHERE deleted_at IS NULL AND spot_id IS NULL)::int AS unmapped_lessons",
  );
  console.log("Staging migration complete:", counts.rows[0]);
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  await client.end();
}
