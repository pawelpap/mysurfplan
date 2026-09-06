# Forecast refresh recovery

Application revision: `657333b8dc1c37798cf3c342ae59370f4a7c65d1`.

The owner reported unavailable forecasts on production on 6 September 2026 while staging and mobile appeared to work. They subsequently confirmed recovery and explicitly authorised the fixes on both staging and production, with checks afterwards. The same release changes the login copy to “Made for surfers and surf schools”.

## Diagnosis

Both domains were running `37e62b0`. API responses were private/no-store with CDN misses. Production cache records for São Pedro and Abano contained a failed-weather issue with wave data present. The adapter treated this as a successful partial response, replaced any earlier complete forecast and cached it for ten minutes. No retry marker or server error was recorded for those partial responses. Missing wind prevented scoring, and the daily card misleadingly displayed “No wave data”.

Live requests recovered the affected spots, but a wider sweep reproduced missing weather at Cornélia and Praia das Maçãs after approximately 12 seconds. This is consistent with the adapter's 12-second timeout; the original code did not retain enough diagnostics to establish the exact network error. Independent cache contents and request timing explain the apparent environment/device difference. No desktop-specific data source was involved.

## Changes

- Each parallel source request has one bounded retry for transient failure. Longer `Retry-After` values become a shared retry deadline. Safe diagnostics identify source, HTTP status, timeout and attempt without exposing credentials.
- A failed required source preserves the whole compatible complete forecast if it was fetched less than 24 hours ago. Its original update time is retained and a warning is shown. Old weather is never mixed with fresh waves.
- Incomplete forecasts without a usable complete predecessor remain explicitly incomplete. They retry after one minute rather than being cached for ten minutes. Total failures use the same minimum back-off. A longer provider deadline takes precedence.
- Concurrent requests wait for an existing refresh. Expiry changes compare the initially read fetch timestamp, including millisecond normalisation for database timestamp precision, so a completed refresh is not invalidated by a late caller.
- Visible pages automatically retry failed updates after the server deadline. The Refresh button displays “Refreshing…” and is disabled while the previous forecast stays visible. Missing assessments use “Surf estimate unavailable”.
- The login tagline is “Made for surfers and surf schools”. The existing compact mobile login layout is retained.

No calibration, spot configuration, schema, account or business-record changes are included. Forecast cache rows refresh independently in each environment.

## Verification

All 58 automated tests and the Node.js 22 build passed. Nine new regression tests cover transient retry, permanent errors, retry bounds, rate-limit back-off, complete-cache retention, source and age boundaries, truthful timestamps, recovery, optional water-temperature failure and missing weather.

Local browser checks at 1440 and 390 px verified login copy, no page overflow, visible/disabled refresh feedback, retained forecasts and update times, and automatic recovery from a simulated failure using a controlled clock. Browser exceptions were absent. Browser testing uses Chromium desktop/mobile emulation, not a physical iPhone.

Staging deployment `dpl_6FmcNRKzy3ZCSxnhnPtWkEvxpysV` is READY and serves the custom staging domain. Live checks passed for all 17 spots, 408 scored hourly records per spot, all 16 days, water temperature and energy availability, lesson conditions and four simultaneous refresh calls returning one completed forecast. Desktop/mobile login and refresh checks passed. The cache contained no incomplete entries or error markers afterwards; deployment-scoped warning/error/fatal logs were empty during verification.

Production deployment `dpl_2rNHMmgvgkLND5tbpVsMaSosCV6w` is READY and serves `mywaveplan.com` with the same application revision. The Git push advanced `main` but did not create a production build, so the existing production-project preview was rebuilt explicitly with `vercel redeploy --target production`. The preview was not promoted with preview environment settings.

All production checks passed: 17 spots × 408 scored hours (6,936 assessments), 16 days, available water temperature and swell energy, the demo lesson forecast, four simultaneous refreshes sharing one completed result, and desktop/mobile login and refresh behaviour. The production cache had 17 complete entries, no error markers and no active refresh leases afterwards. Deployment-scoped warning/error/fatal logs were empty during the verification window. These are point-in-time checks; they do not establish continuous provider availability.

A documentation-only follow-up records the release on both Git branches. It does not change the tested application. The deployment IDs above identify the application revision that received the full checks.

## Rollback

Previous production deployment: `dpl_4DvJmVYkhNpbBc6mYxKre1iyj9F3`, revision `37e62b0069aae5978cd1652cfb9b217a14ffad50`. No database rollback is required. A code rollback restores the old refresh behaviour, including its incomplete-cache limitation. Cached payload format remains compatible.
