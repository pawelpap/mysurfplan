# MyWavePlan handover

Updated 6 September 2026. This file records the current handover; dated release notes retain earlier deployment history.

## Current release: home-screen support

The owner explicitly authorised deployment of home-screen support to both environments on 6 September 2026. Application revision `1b474234a0187c53d7047d0f64fe9fb534c15582` was verified on staging, then deployed and verified on production. Both environments support browser-tab icons and smartphone home-screen installation, including Apple metadata and a dedicated iPhone icon. The app opens Conditions in a standalone window and retains normal authentication.

- Verified staging deployment: `dpl_BGDLjaWwUpohyH5cxQMaA2Jmfqar`.
- Verified production deployment: `dpl_2rgdYZy7hcmtLSVu9nLnVcABNKUi`.
- Previous production rollback reference: `65cdc1ebf3bf0502a8383d7a71060fd7099806af`, deployment `dpl_DLjzUskKXsSTwfLemWr972EPWH59`.
- A documentation-only follow-up records completion on both Git branches. The IDs above identify the tested application release.

All 44 tests and the build passed. Local, staging and production browser checks passed for public manifest/icon loading, required icon sizes, manifest parsing and primary-icon decoding, Chrome installation diagnostics with no errors in a temporary regular profile, app launch through login into Conditions, navigation/public-page metadata, browser-colour updates and mobile layouts. The Apple image is opaque and the Android maskable artwork stays inside its safe circle. Browser checks use mobile emulation; a physical iPhone Home Screen installation was not available to test.

No database migration, business-record copy or service-worker cache was introduced. Forecast freshness and server permissions are unchanged. Installation instructions, assets and verification limits are in [Home-screen support](HOME_SCREEN.md). This release is complete; the specific permission to deploy both environments does not replace the standing staging-review requirement for future changes.

## Previous production release

The owner reviewed staging and explicitly approved production on 6 September 2026. The conditions layout, appearance and nearest-spot release is now deployed and verified on both https://mywaveplan.com and https://staging.mywaveplan.com. There is no pending production approval for this release. Future changes still require staging review and a new explicit approval.

Approved revision: `2ea5905753a321c3c8a9c5854826a19e1ee26646`. This contains application commit `d1ddea8be969783f88eee4b2cb2609cd892e94c4`, the earlier layout review `48b3a49` and staging verification documentation.

- Verified production deployment: `dpl_AfTvG9kcZfHKp3xY1s31VeYnZTH9`.
- Approved staging deployment: `dpl_3SfVt7LagQnZyeKMFm3T8ja2y5su`; full application checks also passed on `dpl_FdtZhk6qH5oNi8WND2qcsiVF9JkD`.
- A documentation-only follow-up records production verification and keeps `main` and `staging` together. It makes no application changes; the IDs above identify the verified application release.
- Previous production rollback reference: commit `1938804611fb66c1a70db919b0f48fe6cdb1f5fa`, deployment `dpl_2vqrj9acaPkMH33Mn2TLtAZuBHRG`.

Generic database calibration, offshore energy density in kJ/m², estimated power in kW/m and water temperature in °C are retained. Keep these measures; the owner declined a speculative conversion to Surfline's kJ scale.

Released behaviour:

- Light, Dark and System appearance across the workspace, login, public schedule and legal page. System is the default and follows live device changes. The Appearance selector is in the workspace sidebar/mobile menu and public page headers. An early head script applies saved preferences before paint. The per-origin preference is stored in localStorage, synchronised across tabs and works in memory if storage is blocked.
- Surf quality has green/yellow/orange/red text and dots, plus subtly tinted daily tiles. The selected day retains a separate outline. Missing assessments stay neutral. This supersedes the earlier request to remove all quality colours; metric sizes remain consistent and required experience is independent of quality.
- Desktop hours expand from the time/chevron button. Mobile hours expand from the summary. Both use the same details component, including all available swell partitions, energy, power, water, gusts, tide, weather and reasons.
- Tide/time selection precedes selected-time values. First light, sunrise, sunset, last light and tide extremes remain available. Selected-time gusts and tide stage/trend are visible.
- Less repeated wording and fewer nested boxes. Swell components and the forecast guide use unfilled disclosure rows. Missing data, forecast uncertainty and assessment reasons are retained.
- Native dropdown chevrons have an inset. The shared spot-list API sorts names alphabetically, ignoring case and accents, with deterministic ties. Conditions and lesson selectors consume this list. Their shared browser picker defaults to Nearest to me when it first opens after login. It requests browser location automatically, displays approximate straight-line distances and sorts globally by great-circle distance. A–Z remains selectable and is the fallback for denied, unavailable or timed-out location. Clicking Nearest to me retries/updates location; switching to A–Z ignores late callbacks. Sorting preserves the selected spot. Coordinates and sort mode stay in memory across SPA navigation and reset on reload; coordinates are not stored or sent to app APIs. No location is requested on login or public pages without a spot picker. The obsolete priority field is removed from the editor; stored priorities are preserved.
- Spot editing and calibration settings/history remain platform-admin-only. Direct editor URLs show a denial to other roles, and API write protection remains enforced independently of the UI.

No migration, calibration change, forecast-model change or business-record copy is required or performed for this release. The forecast response continues to include the calibration needed for client-side selected-time calculations; this is not an admin editing endpoint.

## Verification and next action

Local verification passed: 44 automated tests, including 5,712 calibration parity cases; production build; browser checks of device defaults and live changes, explicit appearance overrides, persistence and tab sync, blocked storage, pre-hydration/no-JavaScript theme fallback, text contrast of at least 4.5:1 on standard and tinted surfaces, desktop/mobile layout, touch tide selection, public schedule, lesson conditions and admin forms. Location checks use synthetic browser coordinates and cover automatic startup, global ordering, A–Z, selection preservation, reload, no coordinate storage/transmission, permission denial, timeout, unavailable APIs, retries and late-callback cancellation. The same appearance and location checks passed on the staging custom domain. Desktop/mobile review includes 1440, 1024, 768, 390 and 320 px; shared lesson/forecast distance order, required spot selection and preservation through sorting; and sort preference retained across SPA navigation. Native touch on the tide chart, public schedule, lesson conditions and admin forms passed. After the owner's approval, the same application revision was deployed through `main` and verified on the production custom domain. Production checks passed at all five widths: student UI login opening Conditions, 17 database spots, 16-day forecast with water temperature, automatic distance order and A–Z fallback, appearance persistence/device defaults, quality tile fills, exact desktop/mobile hourly detail parity, keyboard and native touch graph interaction, lesson conditions, public schedule, student editor/API denial and platform-admin forms. No browser exceptions or 5xx responses were observed. Vercel's deployment-scoped error/fatal log query returned no entries during the verification window.

Run `npm test` and `npm run build` in `surf`. Browser review covers 1440, 1024, 768, 390 and 320 px; hourly value parity; dropdown order/inset; chosen time; 16 days; full-day hours; missing future temperature; lesson conditions; and role permissions. Temporary role sessions are used only against the local build; live testing uses the authorised student and platform-admin accounts. Do not commit credentials or browser session files.

For the next change, publish to `staging`, wait for its ready deployment, verify the custom domain and tell the owner it is ready. Leave production unchanged until the owner explicitly approves that new candidate. The approval above is specific to this completed release.

No database synchronisation is needed for presentation changes. Both environments have separate databases and can accumulate different bookings, login metadata and forecast-cache entries. To roll back this release, redeploy the previous production application reference above through the normal release process; retain the current production database and reconcile any subsequent code changes. Full release details are in [presentation release notes](RELEASE_2026-09-06_PRESENTATION.md).

Environment IDs, rollback resources and local setup are in [Staging environment](README-staging.md). The [development plan](DEVELOPMENT_PLAN.md), [design review](UX_AUDIT_2026-09.md#conditions-presentation-review-6-september-2026), [algorithm](CONDITIONS_ARCHITECTURE.md) and [spot schema](SPOT_DATA_MODEL.md) contain the detailed decisions.
