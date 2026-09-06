# São Pedro WNW swell calibration

6 September 2026. The owner authorised this local calibration on staging and production, including Bico and Bafureira while preserving their distinct behaviour.

## Evidence and scope

The owner reports that a small WNW swell near 283° can still generate moderately favourable surf at São Pedro. The supplied Surfline screenshots show Tuesday 8 September at 08:00: 0.9 m swell, 10 s period, WNW 283°, 0.3–0.6 m surf and a Poor to fair rating. Tide is 0.9 m, shortly after a 0.8 m low and before a 3.0 m high. These are forecast comparison data supported by local knowledge, not measured beach observations. The screenshot is the dated reference; the [public Surfline page](https://www.surfline.com/surf-report/s%C3%A3o-pedro-do-estoril/640b9d679b6fab7dac307b39) does not independently expose that exact historical forecast snapshot.

The existing curve reduced a 283° swell to an exposure multiplier of about 0.147 before applying swell gain and period response. This made the reference input almost flat. The revised curve retains useful WNW swell around 280–283°, then falls sharply towards 290°. The existing separate tide rules remain supported by the owner's prior observations and the [Surf Cascais spot guide](https://www.surfcascais.com/pt/post/cascais-surf-spots).

Only `exposureByDirection` and `sizeCeilingCurve` changed in each spot's database `calibration_config`. Notes, evidence sources and immutable revision history record the reason. No page logic, shared calculation-engine code, schema, provider data or bearing offset changed. The same parameters apply on every date, to each swell partition and the wind sea through the existing generic evaluator.

## Parameter change

The following points define the revised incoming swell-direction multiplier. Intermediate bearings use the existing linear interpolation. Other points, including 0–270° and 290–360°, are unchanged.

| Bearing | Previous multiplier | Revised multiplier |
| --- | ---: | ---: |
| 275° | 0.65 | 0.72 |
| 280° | 0.32 | 0.70 |
| 282° | 0.18 | 0.69 |
| 283° | 0.147, interpolated | 0.68 |
| 285° | 0.08 | 0.35 |
| 290° | 0.02 | 0.02 |
| 300° | 0.005 | 0.005 |

The local small-wave score ceiling is now `[[0,0],[0.3,25],[0.45,60],[0.65,100]]`, replacing `[[0,0],[0.3,25],[0.5,49],[0.65,100]]`. The first coordinate is the engine's central local surf estimate in metres, before the displayed range; the second is a maximum score, not an awarded score. This permits Fair at a small but rideable size without increasing swell height merely to cross a scoring threshold. The 0.3 m flat threshold and its 25-point ceiling are unchanged, as are the Good boundary and the uncapped-size threshold of 0.65 m. Wind, period, tide, minimum-swell and severe-condition constraints still apply.

These values remain a provisional local calibration. One forecast comparison does not establish predictive accuracy, especially for large, long-period swells near the edge of a headland's shelter.

## Preserved break behaviour

- Bico retains low tide preference, a wider low-to-mid range once the dominant useful offshore swell reaches 1.5 m, a 0.72 swell gain and Intermediate minimum experience.
- Bafureira retains its mid-to-high tide range, 1.2 m minimum-swell setting and 0.65 penalty below it, a 0.68 swell gain and Intermediate minimum experience. It is consequently less favourable than Bico for this small morning swell.
- The general São Pedro entry retains its broader low-to-mid tide range and Beginner minimum experience. Stronger conditions can still require higher experience.
- The other 14 spots and shared default profile are unchanged. Energy and water-temperature calculations are unchanged.

## Reference results

For the supplied 0.9 m / 10 s / 283° swell, using a low tide ratio of 0.05 and controlled northerly 16 km/h wind inputs, São Pedro and Bico calculate 0.3–0.6 m, Fair, 58/100. Bafureira calculates 0.3–0.5 m, Poor, 46/100 at low tide and Fair, 52/100 at a favourable mid tide. The wind bearing and weather in this test are controlled inputs, not additional facts read from the screenshot. Tide heights use different datums between providers; only the position within the tidal cycle is compared.

The app's refreshed provider data during verification had a primary swell of 0.88 m / 10.25 s / 280° for Tuesday at 08:00. That input was not overwritten to match Surfline.

| Spot | Tuesday 08:00 before | Tuesday 08:00 after | Tuesday 12:00 after |
| --- | --- | --- | --- |
| São Pedro | 0.2–0.3 m, Flat / too small, 17 | 0.3–0.6 m, Fair, 59 | 0.3–0.5 m, Fair, 50 |
| Bico | 0.2–0.3 m, Flat / too small, 17 | 0.3–0.6 m, Fair, 59 | 0.3–0.5 m, Fair, 50 |
| Bafureira | 0.1–0.2 m, Flat / too small, 16 | 0.3–0.5 m, Poor, 49 | 0.3–0.5 m, Poor, 45 |

The weaker and more northerly Wednesday–Friday snapshot remains flat, too small or unfavourable. Monday's useful westerly swell retains its Good periods. Future refreshed inputs may change these forecast values naturally.

## Verification and rollback

All 49 automated tests and the production build passed. Five added calibration regressions cover the screenshot reference, distinct break rules, continued northern shelter, flat-wave protection, experience escalation, smooth interpolation, secondary swell, date independence and lesson consistency. The old migration fixtures remain frozen and explicitly labelled historical. The new test-only fixture records the database adjustment and is never imported by the running app.

The update is saved through the existing platform-admin API with schema validation, a current-version check and an atomic history entry per spot. Previous configurations remain in `spot_calibration_history`; restoring them through the admin editor creates another revision. Do not restore the legacy `calibration` column, which the current engine does not read.

| Spot | Previous version | New version |
| --- | ---: | ---: |
| São Pedro | 3 | 4 |
| Bico | 4 | 5 |
| Bafureira | 3 | 4 |

Staging and production each passed checks for all 1,224 returned hourly assessments across the three spots, configuration/version freshness, all 16 forecast days, unchanged unrelated spots and student write denial. Desktop and mobile browser checks at 1440 and 390 px verified selected-day metrics, quality colour, time selection and width on both domains. Browser testing used Chromium desktop/mobile emulation. Direct Neon reads confirmed all 17 calibration hashes and versions match between environments, and that each updated spot has a matching history entry. The 14 unrelated spots were also compared against the before-update snapshots and remained unchanged.

This is a database-only forecasting release. Existing deployed app code reads the new configuration on its next forecast request, including lesson requests, without a code rebuild or provider-cache rewrite. Reload an already-open Conditions page to fetch the revised configuration immediately.
