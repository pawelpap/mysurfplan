# Spot-card daylight, request reuse and mobile width

10 September 2026. Owner-authorised F18 follow-up, staging only. Production approval remains pending. This supersedes the always-now and per-minute summary behaviour in the [initial F18 release](RELEASE_2026-09-10_CONDITIONS_UX_STAGING.md).

## Change

Spot cards use now during local daylight, today's sunrise before dawn and tomorrow's sunrise after sunset. Visible local-time labels make the difference explicit in both carousel and catalogue. The existing SunCalc library supplies each spot's sunrise, with no new external API. Polar daylight uses now; polar night without a nearby sunrise uses an explicitly labelled current-time night forecast. Day tiles stay at noon and chart cursors continue to control details only.

The browser batches missing or expired summaries in one request, up to 24 spots, with three server-side calculations/refreshes at a time. The browser reuses each spot for five minutes, or until a sunlight boundary, and keeps previous values while refreshing. Stale/failed results retry after one minute. Scrolling back uses the cache; scrolling during a request does not duplicate its server work. Explicit refresh applies only to its visible set. Provider caching, locks, backoff and all forecasting calculations remain unchanged.

Mobile carousel cards fit two across on 390–440 px phones; narrower screens retain a 158 px minimum. No parameters were removed. Quality and wave range have separate lines on small cards so units cannot be stranded on a line by themselves.

## Verification

- 102 tests passed, including local sunrise/sunset boundaries, midnight, DST, different timezones, year changes, polar day/night, five-minute reuse, scroll-back/in-flight deduplication, explicit refresh scope, failed-update preservation and retry backoff.
- Node.js 22 lint/build passed. One pre-existing avatar-image warning remains.
- The local production-mode application passed 14 API groups and nine native Chrome browser groups. Batch daylight assessments matched the exact-time single summary, with per-spot failure isolation and 401/400/405 boundaries. Student spot writes remain forbidden.
- Browser checks cover nearest Bico, 17 spots/16 days, stable tile/chart contexts, cached return from catalogue, hourly swell components, lesson navigation, linked keyboard/mouse/touch charts, themes/login, two-card width at 430 px and no page overflow at 390/320 px. Temporary login sessions and test browsers are cleaned by the runner.
- Physical iPhone/Safari has not been tested. Request cache/failure/timing edge cases use deterministic unit tests; deployed API/browser checks use real staging data.

Staging deployment and post-deployment verification are pending. The [handover](../../HANDOVER.md) will record the verified live deployment.

## Scope and rollback

No schema, calibration, account or provider change. Normal forecast cache writes and temporary verification sessions only. Production remains on B2. Roll back this follow-up to `08462b72cbaf1112929c683ac7c75485a130e79e` for the preceding F18 staging application; no database rollback is needed.
