# Small surf and daylight windows, staging review

17 September 2026. **Staging is ready for owner review. Production is unchanged.** The owner's later instruction to review staging before promotion supersedes the earlier permission for automatic production promotion. Do not apply the production migration or push this release to `main` without renewed approval.

## Release boundary

- Initial runtime: `dd3802e989d76d43cd0ebca53e4cb6b12943fb3c`. Final follow-up runtime: `3032204543a11308766efe148699624466d66bb3`, branch `codex/small-wave-windows`, deployed through `staging`. The follow-up makes top spot cards and All spots use the selected day’s best window after owner review.
- Verified staging deployment: `dpl_2CZ7qmswzokQwoaowok1XqSLtGzu`, [staging.mywaveplan.com](https://staging.mywaveplan.com), READY, Node.js 22, `fra1`.
- Production remains `04d9c9a8ba15e06406ceae6101154cc391719a34`, deployment `dpl_GqXkCSbo6ADaqeJjGZ4EhYfyaqWp`. The production migration audit returned `not_applied`. No production database mutation or branch push was made.
- Staging migration `20260917_small_wave_trial`, SHA-256 `a7363425aa0aa21a11435b60244fedcef1411181f35cf2eee205d75cb96385ed`. Its recorded approval wording reflects the earlier instruction at application time; this release record preserves the later production hold. Do not edit the applied migration checksum to rewrite history.

## What changed

All 17 staging spot calibrations have a new immutable revision. The size ceiling is now 25 at a central estimated surf height of 0.3 m, 85 at 0.4 m and 100 at 0.5 m, with interpolation. This lets clean small surf receive Good when the other conditions support it. It does not award Good solely because the waves are small. The flat threshold, severe-weather limits, wind/tide/period rules, offshore minimum-swell requirements and experience rules remain in force. The general default profile is version 2; existing spot overrides remain explicit.

Cornélia and São João also trial directional spread 95° instead of 85°. Each retains its own shoreline normal, gain and remaining settings. This is a provisional regional calibration, informed by one subjective session, not a validated accuracy improvement. All other spots retain their existing physical transformation parameters. The shared forecasting formula is unchanged; calibration values remain in PostgreSQL.

Day tiles show the best complete one- or two-hour daylight window, with one compact time row and the existing layout. The weakest sampled hour determines colour and displayed conditions; experience shows the most demanding requirement within the window. Ties prefer a two-hour window, then higher mean score, then the earlier start. Missing/provisional data and night hours cannot create a window. No qualifying window shows “Window unavailable”. Clicking a tile selects that day below at the window start. Chart navigation, hourly detail and Now remain available. Top spot cards and All spots use each spot’s best window for the selected date, with the same selector and time range. Clicking a loaded spot opens its window start in the existing detail view. Summary caching includes the date, isolates in-flight responses and does not force an upstream refresh just because the date changes. Omitting `day` from the API preserves the legacy now/next-sunrise behaviour for older clients.

The selected window may already have passed on the current day. It describes the best window in the full day's forecast, not necessarily the next session still available. A green tile means that window is Good, not that every hour of the day is Good. It is neither a board-specific suitability assessment nor a probability of good surf.

## Observation and comparison

The owner reported clean 0.6–0.9 m surf at Cornélia, 08:00–09:00 Lisbon time on 17 September, on a Semente Catcher 6'3", 34 L. The [structured fixture](../../../tests/fixtures/caparica-observation-20260917.json) preserves this report and distinguishes earlier saved forecasts from diagnostic data retrieved after the session. No post-session retrieval is labelled as the exact forecast the owner saw.

Staging's refreshed forecast gave Cornélia Good 89 at 08:00, 0.6–0.9 m, and Good 90 at 09:00, 0.5–0.9 m. The tile selected 09:00–10:00. Noon remained Flat / too small, 0.2–0.3 m. São João selected 09:00–10:00, Good 88, 0.7–1.1 m. Separate control spots retained low ratings where appropriate: Bico remained flat, Carcavelos flat/poor and Praia Grande unfavourable on 17 September.

The owner's open Surfline tab was checked around 11:44–12:00 Lisbon time, then restored to Costa da Caparica. These were current model forecasts, not independent observations of the session:

| Surfline page | Visible comparison on 17 September |
| --- | --- |
| [Costa da Caparica](https://www.surfline.com/surf-report/costa-da-caparica/5842041f4e65fad6a7708e65) | 06:00 0.6–0.9 m; noon 0.3–0.6 m; current Fair. |
| [Praia da Cornelia](https://www.surfline.com/surf-report/praia-da-cornelia/5dbf6037eb8ddf00015a883f) | Expanded hourly table: 08:00 and 09:00 0.3–0.6 m, falling to 0–0.3 m by 11:00; current Poor to Fair. |
| [São João da Caparica](https://www.surfline.com/surf-report/s-o-jo-o-da-caparica/5dbb587ff387900001fee288) | 06:00 0.6–0.9 m; noon 0.3–0.6 m; current Fair. Saturday's displayed daily range was 0.6–1.1 m. |

The comparison supports a morning-to-midday decline, but the Cornélia heights and quality labels do not agree exactly. The two services use different inputs, transformations and rating scales. The owner's observed range supports this bounded staging trial; Surfline is a comparator, not ground truth. Do not claim that MyWavePlan now matches Surfline or that either is proven more accurate.

The change substantially increases Good hours in the Caparica replay, and all 16 Cornélia day tiles have at least one Good window in the checked run. This follows both the relaxed small-surf ceiling and selection of each day's best window. It is a visible trade-off for the owner's review. More independent sessions, adverse-condition examples and held-out dates are required before claiming calibration accuracy. F19 remains open.

## Forecast archive foundation

Staging now preserves a bounded immutable sample in `spot_forecast_snapshots`: the first successful fresh retrieval per six-hour UTC slot, spot, engine and calibration version. It retains future valid hours, raw forecast inputs, retrieval/recording times, spot calibration and tide inputs. Provider issue time is explicitly null because the source response does not supply it. Failed refreshes, stale retained caches and past hours are not backfilled.

Retention is 90 days, with at most 100 expired rows removed during a later successful refresh. This is opportunistic cleanup, not a guaranteed purge deadline. There is no new cron, continuously awake worker, browser tracking or personal observation database. At 10:54 UTC, eight real staging snapshots for eight spots were present. Full fixed-lead sampling, archive coverage monitoring, scalable storage, observation entry and evaluation dashboards remain F9/F14/F15 work. A5 permitted-use review remains open; this limited staging archive does not settle production retention or commercial rights.

## Verification

- Node.js 22: 133 tests passed; lint/build passed with the existing avatar-image warning; dependency tree passed; npm audit reported zero vulnerabilities.
- Migration and constraints rehearsed transactionally on the isolated branch and staging before staging application. All 17 revisions/history entries, default profile and immutability/deduplication/expiry checks passed. See [database checks](2026-09-17-small-wave/staging-database.json). The replay includes forecasts of different retrieval dates and is a regression diagnostic, not an accuracy dataset.
- Live staging API: five representative spots, 408 hourly samples each, 16 dates, exact shared scorer parity, no provider issues, anonymous denial and demo mutation denial passed. The temporary demo session was revoked. See [initial API checks](2026-09-17-small-wave/staging-api.json) and [final window consistency checks](2026-09-17-small-wave/staging-windows-api.json). The final checks compare top-card and calendar outputs exactly for five spots on two selected dates, including window times, scores, colours, experience, surf, wind and energy. Invalid dates return 400, and summaries do not expose calibration or full forecast arrays.
- Native Chrome: desktop dark/light appearance; 390 px and 320 px layouts without page overflow; complete parameter rows; window label; click to selected day and 09:00 linked charts passed. The follow-up also verified Saturday selection, All spots, selecting São João at its 11:00 window start, and mobile top-card date labels. Browser console contained no captured warnings/errors. Original device-theme preference and viewport were restored. This does not establish physical-device/Safari coverage.
- Production custom-domain deployment and absence of the trial migration were checked read-only after the owner's hold.

## Next action

Owner reviews [Cornélia on staging](https://staging.mywaveplan.com/?view=conditions&school=demo-surf-school&spot=cornelia-caparica&date=2026-09-17&time=08%3A00), neighbouring São João and the other spot/day colours. Production requires a new explicit approval. After approval, recheck the current baseline, apply the guarded migration, deploy the same reviewed runtime and run production API/browser/archive checks. Do not clone the staging database. Any calibration rollback uses new versioned history; retain immutable snapshots and applied migration history.

After this bounded forecast task, the core development sequence remains A4/B6 → A9 → B3, with A6/A7 email activation before registration goes live. F9/F14/F19 are partial/open, not completed by this trial.
