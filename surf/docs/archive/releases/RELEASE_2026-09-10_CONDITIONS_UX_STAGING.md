# Conditions UX staging release, 10 September 2026

Application commit: `2bb99fe17fbf5a9731ca61b16f496a6796f7448d`. Staging deployment: `dpl_5YDRPKe2UJqMVjmZjzpTW6FSRGaF`, project `mysurfplan-staging`, git branch `staging`. Deployment reached READY and the staging custom domain passed verification. The owner approved F17 and authorised staging implementation; production approval is still required.

## Scope and final decisions

The [implementation contract](../../CONDITIONS_UX_IMPLEMENTATION.md) records the complete scope. The final owner decision is current-time spot cards, stable noon day tiles, and a chart cursor that changes only both charts and detailed conditions. Intermediate all-tile synchronisation was replaced before deployment.

The release adds the full spot carousel/catalogue, aligned calendar weeks, icons, qualitative tile labels, rich mobile tiles, linked surf/energy and tide charts, retained hourly details and school-scoped lesson links. No numerical scores appear on day or spot tiles. Mobile weekly columns scroll within the calendar. Quality colours, metric information and platform-admin-only spot configuration remain intact.

Login says “Made for surfers by surfers”, removes its theme selector and follows the device, including live changes. Signed-in theme preferences are preserved. The selected appearance controls sit above profile/logout in the workspace.

## Verification

Local production-mode verification passed with Node.js 22.18.0: 96 tests, lint/build, complete dependency tree, zero npm audit findings, eight API groups and nine native Chrome browser groups. One existing avatar-image warning remains for B7.

The compact summary matched the full forecast assessment at a non-quarter-hour timestamp, including quality, experience, surf range and score. Responses were about 360 bytes and contained no full forecast or calibration payload. Unauthenticated access, invalid timestamps and student spot creation were rejected.

Browser checks covered nearest Bico using synthetic coordinates, 17 spots, 16 dates, stable noon tile labels, linked chart keyboard/mouse/touch controls, full catalogue and accent-insensitive search, hourly swell components, school lesson no-results/back navigation, dark mobile layout, desktop parameter parity, and no page overflow at 390 px and 320 px. Login followed the system despite a saved Dark preference. No page errors were reported.

Verification found and corrected absolute accessible labels escaping scroll-container clipping, a radio overlay intercepting direct pointer targeting, and unaligned tide sample grids in the compact endpoint. The touch handler distinguishes vertical scrolling from deliberate horizontal selection. Manual physical iPhone/Safari testing was not performed.

Reusable checks: [API and release runner](../../../scripts/check-conditions-release.mjs), [browser journeys](../../../scripts/check-conditions-browser.mjs). Supply the target base URL, `MWP_TEST_EMAIL` and `MWP_TEST_PASSWORD` privately. Optional `MWP_PLAYWRIGHT_MODULE` selects the installed Playwright runtime. The runner shares one verification session across all checks and removes only that session in its final cleanup. Avoid repeated independent login runs; the existing rate limits remain enforced.

## Deployed staging verification

The same eight API and nine browser groups passed at https://staging.mywaveplan.com. This run also checked that vertical touch scrolling leaves the cursor unchanged and that the saved signed-in Dark preference returns after visiting the system-theme login screen. Browser page errors were empty. The deployment-scoped Vercel error/fatal query returned no matching entries in the verification window. Temporary browser contexts and the runner’s login session were closed/removed. The isolated agent-browser Chrome test session was also closed.

## Data, promotion and rollback

No migration, database clone, spot/calibration change or provider switch occurred. Both databases retain the B2 schema and authority. Only temporary verification sessions and normal forecast caches are written. Production git `main` remains `91bc4fe2f9cd4c230f05f8ba7928e13610e2e9f3`, with B2 application code. Git integration may also build an unpromoted preview in the production project; this does not update mywaveplan.com.

After owner approval, promote through `main` and run the same checks on production. The preceding B2 application is compatible for rollback; no database restore is required. Full cross-school discovery remains C2, and photos/storage remain B7. F18 stays open until approved production promotion and verification.

Subsequent status, 10 September: the owner approved production and the final F18 application passed production verification. This file retains staging evidence; see [production release](RELEASE_2026-09-10_CONDITIONS_UX_PRODUCTION.md) for current promotion details.
