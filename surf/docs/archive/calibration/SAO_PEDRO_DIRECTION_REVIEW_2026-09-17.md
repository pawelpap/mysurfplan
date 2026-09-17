# São Pedro provider-direction review

17 September 2026. Investigation and subsequent owner-authorised staging trial. This is a new comparison for Saturday 19 September, separate from the closed 15 September investigation. The owner instructed: “We need to make some assumption and improve swell direction calibration rule.” A provisional database exposure curve is now applied to Bico and Bafureira on staging. Scoring code, provider selection and displayed raw bearings are unchanged. Production remains on hold.

## Finding

The owner clarified that the useful WNW limit around 283° describes their experience with **Surfline's** bearings. It must not be treated as a universal numerical cut-off for GFS. The current GFS-based Bico and Bafureira configurations retain the steep 283–290° exposure transition from the earlier local review. Saturday's GFS components arrive around 299–306°, where that curve admits only approximately 0.4–0.7% of component height before the other multipliers. This is the main reason for the almost-flat local estimates, despite light morning winds.

This mismatch warrants reviewing the local transformation against its actual provider and sample grid. It does not establish a constant direction bias, an error in the displayed bearings, or Saturday's real surf conditions. Surfline is another forecast, not a beach observation.

## Sources and timing

- Baseline staging API saved at 11:17 UTC on 17 September. Bico's provider fetch was `2026-09-17T11:14:00.846Z`; Bafureira's was `2026-09-17T11:13:55.836Z`. No provider issues were reported. Model: GFS Wave 0.16°, returned grid `38.666668, -9.333328`. Baseline staging spot revisions: Bico 7, Bafureira 6. Fetch time is not a provider issue time; the latter is unavailable.
- The owner's open [São Pedro Surfline table](https://www.surfline.com/surf-report/s-o-pedro-do-estoril/640b9d679b6fab7dac307b39?view=table) was inspected on 17 September around 12:20–12:30 WEST. Its displayed run was 17 September 00 UTC. It describes the general São Pedro spot, not separate Bico and Bafureira forecasts.
- Surfline height, period, surf range and rating were read from the rendered table. Its arrows' rendered SVG rotation supplies the direction of travel; the incoming bearings below add 180° and normalise. The current noon arrow (108.9°) agrees with the page's explicit incoming WNW 289° label. Decimal bearings are a reading of those rendered arrows, not an independent provider API response.
- [Open-Meteo's variable definitions](https://open-meteo.com/en/docs/marine-weather-api#hourly-parameter-definition) define swell directions as incoming mean bearings. Our adapter maps these directly to the corresponding swell components. There is no added angular correction in the application.
- [Surfline's LOTUS description](https://support.surfline.com/hc/en-us/articles/4410495359643-What-is-LOTUS) describes a different model with nearshore modelling and bathymetry. This can explain differences in principle; it does not identify the numerical cause of this particular discrepancy.

## Like-for-like checks

All times are Europe/Lisbon. Components are paired by similar period and timing, not by their primary/secondary label alone. These are plausible comparisons, not verified identification of the same spectral partition. GFS and Surfline also differ in component height and period definitions.

| Valid time | Surfline component | Similar-period GFS component | GFS minus Surfline direction |
| --- | --- | --- | ---: |
| 19 Sep 06:00 | Primary 1.0 m, 15 s, about 283° | Secondary 0.54 m, 14.95 s, 299° | +16° |
| 19 Sep 09:00 | Primary 1.1 m, 15 s, about 285.9° | Secondary 0.52 m, 15.1 s, 300° | +14.1° |
| 19 Sep 12:00 | Primary 1.0 m, 14 s, about 286.5° | Secondary 0.54 m, 14.6 s, 299° | +12.5° |
| 20 Sep 06:00 | Primary 0.7 m, 12 s, about 286.2° | Primary 0.90 m, 12.45 s, 307° | +20.8° |
| 23 Sep 06:00 | Primary 0.7 m, 16 s, about 268.3° | Primary 0.66 m, 15.75 s, 279° | +10.7° |
| 23 Sep 12:00 | Primary 0.9 m, 15 s, about 270.3° | Primary 0.86 m, 14.15 s, 280° | +9.7° |
| 24 Sep 06:00 | Primary 1.1 m, 13 s, about 274.6° | Primary 1.14 m, 12.85 s, 284° | +9.4° |

The direction gap varies within this forecast run. On 6 September, the archived comparison instead had GFS near 280° against the owner's Surfline reference at 283°. Consequently, neither a permanent 15–20° subtraction nor treating GFS 299° as universally equivalent to Surfline 283° is supported.

Surfline Saturday at 06:00 shows 0.6–0.9 m surf and **Fair**, its green category. At 09:00 and noon it shows 0.3–0.6 m and Fair. Its Sunday 06:00–18:00 rows show 0–0.3 m. The morning green should not be described as Surfline's “Very good” classification. The 06:00 value is before sunrise, shown as 07:23; it is useful for model comparison, not a daylight-session recommendation.

Our Saturday 06:00 and 09:00 estimates are 0–0.1 m, Flat / too small: Bico 4/100, Bafureira 3/100. At 06:00 GFS also has a primary component of 1.14 m / 11.95 s / 306°. This is not interchangeable with Surfline's 15-second primary. A tiny 0.06 m south-westerly tertiary component becomes dominant after the northern components are heavily suppressed.

## Diagnostic replay, not a candidate calibration

The saved API inputs were replayed locally through the unchanged scorer. Replacing **only** the 06:00 GFS secondary bearing with 283° increases the displayed surf estimate to 0.2–0.4 m at both breaks. Bico reaches 29/100; Bafureira remains 24/100. Keeping its original 0.54 m height leaves a material disagreement with Surfline's 1.0 m component. A blanket 15° subtraction from all swell components still produces only 0.2–0.3 m at 06:00. These artificial inputs were never written to a database or served to users.

This separates the direction problem from height/component differences and local suitability. Bico's morning high tide remains outside its preferred range; Bafureira retains its minimum-swell constraint. The common Surfline spot rating cannot validate those break-specific settings independently.

## Applied staging assumption

Use the existing GFS 0.16° grid and interpret 285–300° swell as potentially useful but sheltered. Preserve the established exposure through 283°, then taper strongly between 300° and 310°. This is a provisional local transfer rule, not an assertion that one GFS bearing always equals a particular Surfline bearing. It applies to both breaks, every date, all swell partitions and wind sea through the existing generic evaluator.

| Incoming GFS bearing | Previous height multiplier | Trial height multiplier |
| --- | ---: | ---: |
| 283° | 0.68 | 0.68 |
| 285° | 0.35 | 0.68 |
| 290° | 0.02 | 0.68 |
| 295° | 0.0125, interpolated | 0.65 |
| 300° | 0.005 | 0.60 |
| 305° | 0.00433, interpolated | 0.40 |
| 310° | 0.00367, interpolated | 0.02 |
| 315° | 0.003 | 0.003 |

Points outside 283–315° are unchanged. These are component-height multipliers before swell gain and period response, not percentages of energy. No period-dependent refraction formula or global direction subtraction was introduced. The original tide preferences, minimum-swell rules, experience constraints, colour thresholds and previously approved small-wave ceilings remain.

Only `calibration_config.exposureByDirection`, current explanatory notes, provenance sources and revision metadata changed. Prior history is preserved. Staging Bico is revision **8** and Bafureira revision **7**. The other 15 complete spot records and the default-profile setting are unchanged. All 17 production spot records and its default setting match the before snapshots; production Bico remains revision 6 and Bafureira revision 5.

## Replay and live verification

The [evidence folder](2026-09-17-sao-pedro-direction/) contains weather fixtures, the two public calibration configurations, database verification hashes, migration receipts and the complete comparison. Complete database records are excluded. Reproduce the 816-hour, 32-day-window replay with `node surf/scripts/replay-sao-pedro-direction.mjs`. This uses identical saved inputs before and after, avoiding confusion with later provider updates.

In that replay, Saturday's best window changes from almost flat to Fair: Bico 65/100, 0.3–0.5 m, 11:00–12:00; Bafureira 59/100, 0.3–0.5 m, 08:00–09:00. All 24 hours of Sunday stay flat at both breaks. Wednesday's established westerly swell remains useful. The broader shoulder also raises several later dates, including 24–28 September. The full report discloses those changes; this is not a Saturday-only patch or a claim that every future uplift is correct.

Live staging verification at 11:32 UTC used newly refreshed provider inputs and returned:

| Spot | Saturday best window | Surf | Quality |
| --- | --- | --- | --- |
| Bico | 08:00–09:00 | 0.3–0.5 m | Fair, 69/100 |
| Bafureira | 08:00–09:00 | 0.3–0.5 m | Fair, 61/100 |

Sunday remains Flat / too small on the live selected-day summaries. The Saturday and Sunday top-card summaries exactly match the full-forecast day-window selector for both breaks. All 816 live hourly scores agree with the unchanged local scorer, with 16 forecast dates and no provider issues per spot. Unauthenticated forecast access returns 401 and public-demo spot writes return 403; the temporary demo session was revoked.

All **137 tests** passed, including new coverage for the saved mixed swell, small Sunday, preservation of the earlier 283° reference, northerly wind-sea shelter, storm limits, date independence and unchanged break controls. Changed scripts/tests pass lint. The migration was rehearsed with rollback before its staging-only application. No application build is needed for this database-only change; runtime reads the new version on a forecast request. A Chrome refresh verified both Saturday top cards and Bafureira's day tile showing Fair with the existing compact design. Surfline's green category is Fair, whereas MyWavePlan renders Fair in yellow; colour palettes are not equivalent.

## Remaining validation and rollback

The selected shoulder is an explicit assumption. Its coefficients are not fitted to representative beach observations, and it does not resolve provider height, period or partition differences. A single bearing-only curve cannot resolve all coastal transformations. F19 retains comparison of neighbouring model samples, alternative models and, if warranted by observations, period-dependent exposure. Validate small/flat, mixed, more northerly and powerful swells before claiming improved accuracy or applying this rule to other coasts.

Rollback uses each target's saved `staging-before.json` configuration/notes/sources through a new versioned update, preserving both the previous and trial history. Do not delete history or reuse an old version. The migration script only connects to staging and refuses duplicate application. Production needs a separately reviewed migration after approval because its baseline does not yet include the preceding small-wave trial.

The preceding small-wave/window application release is unchanged. F19 remains partial/open and the core onboarding sequence is unchanged. Production still requires the owner's review and renewed approval.
