# Spot data model and local calibration

Updated 6 September 2026 for the database calibration release. Deployment status is recorded in the development plan.

## Data ownership

PostgreSQL stores the complete calibration for each spot, validated against a versioned JSON Schema. The shared JavaScript engine contains mathematical operations and rule evaluation, without a spot-name switch or fallback calibration constants. Geographic seed files and the legacy conversion script are installation/migration inputs; the running app does not import them.

- `calibration_schema_versions`: immutable schema versions, with types, units, required fields, limits and editor labels. The initial generic version is 3.
- `surf_calibration_profiles`: immutable, reusable profile versions containing a complete configuration, name, change note, author and source references.
- `surf_calibration_settings`: identifies the database profile/version to use for new spots.
- `surf_spots`: spot identity, coordinates, ocean sampling coordinates, time zone, break type, tide station, source notes and current complete `calibration_config`. It references the schema version and originating profile/version. `display_order` controls the first spot in the selector.
- `spot_calibration_history`: every saved configuration with version, schema version, change note, source references, notes, author and date. Restoring an earlier configuration creates a new revision.

Each spot stores a complete configuration copied from its starting profile. Later changes to a shared default do not silently affect existing spots. There is no implicit override merge during forecasting. A profile can be loaded into the admin editor and reviewed before saving to a spot.

The older `surf_spots.calibration` JSON column remains as a rollback record for pre-migration spots. The current engine never reads it. Existing historical revisions are retained; only compatible schema versions can be restored through the new editor.

Exact table definitions are in [`20260906_calibration_profiles.sql`](../db/migrations/20260906_calibration_profiles.sql). The complete schema and initial profile are installed from [`calibration-schema-v3.json`](../db/seeds/calibration-schema-v3.json) and [`calibration-default-v3.json`](../db/seeds/calibration-default-v3.json). These seed files are not runtime defaults.

## Generic configuration

The following groups are all stored in the database and editable by platform admins:

| Group | Settings |
| --- | --- |
| Ocean inputs | Wave-model selection; sample coordinates are separate spot columns. |
| Wave transformation | Shore orientation, swell gain, period reference/exponent and multiplier limits, wind-sea gain, and displayed surf-range factors. |
| Directional exposure | A stored swell-direction curve, or orientation/spread/floor/exponent fallback; a wind-direction curve and optional additional shelter sectors. |
| Tide | Generic rules with offshore-swell thresholds and preferred tide-ratio ranges, suitability penalties, reference timing/height corrections, and stage/trend thresholds. |
| Quality | Height/period suitability curves, wind suitability settings, component weights, small-swell penalty, flat threshold, continuous size ceiling and quality bands. |
| Experience | Ordered height/wind/period limits, the break's minimum experience, maximum lesson surf and severe weather thresholds. |
| Explanations | Tide-fit, directional exposure and wind thresholds for condition explanations. |

A direction curve is an array of `[bearing degrees, multiplier]` pairs. Bearings are incoming directions. Curves start at 0°, finish at 360°, match at north and interpolate linearly. A wind shelter sector contains `from`, `to` and `gain`; sectors may wrap through north and apply at their inclusive boundaries. Curves and sectors can describe shelter from any direction.

Generic tide rules are sorted by `minimumSwell`. The last threshold reached by the offshore height of the dominant local swell contribution determines the preferred tide range. The first rule starts at zero. Bico's migrated rules are:

```json
[
  { "minimumSwell": 0, "low": 0, "high": 0.35 },
  { "minimumSwell": 1.5, "low": 0, "high": 0.7 }
]
```

Bafureira uses the same rule evaluator with `low: 0.4` and `high: 1`, plus its separate minimum-swell setting. Neither name appears in runtime rule selection. Tide ratio is the height's relative position between nearby low and high tides. Tide suitability affects quality; it does not directly change surf height or required experience.

## Validation and versions

The `pg_jsonschema` extension enforces JSON types, required fields and ranges at the database boundary. `validate_surf_configuration()` also checks curve order, north continuity, tide boundaries, weight totals, quality bands and experience-rule ordering. The API performs equivalent checks before writing. Missing configuration produces an error; it is not replaced with a code default.

Spot edits require the current `version`, and concurrent stale edits return HTTP 409. Profile revisions are immutable. Default-profile updates create a new version and update the default pointer atomically. Only the exact `platform_admin` role may read the calibration editor settings or write calibration. Students can read spot forecasts and their configuration but cannot edit them.

Forecast responses identify the engine version, schema version, spot version and originating profile/version. Raw provider inputs are cached separately from calculated scores. Every request evaluates the latest saved spot configuration; changing coefficients does not require re-fetching identical ocean inputs. Changing the provider model or sample point invalidates incompatible inputs. Selected-time summaries use the configuration returned with that forecast, so they match its hourly scores.

## Admin workflow

Open Conditions, choose a spot and select Edit spot. Location and availability are at the top. Expand the calibration groups to edit individual numbers, curve points or tide rules. Record supporting observations and a reason for the change before saving. Previous compatible versions can be loaded and saved as a new revision. The default-profile control explicitly affects future spots only.

New spots start from a database profile and use the same editor. Ocean sample coordinates can be entered separately. A configured tide station can be selected, or the app can look for a nearby reference. An absent temperature, tide or wave input is not converted into zero.

## Read-only SQL examples

```sql
SELECT slug, version, calibration_schema_version,
       calibration_profile_id, calibration_profile_version,
       jsonb_pretty(calibration_config) AS configuration
FROM surf_spots
WHERE slug = 'sao-pedro-bico';

SELECT version, schema_version, calibration, change_note, sources, created_at
FROM spot_calibration_history
WHERE spot_id = (SELECT id FROM surf_spots WHERE slug = 'sao-pedro-bico')
ORDER BY version;
```

See [Conditions algorithm and architecture](CONDITIONS_ARCHITECTURE.md) for the calculation and research sources. Coefficients remain initial heuristics pending local observational calibration; moving them to a validated database schema does not itself establish forecast accuracy.
