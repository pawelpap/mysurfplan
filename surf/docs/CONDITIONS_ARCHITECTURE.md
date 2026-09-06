# Surf conditions algorithm and architecture

Implemented and promoted to production on 5 September 2026. Documentation reviewed against the source code on 6 September 2026. The conditions module is live in both staging and production.

For the complete spot schema, coefficient definitions and a current Bico calibration example, see [Spot data model and local coefficients](SPOT_DATA_MODEL.md). The calculation is implemented in [`scoreConditions()`](../lib/conditions/model.mjs); provider selection is in [`provider.mjs`](../lib/conditions/provider.mjs), and tide calculation is in [`tides.mjs`](../lib/conditions/tides.mjs).

## Generic database calibration, 6 September 2026

The new engine reads a complete, schema-validated configuration from PostgreSQL for every spot. All tunable wave, wind, tide, quality, experience and warning parameters have moved into versioned configuration. Named Bico/Bafureira tide presets and north-only shelter logic are replaced by generic tide rules, direction curves and shelter sectors. Swell energy and water temperature are described in [their method reference](SWELL_ENERGY_AND_WATER_TEMPERATURE.md). The historical sections below describe the initial assumptions, which the migration preserves. The [current schema reference](SPOT_DATA_MODEL.md) describes storage, editing, revision history and defaults.

## Spots and lessons

Neon is the source of truth for bookable spots. A map service cannot provide the break identity, coaching constraints and calibration history needed here. Map links help locate a spot; they do not create bookable places automatically.

The initial catalogue in both environments has 17 records: São Pedro do Estoril, Bico, Bafureira, Carcavelos, Guincho, Cresmina, Abano, Parede, Tamariz, Praia Grande, Praia Pequena, Adraga, Praia das Maçãs, Magoito, São Julião, Praia de São João and Praia da Cornélia. Separate records distinguish São Pedro's breaks. The general São Pedro record preserves existing lessons without guessing which break was intended.

Every new or edited lesson requires an active `surf_spots.id`. Booking APIs also check the active spot. Public schedules exclude lessons without one. Legacy records remain available to their school, with a prompt to choose a spot. All existing staging lessons were mapped using reviewed exact place names; none remained unmapped after the migration. Meeting points remain free text within a selected spot.

Platform admins can add or edit spots from Conditions. Records hold country, region, coordinates, IANA time zone, break type, offshore sample coordinates, tide reference, local notes, sources and calibration JSON. Updates retain calibration history and reject concurrent edits using a version number. The form exposes the principal calibration controls, wave-model selection and validated directional exposure curves. Only the exact `platform_admin` role may write spots; the legacy `admin` alias is excluded.

Global spots use global forecast grids and their own local time zone. A compact index of 2,352 reusable TICON reference stations supports automatic tide-reference selection within 50 km. Coverage is not universal. A nearby station may still be unsuitable across a headland or estuary, so new references need local checking. No nearby reference produces an explicit missing-tide state, not invented tides. Adding other stations or providers does not require changing lesson records.

## Forecast providers and licensing

- [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api): use `ncep_gfswave025`, NOAA's global 0.25° wave model, by default for 16 days. São Pedro, Bico and Bafureira use `ncep_gfswave016` with a sample near the spot. This finer model covers 15°S to 52.5°N; the admin form rejects it outside that latitude range. The provider documents six-hourly model updates. Default marine best-match was tested and did not supply a complete 16-day local forecast, so it is not used here.
- [Open-Meteo Weather API](https://open-meteo.com/en/docs): best-match hourly wind, gusts, air temperature, weather code, rain probability and daylight for 16 days.
- Request one past day as interpolation padding. Join responses by Unix timestamps. Display dates and hours in the selected spot's time zone. No browser-time-zone conversion is used for lesson scheduling.
- [Open-Meteo terms](https://open-meteo.com/en/terms) restrict its free hosted endpoint to non-commercial use. The current configuration is for non-commercial evaluation. Before commercial use, configure a licensed `OPEN_METEO_API_KEY` or replace/self-host the provider. The adapter already switches to the customer weather and marine endpoints when a key is present. No subscription was purchased.

“Forecast fetched” means the app's last successful provider fetch. It is not a claim that the upstream weather model was issued at that time. A reload can return the same forecast when the provider has not published a newer run. Forecast days eight to sixteen are labelled as low-confidence long-range outlooks.

## Tides over the full 16 days

Open-Meteo's ocean sea-level model has a shorter horizon. The app instead calculates astronomical tides from open harmonic constants with [`@neaps/tide-predictor` 0.11.0](https://github.com/openwatersio/neaps), under MIT, and the [Neaps tide database](https://github.com/openwatersio/tide-database).

The catalogue is pinned to tide-database commit `c7e1aa84f50830f1b48a88d69bb1d853761baceb`. Station licences are checked individually. The bundled Cascais reference is `ticon/cascais-209-prt-uhslc_fd`, from [TICON-4](https://www.seanoe.org/data/00980/109129/), under CC BY 4.0. Its observation epoch is 6 November 2008 to 30 June 2025. The full station metadata and constants are retained in `db/seeds/cascais-tides.json`.

Predictions use 30-minute samples and refined high/low events. Heights are relative to mean sea level (MSL), with zero offset; they are **not chart-datum or lowest-astronomical-tide heights**. Storm surge is excluded. The forecast response retains the gauge and its approximate distance; provider attribution is available on the Legal page. Cascais is a regional reference for the seeded spots; no unverified per-beach timing or range correction was applied. Admins can record verified time and range corrections later.

A plausibility check against the [Instituto Hidrográfico 2026 table](https://loja.hidrografico.pt/ln/web/wp-content/uploads/2023/11/TabelaMare_I_2026_signed.pdf), Cascais hourly values for 5 September, found matching turning-point hours: lows around 02:00 and 15:00 UTC, highs around 08:00–09:00 and 21:00–22:00 UTC. This is a limited time check, not validation of beach-level heights or forecast accuracy. The official table uses a different vertical datum.

## Local surf estimate

This is an explainable initial heuristic, not a calibrated coastal wave model. Sources describe tendencies but do not supply numerical transformation coefficients. The numerical gains and thresholds are provisional engineering choices. Local coefficients are stored per spot so they can be improved using instructor observations; score weights and thresholds are also stored in the database in the generic release.

Initial central surf estimate:

```
period factor = clamp((max(swell period, 1) / periodReference)^periodExponent, 0.70, 1.35)
local swell component = component height × directional exposure × spot gain × period factor
local wind sea = 0.35 × wind-wave height × its directional exposure
surf = sqrt(sum(local swell component²) + local wind sea²)
displayed range = 0.75 × surf to 1.25 × surf
```

The default period reference is 10 seconds and exponent is 0.35; both are stored per spot. The range is a heuristic range, not a statistical confidence interval. Directional exposure uses either a stored bearing curve or a shore-orientation curve. Primary, secondary and tertiary swell partitions are transformed individually, so a useful secondary swell is not discarded when the primary swell is blocked. Missing wind-wave height or direction omits the wind-sea term; missing primary swell or wind prevents assessment. The dominant local swell contribution supplies the period and offshore swell height used for period, experience and tide preferences. Local wind can be adjusted for exposure and north-wind shelter. Wind arrows show travel; numerical bearings and compass labels describe the direction the wind or swell comes from.

Tide suitability affects quality, while local wind affects both quality and experience assessment. They do not directly change the estimated surf-height range in the current implementation. The wave-height calculation above is separate from the quality score below.

Quality combines height suitability (40%), wind (30%), period (15%) and tide suitability (15%). Missing tide produces a clearly labelled partial score using the other weights. Low swell for a particular break reduces the score. Quality labels are Good at 75+, Fair at 50+, Poor at 30+ and Unfavourable below 30. Central surf below 0.3 m is labelled Flat / too small and capped at 25 × surf / 0.3; the size ceiling then rises continuously through 49 at 0.5 m to 100 at 0.65 m. This prevents a small height difference from jumping directly from Poor to Good. Favourable wind or tide cannot make flat surf green.

Experience is independent of quality:

| Initial estimated conditions                                                                                                | Experience label                      |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Central surf below 0.3 m                                                                                                    | Not applicable                        |
| Surf up to 0.9 m, adjusted wind up to 18 km/h, period up to 14 s                                                            | Beginner                              |
| Surf up to 1.6 m and adjusted wind up to 25 km/h                                                                            | Intermediate                          |
| More demanding conditions                                                                                                   | Advanced                              |
| Surf above the spot's lesson limit (default 2.5 m), adjusted wind at least 35 km/h, gusts at least 45 km/h or thunderstorms | Advanced; score capped at 25           |

A break's minimum level can raise the required experience. These thresholds do not model currents, shorebreak, exposed rocks, individual competence or local closures. Lessons show the highest required level and lowest quality across the start, each intervening forecast hour and the end. They warn if that experience exceeds the lesson's advertised level. Instructor judgement at the beach remains necessary.

Tide stage is low/mid/high relative to neighbouring predicted minima/maxima. Bico favours low tide, widening to mid tide above an initial 1.5 m offshore-swell threshold. Bafureira favours mid-high tide and has an initial 1.2 m minimum swell preference. These rules combine the owner's observations with local surf-school guidance.

Local sources, linked from each spot where relevant:

- [Surf Cascais beach guide](https://www.surfcascais.com/pt/post/cascais-surf-spots): break characteristics and general wind/tide preferences.
- [Cascais municipal beach guide](https://360.cascais.pt/pt/visitar/praia-de-s-pedro-do-estoril?id=276) and [Carcavelos](https://360.cascais.pt/pt/visitar/praia-de-carcavelos): beach identity and location.
- [Visit Sintra beaches](https://visitsintra.travel/en/visit/beaches): local beach identity and descriptions.
- [Almada municipality](https://www.cm-almada.pt/visitar/passear/praias-visitar) and [Azonda Surf Club](https://www.azondasurfclub.com/a-nossa-praia): Caparica beach context.
- [NOAA wave exposure modelling](https://coastalscience.noaa.gov/products/wave-exposure-model-wemo/): context for why exposure, bathymetry and local geography matter. This app does not implement WeMo.

Most seed coordinates are approximate beach/break points. Offshore sample points deliberately sit at sea; the provider's returned marine grid is retained. Sandbanks, shoaling, refraction, breaking shape and changing local hazards are not resolved. Future calibration should record observed surf height, period, wind, tide, break, instructor assessment and the forecast/model timestamp.

## Freshness and failure behaviour

Opening or reloading either Conditions or a lesson requests a fresh forecast. Manual “Check for updates” does the same. Requests within two minutes share the latest result to limit duplicate upstream calls.

While a screen remains open, it checks every five minutes when visible, and when focused after one minute. Normal shared cache expiry is 15 minutes. Partial provider data expires after ten minutes. Provider fetches use `no-store`; browser responses are private and not cached. A database lease prevents duplicate refreshes across server instances, with a five-minute retry back-off after total provider failure.

Provider cache version, wave-model identifier and sample coordinates must match the spot. Incompatible cached inputs are refreshed and cannot be scored under a different source configuration. On failure, a compatible previous forecast is retained for at most 24 hours with its original fetch time and an explicit warning. Beyond that it is unavailable. Partial wave or weather failures are shown and missing inputs are never treated as calm conditions. There is no frozen forecast stored on a lesson: every request uses the current spot calibration and the latest shared provider data. Astronomical tides are recalculated from harmonic constants; they do not need a new weather-model run.

## Schema and deployment

`db/migrations/20260905_conditions.sql` adds `surf_spots`, `tide_stations`, `spot_calibration_history`, `spot_forecasts` and `lessons.spot_id`. The same DDL is included in `db/schema.sql` for new installations. Run the seed/migration only with a verified staging connection:

```
node scripts/migrate-conditions.mjs --staging
```

The migration is additive and seeds use `ON CONFLICT DO NOTHING` to preserve subsequent edits. Staging uses Neon branch `br-small-salad-adx0nsj2`. Production uses `br-weathered-silence-adp30k9s`, copied from staging after the approved merge of production-only records. Both include the conditions migrations. The previous production branch `br-gentle-dawn-ad5l1p9y` is retained for rollback. See [deployment and database release notes](README-staging.md).

Deploy GitHub `staging` through Vercel project `mysurfplan-staging`, root `surf`. A preview generated in the separate production project is not a production promotion. Do not move the production alias or push `main` without owner approval.

## Initial staging verification, 5 September 2026

- Unit checks cover independent quality/experience, missing inputs, Bico/Bafureira tide rules, dangerous conditions, circular bearings, lesson intervals, global time zones, daylight-saving gaps, provider model selection and sixteen days of harmonic tides.
- Local integration checks against staging covered all 17 spots, each with 16 complete days and 408 hourly provider entries including padding, without provider issues at the time of the check.
- The lesson endpoint returned start/end tides and four assessment samples for a two-hour lesson starting at 11:30. A real green Carcavelos forecast correctly required Intermediate experience and warned on the Beginner demo lesson.
- Anonymous access, cross-school lesson access, unassigned instructor access and student spot edits were rejected. Missing or unknown spot IDs could not create or edit lessons.
- A forced refresh advanced the fetch timestamp; an immediate repeat used the same timestamp.
- A browser-created Bico demo lesson saved at 09:15 Europe/Lisbon on 11 September. Temporarily clearing its spot blocked booking with HTTP 409 and excluded it from the public schedule; the original spot was restored and no booking was inserted.
- Saving Bico through the spot form retained its tide rule and offshore reference and created calibration history version 2.
- All 17 automated tests and the final Node.js 22 production build passed.
- Desktop and 390 px phone layouts were inspected. Mobile forecast-strip overflow and scaled-down tide labels were corrected during verification.

The initial staging pass did not establish long-term calibration accuracy. Subsequent production promotion verified matching schema and business records, logins, student spot permissions, forecasts and lesson conditions in both environments. Instructor-account linking and the existing session-hardening backlog remain separate workstreams.

Staging deployment `dpl_Ht1GcpjdBvVGT8VRZwzFaBcs2HTM` (code `3b0d00b`) was verified on staging.mywaveplan.com on 5 September 2026. Desktop at 1440 px and mobile at 390 px showed all sixteen days; the final day included four tide events. The Bico demo lesson is `7b9c9b35-7425-4614-bc32-c140c64ff58c`. This records the initial staging pass; later corrections and the production release supersede that deployment.

## Light times and student review account

The default hourly view starts at 06:00 in the spot's local time. It runs to the first whole hour at or after last light, with a minimum evening end of 18:00 and a latest end of 23:00. Where light times are unavailable it ends at 21:00; polar daylight extends to 23:00. The All hours control retains the complete day.

First light, sunrise, sunset and last light are labelled directly on the tide chart, with vertical markers and shaded night, twilight and daylight periods. If a tide curve is unavailable, a separate light-time summary remains visible. [SunCalc 2.0.2](https://github.com/mourner/suncalc), under BSD-2-Clause, calculates solar events using the spot's coordinates and local calendar date. First/last light use [civil twilight](https://www.weather.gov/lmk/twilight-types), with the sun's centre six degrees below the horizon. Missing polar events are labelled rather than converted to invalid or zero times. Calculations cover all 16 days independently of weather API availability. Local obstructions and cloud cover can change usable light.

The review login `teststudent`, available in both environments, belongs to the student role and the demo school. Its internal contact address is `teststudent@example.com`. An optional `users.username` field allows that login while retaining email login for existing users. Apply `db/migrations/20260905_login_usernames.sql` to an existing environment before deploying the username-aware login route. New installations include it in the canonical schema. No test password is stored in source control.

Only the exact `platform_admin` role can add or edit spots. Students can select spots and read forecasts; neither the controls nor direct write requests permit spot administration. The same test login was included in the approved production promotion and is available in both environments.

## São Pedro direction correction, 5 September 2026

The original curve admitted 50% of offshore swell height at 300°, and the wind-sea term bypassed coastal shelter. Both overestimated this sheltered coast. The owner reported Surfline showing approximately 272° on Monday 7 September, 283° on Tuesday 8 September and flat conditions with more northerly swell later in the week. These are owner-reported observations; the live Surfline values could not be independently read from its public page.

A direct model comparison at midday returned GFS 0.25° at the original offshore grid (38.5, −9.5): Monday 289°, Tuesday 298°. GFS 0.16° near São Pedro (returned grid 38.666668, −9.333328): Monday 274° / 1.24 m / 12.5 s; Tuesday 282° / 0.84 m / 9.85 s; Wednesday 294°. The finer grid is selected as a more local 16-day input. This comparison does not establish general accuracy or justify a constant bearing correction. Raw provider bearings remain unchanged. [Surfline describes LOTUS as its own model with nearshore modelling and bathymetry](https://support.surfline.com/hc/en-us/articles/4410495359643-What-is-LOTUS), so its readings need not match GFS.

`20260905_sao_pedro_exposure.sql` updates only the three São Pedro profiles, preserves tide settings and stores a new calibration history version. The initial exposure falls from 0.85 at 270° to 0.65 at 275°, 0.18 at 282°, 0.02 at 290° and 0.005 at 300°. The 282° transition is owner guidance, not a measured universal cutoff. Non-zero residual exposure allows for some wrap on very large swell; this heuristic does not resolve bathymetric refraction or directional spreading. Instructor observations should refine the curve. This migration was included in the approved production release. On a new database, apply it after the initial seed.

On mobile, hourly forecasts use compact expandable cards with time, estimated surf, quality, experience, wind and tide visible in the summary. Expanded content includes directions, period, gusts, weather and swell components. Desktop retains the comparison table.

The tide graph itself selects the time: mouse movement or touch/drag updates the tide marker, readout and all selected-time conditions, including quality, experience, swell, wind and weather. The midpoint forecast is interpolated from hourly inputs, then scored with the same shared model used for lessons. Keyboard arrows move one half-hour sample; Home/End choose the day bounds. Vertical touch gestures retain page scrolling. The separate range slider and technical prediction caption were removed. Provider credits and technical notes are removed from the forecast and lesson screens. Required data attribution is available on the separate Legal page. Forecast update time and measurement units remain visible.

Final local follow-up checks: owner email login and test-student username login passed. Student spot POST/PUT both returned 403. All three São Pedro forecasts returned 16 days without provider issues. Bico at 12:00 on Monday 7 September returned Good 82/100, Intermediate, 0.5–0.8 m; Tuesday returned Flat / too small, 0.1 m. The Friday Bico demo lesson consistently returned Flat / too small and Too small, using the same model.

## Caparica regional sampling

On 5 September the owner reported a large discrepancy between São João and Cornélia. Their old 0.25° queries selected different grid cells: 38.75, −9.5 for São João and 38.5, −9.25 for Cornélia. These are too far apart to use as comparable inputs for neighbouring beaches. A finer common sample was compared, but the owner identified São João’s existing forecast as the better reference. Both now use São João’s established sample at 38.66, −9.37 with GFS 0.25°, returning grid 38.75, −9.5. Direct provider checks found Cornélia’s original grid returned zero swell and zero wind sea throughout the checked week. The provider now rejects entirely zero-filled wave payloads as unavailable, instead of reporting them as confirmed flat conditions. Separate local shoreline orientation, gain, weather and tide settings remain. The correction is spatial and applies to every forecast date. `20260905_caparica_wave_sample.sql` records the change in calibration history and expires incompatible cached forecasts.

A second discrepancy came from a discontinuous score cap at 0.5 m. The shared scoring model now increases the size ceiling continuously, while keeping surf below 0.3 m classified as Flat / too small. This applies to all spots and lesson forecasts.

Experience wording is Beginner, Intermediate or Advanced. The internal severe-condition state still flags demanding conditions but is displayed as Advanced; flat conditions have no applicable experience level. The demo school is now named Demo Surf School.

Live follow-up verification found that simultaneous requests could show an empty forecast while another request replaced an incompatible cache entry. Requests without a usable forecast now wait up to 15 seconds for that shared refresh. Four concurrent requests were verified to receive the same complete 408-hour payload. The Node.js 22 build passed. Live mobile checks confirmed the experience wording on both forecasts and lessons, no horizontal overflow, and all summary metrics changing with graph selection.
