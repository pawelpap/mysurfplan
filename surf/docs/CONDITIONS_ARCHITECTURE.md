# Surf conditions on staging

Implemented on 5 September 2026. Production remains unchanged. The owner reviews this work in the staging app.

## Spots and lessons

Neon is the source of truth for bookable spots. A map service cannot provide the break identity, coaching constraints and calibration history needed here. Map links help locate a spot; they do not create bookable places automatically.

The staging catalogue has 17 records: São Pedro do Estoril, Bico, Bafureira, Carcavelos, Guincho, Cresmina, Abano, Parede, Tamariz, Praia Grande, Praia Pequena, Adraga, Praia das Maçãs, Magoito, São Julião, Praia de São João and Praia da Cornélia. Separate records distinguish São Pedro's breaks. The general São Pedro record preserves existing lessons without guessing which break was intended.

Every new or edited lesson requires an active `surf_spots.id`. Booking APIs also check the active spot. Public schedules exclude lessons without one. Legacy records remain available to their school, with a prompt to choose a spot. All existing staging lessons were mapped using reviewed exact place names; none remained unmapped after the migration. Meeting points remain free text within a selected spot.

Platform admins can add or edit spots from Conditions. Records hold country, region, coordinates, IANA time zone, break type, offshore sample coordinates, tide reference, local notes, sources and calibration JSON. Updates retain calibration history and reject concurrent edits using a version number. The form exposes the principal calibration controls; the JSON model can accept more detailed directional curves later.

Global spots use global forecast grids and their own local time zone. A compact index of 2,352 reusable TICON reference stations supports automatic tide-reference selection within 50 km. Coverage is not universal. A nearby station may still be unsuitable across a headland or estuary, so new references need local checking. No nearby reference produces an explicit missing-tide state, not invented tides. Adding other stations or providers does not require changing lesson records.

## Forecast providers and licensing

- [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api): explicitly request `ncep_gfswave025`, NOAA's global 0.25° wave model, for 16 days. The provider documents six-hourly model updates. Default marine best-match was tested and did not supply a complete 16-day local forecast, so it is not used here.
- [Open-Meteo Weather API](https://open-meteo.com/en/docs): best-match hourly wind, gusts, air temperature, weather code, rain probability and daylight for 16 days.
- Request one past day as interpolation padding. Join responses by Unix timestamps. Display dates and hours in the selected spot's time zone. No browser-time-zone conversion is used for lesson scheduling.
- [Open-Meteo terms](https://open-meteo.com/en/terms) restrict its free hosted endpoint to non-commercial use. The current configuration is for non-commercial evaluation. Before commercial use, configure a licensed `OPEN_METEO_API_KEY` or replace/self-host the provider. The adapter already switches to the customer weather and marine endpoints when a key is present. No subscription was purchased.

“Forecast fetched” means the app's last successful provider fetch. It is not a claim that the upstream weather model was issued at that time. A reload can return the same forecast when the provider has not published a newer run. Forecast days eight to sixteen are labelled as low-confidence long-range outlooks.

## Tides over the full 16 days

Open-Meteo's ocean sea-level model has a shorter horizon. The app instead calculates astronomical tides from open harmonic constants with [`@neaps/tide-predictor` 0.11.0](https://github.com/openwatersio/neaps), under MIT, and the [Neaps tide database](https://github.com/openwatersio/tide-database).

The catalogue is pinned to tide-database commit `c7e1aa84f50830f1b48a88d69bb1d853761baceb`. Station licences are checked individually. The bundled Cascais reference is `ticon/cascais-209-prt-uhslc_fd`, from [TICON-4](https://www.seanoe.org/data/00980/109129/), under CC BY 4.0. Its observation epoch is 6 November 2008 to 30 June 2025. The full station metadata and constants are retained in `db/seeds/cascais-tides.json`.

Predictions use 30-minute samples and refined high/low events. Heights are relative to mean sea level (MSL), with zero offset; they are **not chart-datum or lowest-astronomical-tide heights**. Storm surge is excluded. The UI identifies the gauge and its approximate distance. Cascais is a regional reference for the seeded spots; no unverified per-beach timing or range correction was applied. Admins can record verified time and range corrections later.

A plausibility check against the [Instituto Hidrográfico 2026 table](https://loja.hidrografico.pt/ln/web/wp-content/uploads/2023/11/TabelaMare_I_2026_signed.pdf), Cascais hourly values for 5 September, found matching turning-point hours: lows around 02:00 and 15:00 UTC, highs around 08:00–09:00 and 21:00–22:00 UTC. This is a limited time check, not validation of beach-level heights or forecast accuracy. The official table uses a different vertical datum.

## Local surf estimate

This is an explainable initial heuristic, not a calibrated coastal wave model. Sources describe tendencies but do not supply numerical transformation coefficients. The numerical gains, thresholds and weights are provisional engineering choices stored per spot so they can be improved using instructor observations.

Initial central surf estimate:

```
period factor = clamp((swell period / 10)^0.35, 0.70, 1.35)
local swell = offshore swell height × directional exposure × spot gain × period factor
surf = sqrt(local swell² + (0.35 × wind-wave height)²)
displayed range = 0.75 × surf to 1.25 × surf
```

The range is a heuristic range, not a statistical confidence interval. Directional exposure uses either a stored bearing curve or a shore-orientation curve. Missing wind-wave height omits that secondary term; missing primary swell or wind prevents assessment. Local wind can be adjusted for exposure and north-wind shelter. Wind arrows show travel; numerical bearings and compass labels describe the direction the wind or swell comes from.

Quality combines height suitability (40%), wind (30%), period (15%) and tide suitability (15%). Missing tide produces a clearly labelled partial score using the other weights. Low swell for a particular break reduces the score. Quality labels are Good at 75+, Fair at 50+, Poor at 30+ and Unfavourable below 30.

Experience is independent of quality:

| Initial estimated conditions                                                                                                | Experience label                      |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Central surf below 0.3 m                                                                                                    | Too small                             |
| Surf up to 0.9 m, adjusted wind up to 18 km/h, period up to 14 s                                                            | Beginner with instructor              |
| Surf up to 1.6 m and adjusted wind up to 25 km/h                                                                            | Intermediate                          |
| More demanding conditions                                                                                                   | Advanced                              |
| Surf above the spot's lesson limit (default 2.5 m), adjusted wind at least 35 km/h, gusts at least 45 km/h or thunderstorms | Instructor review; score capped at 25 |

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

On failure, a previous forecast is retained for at most 24 hours with its original fetch time and an explicit warning. Beyond that it is unavailable. Partial wave or weather failures are shown and missing inputs are never treated as calm conditions. There is no frozen forecast stored on a lesson: every request uses the current spot calibration and the latest shared provider data. Astronomical tides are recalculated from harmonic constants; they do not need a new weather-model run.

## Schema and deployment

`db/migrations/20260905_conditions.sql` adds `surf_spots`, `tide_stations`, `spot_calibration_history`, `spot_forecasts` and `lessons.spot_id`. The same DDL is included in `db/schema.sql` for new installations. Run the seed/migration only with a verified staging connection:

```
node scripts/migrate-conditions.mjs --staging
```

The migration is additive and seeds use `ON CONFLICT DO NOTHING` to preserve subsequent edits. Staging branch `br-small-salad-adx0nsj2` has been migrated. Production branch `br-gentle-dawn-ad5l1p9y` has not.

Deploy GitHub `staging` through Vercel project `mysurfplan-staging`, root `surf`. A preview generated in the separate production project is not a production promotion. Do not move the production alias or push `main` without owner approval.

## Verification

- Unit checks cover independent quality/experience, missing inputs, Bico/Bafureira tide rules, dangerous conditions, circular bearings, lesson intervals, global time zones, daylight-saving gaps, provider model selection and sixteen days of harmonic tides.
- Local integration checks against staging covered all 17 spots, each with 16 complete days and 408 hourly provider entries including padding, without provider issues at the time of the check.
- The lesson endpoint returned start/end tides and four assessment samples for a two-hour lesson starting at 11:30. A real green Carcavelos forecast correctly required Intermediate experience and warned on the Beginner demo lesson.
- Anonymous access, cross-school lesson access, unassigned instructor access and student spot edits were rejected. Missing or unknown spot IDs could not create or edit lessons.
- A forced refresh advanced the fetch timestamp; an immediate repeat used the same timestamp.
- A browser-created Bico demo lesson saved at 09:15 Europe/Lisbon on 11 September. Temporarily clearing its spot blocked booking with HTTP 409 and excluded it from the public schedule; the original spot was restored and no booking was inserted.
- Saving Bico through the spot form retained its tide rule and offshore reference and created calibration history version 2.
- All 17 automated tests and the final Node.js 22 production build passed.
- Desktop and 390 px phone layouts were inspected. Mobile forecast-strip overflow and scaled-down tide labels were corrected during verification.

Production verification and long-term calibration accuracy are not claimed by this staging pass. Instructor-account linking and the existing session-hardening backlog remain separate workstreams.
