# MyWavePlan handover

> Archive status: Archived handover snapshot before the 9 September documentation tidy-up. Its older release and next-action sections are historical. See the [current handover](../../HANDOVER.md) and [current roadmap](../../IMPLEMENTATION_ROADMAP.md).

Updated 9 September 2026. This file records the current handover; dated release notes retain earlier deployment history.

## EU location and launch languages, 9 September 2026

Recorded the owner's preferred EU storage policy for the initial Portuguese market. A8 now resolves the exact destination before provider provisioning and completes a rehearsed staging/production move before real self-service registration or school onboarding. Scope includes recovery copies, media, logs and external processor locations/access, with exceptions, rollback and old-copy expiry documented. The last account review still records Neon in AWS us-east-1; no migration or live region check was performed in this update.

Moved initial localisation ahead of G1. New A9 (M; FE/BE/DB) establishes catalogues, formatting, a desktop/mobile language switcher and personal/device preferences before new registration/discovery screens. B10 (L, split by journey; FE/BE/DB/Ops) completes reviewed English, European Portuguese and Spanish across UI, errors, emails and published policy documents before the pilot. French is optional; F8 now covers later languages/markets. Language choices preserve school/spot timezones, currency, forecast values and proper spot names. All subsequent features support every enabled language.

Updated the roadmap, development plan, infrastructure review, privacy architecture and registration proposal. Documentation only; no code, database, provider account or deployment changed. A1 remains the next coding task; A8's destination/policy decision can proceed alongside it.

## Small-launch service budget, 9 September 2026

Saved [monthly costs and assumptions](../../LAUNCH_COST_ESTIMATE.md) and linked them from the roadmap, development plan, infrastructure review and commercial architecture. Working allowance: €70–100/month before tax/payment fees, with a minimum paid combination of €29 Open-Meteo Standard plus US$20 Vercel Pro. Suitable free database/email/media tiers reduce the bill; Neon Launch and Resend Pro are conditional on actual needs. The estimate is for approximately 3–5 schools and 100–300 monthly active surfers, not a measurement of current use.

Verified Open-Meteo's live euro pricing table and Neon's public usage rates in Chrome, plus official Vercel/Resend/R2/Stripe/Google pricing information. Inspected current forecast code: three Open-Meteo requests per full fetch, normal 15-minute cache and two-minute complete-forecast forced-refresh threshold. The budget records request-volume and database-uptime scenarios rather than assuming few accounts guarantee negligible cost. Tide/daylight calculations need no separate recurring API fee for the current implementation.

Commercial-only activation still happens at L1 before its triggering use; technical limits/recovery remain A7. No purchase, account change, code/database change or deployment was made. Closed the temporary pricing tab. Next coding task remains A1, followed by dependencies and global registration/membership work.

## Commercial service purchase timing, 9 September 2026

At the owner's request, moved commercial-use-only licences and paid service activation into roadmap L1, immediately before the first test, demonstration, pilot or release that requires them, with setup/verification time. A5 now covers lightweight permitted-use, attribution and provider limits; A7 covers technical capacity, branch lifecycle and recovery. Commercial-only purchases no longer block ordinary permitted development. Neon Launch is a candidate when verified recovery/capacity requires it, not an automatic G1 purchase.

Updated the [roadmap](../../IMPLEMENTATION_ROADMAP.md), [development plan](../../DEVELOPMENT_PLAN.md), [provider timing review](../../INFRASTRUCTURE_CAPACITY_AND_UPGRADES.md), [commercial architecture](../../COMMERCIAL_AND_PRIVACY_ARCHITECTURE.md) and [expansion assessment](../../PRODUCT_EXPANSION_ASSESSMENT.md). G1/C7, paid releases and sponsorship now explicitly check L1 at the triggering activity. Early source-use checks remain because provider terms can classify free business pilots or promotional deployments as commercial; this is not a determination that the existing live prototype is exempt.

This timing supersedes earlier general recommendations to prepare immediate commercial spending. Current account findings remain dated 8 September; no subscription, account, API configuration, database or deployment was changed. A1 remains the next coding task.

## Product expansion roadmap review, 9 September 2026

Assessed the owner's additional ideas in [product expansion assessment](../../PRODUCT_EXPANSION_ASSESSMENT.md) and updated the [implementation roadmap](../../IMPLEMENTATION_ROADMAP.md), [development plan](../../DEVELOPMENT_PLAN.md) and [commercial architecture](../../COMMERCIAL_AND_PRIVACY_ARCHITECTURE.md). Existing F4–F6 now distinguish lesson/school/instructor feedback from rankings. F12/F13 add private student progress and optional cohort leaderboards. F9 is observation collection, with F14 preserving forecasts as issued and F15 evaluating accuracy/calibration on held-out evidence.

F16 adds the requested in-app feedback flows and pop-ups: verified post-lesson ratings, actual-condition observations and instructor progress reminders. Deliver incrementally with the relevant forms; use later/dismiss/complete states, frequency caps, server eligibility and privacy-safe measurement. These prompts must not interrupt critical tasks or silently publish private responses.

V1–V8 retain rentals, sales, shaping/repairs, photo/video and staffed key-custody partners as demand-led extensions, starting with a directory/enquiries. R1/R2 add a direct local sponsorship experiment with separate labelled placements and no influence on forecasts/organic rankings. M1–M4 define installable-web improvements, opt-in web push, a native-app decision and conditional iOS/Android delivery. Current source has manifest/icons/iOS home-screen metadata; offline/service-worker and push functionality are future work.

Priority remains secure self-service onboarding and forecast-to-lesson booking before school subscriptions and online lesson payments. Start bounded forecast archiving and mobile-web improvements earlier when dependencies/capacity permit; do not require every optional extension for launch. Each roadmap task has effort, affected areas, dependencies and acceptance evidence. No artificial forecast probabilities, Surfline session import, paid organic rankings or global competitive student ranking were added.

This was documentation-only work. No code, database configuration, provider account, subscription or deployment changed. Runtime release status remains as recorded below. The next coding task remains A1, the school-boundary/privacy/demo-isolation audit.

## Accepted registration design and launch roadmap, 8 September 2026

The owner accepted the [registration and membership design](../../REGISTRATION_AND_MEMBERSHIP_PROPOSAL.md). One personal account has school-specific roles; administrator and instructor can coexist; ownership and school billing are separate. The [implementation roadmap](../../IMPLEMENTATION_ROADMAP.md) now provides the canonical remaining task list with stable IDs, S/M/L effort, FE/BE/DB/Ops/Business scope, dependencies, acceptance evidence and the database expansion/cutover/rollback approach.

Delivery gates: G1 self-service/pay-at-school pilot, G2 paid school subscriptions and G3 online individual lesson payments. Packages, reviews, opt-in rankings and other requested extensions remain explicit follow-up items. Tracking is included through consent C5, GTM/GA4/Search Console/dataLayer/reporting C6 and commerce events D4/E4.

A [read-only infrastructure check](../../INFRASTRUCTURE_CAPACITY_AND_UPGRADES.md) confirmed Vercel Hobby, Vercel-managed Neon Free, 10/10 branch slots and a US database region. Roadmap A7 prepares plan/budget/branch decisions; A8 resolves hosting region/isolation. No paid upgrade, account reconnection, branch deletion, data migration or deployment was performed. The next coding task remains A1 school boundaries/privacy/demo isolation. Acceptance of the design does not mark its implementation complete or authorise unrelated paid services.

## Current release: login and request security, 8 September 2026

Revision `76bdcb73ae4713d913a2dd3ccc337a8781da5d07` is deployed on staging and production. The owner authorised production after staging passed. Shared fixed-window login limits, consistent login errors with dummy password work, and origin protection across all writable API handlers are live. Existing passwords, sessions, forecast calculations and calibrations are preserved.

Verification passed: 77 regression tests, seven isolated database scenarios and nine live API scenarios per environment. Browser checks confirmed student login/error recovery and forecasts; Chrome confirmed desktop navigation and the mobile menu. In-app workspace button automation was unreliable, so those interactions were checked independently in Chrome. Both runtime builds were READY and deployment error/fatal log scans were empty. Disposable test users and schools were removed; counters expire normally.

The additive login-counter migration was applied separately to both databases after rehearsal. No business database was copied. Non-browser mutation clients must send `X-MyWavePlan-Request: 1` when Origin is absent. Older same-origin browser clients remain compatible. See [release evidence, limits and rollback](../releases/RELEASE_2026-09-08_REQUEST_SECURITY.md).

Next bounded task: cross-school permissions, instructor/student privacy, public playground removal and demo isolation, with a dependency security review. Password recovery and platform-admin MFA remain future work.

## Previous release: nearest spot selection, 7 September 2026

Application revision `c02da003ec56376750ff0620eef2e264a601fb9f` is deployed and verified on staging and production. Distance sorting already worked; the missing automatic selection is now fixed. A fresh Conditions page selects the nearest spot after location succeeds. Explicit spot links and manual choices take precedence, sorting changes preserve selection, and a requested date is retained. Location failure still falls back to A–Z. Lesson forms retain deliberate spot selection.

All 68 regression tests and both builds passed. Live desktop/mobile checks confirmed automatic selection, distance ordering, manual choice preservation and alphabetical fallback. Staging also passed requested-date and linked-spot checks. Deployment error/fatal scans were empty. The two test tabs were closed and the temporary viewport was reset. See [verification and rollback](../releases/RELEASE_2026-09-07_NEAREST_SPOT.md). No database data changed; the preceding calibration parity remains valid.

## Previous release: forecast calibration and tile cleanup, 7 September 2026

Application revision `428d35f3c2b4b03bec3d95edff4f806945e2690f` is deployed and verified on staging and production. The owner approved production promotion of the reviewed spot data and the removal of “Long-range” from daily tiles. The selected-day confidence/outlook reminder was also removed. No probability or replacement label was added; colours, experience levels and forecast parameters are preserved.

Both databases have the same 17 active spots, full calibrations and disposable test lesson data: 7 lessons, 5 bookings and 4 coach assignments. Production received the 16 reviewed configurations and Praia da Torre; generic São Pedro and six production-only test lessons were removed under the owner's explicit authorisation. Accounts, shared settings and schemas were preserved. Operational timestamps, calibration history event IDs, authentication sessions and caches remain environment-specific.

All 68 regression tests passed, and both deployments passed checks for 17 live forecasts and 6,936 scored hours, current configuration versions, student write denial and deleted-spot 404. Desktop and mobile browser checks at 1710 and 390 px passed, including a later selected forecast day. Deployment error/fatal log scans were empty. See [release evidence and rollback](../releases/RELEASE_2026-09-07_FORECAST_CALIBRATION.md). Verified deployment IDs are staging `dpl_G4FBsNGEBHEChCWTu3q3qN18m6KD` and production `dpl_AeVESYAoN7mfLn8V8aYuW2NwgrkQ`; documentation-only follow-ups do not change runtime behaviour.

The next application-development task remains login abuse protection and CSRF/origin controls. No probability work or Surfline session import is included.

## Earlier staging review, now promoted, 7 September 2026

At 19:45 UTC, the owner's authorised data-only review revised 16 local spot configurations, added Praia da Torre and deleted generic São Pedro do Estoril with its five explicitly disposable test lessons, five bookings and three coach assignments. Seven other lessons remain. Staging has 17 active spots. Bico is version 6; Bafureira and both Caparica beaches are version 5; the other revised spots are version 3; Torre is version 1. All use the existing generic schema v3 and retain provisional status. No application code or shared profile changed and no deployment was needed.

Production spot fingerprints were unchanged at the end of that staging-only review. The owner subsequently approved promotion, completed at 20:11 UTC as recorded in the current release above. The owner deferred Surfline session data work; no session history was imported.

Validation passed: 68 existing regression tests, 61,200 scenario combinations, all 17 live staging forecasts (6,936 scored hours), exact configuration/version checks, student write denial and deleted-spot 404. Chrome confirmed the reloaded selector and Torre forecast. Water-temperature coverage is shorter than the surf forecast and is not extrapolated. See [the review, sources, exact changes and rollout instructions](../calibration/2026-09-07-local-review/README.md). Numerical adjustments remain estimates requiring local observations; the Surfline comparison still shows some rating differences and is not proof of accuracy.

## Previous release: revocable sessions, 7 September 2026

Application revision `aa695a964c362e53712a5990a305ee2174e6d818` is deployed and verified on both environments: staging `dpl_2w1L1GqYVjNF5qmCzaWKdiGNPC6z`, production `dpl_J9LhMTb81ZG6qe82G33GBMzaJcDC`. The owner explicitly authorised production after staging passed. Follow-up documentation/test-script commits do not change runtime behaviour.

Sessions now have a revocable database record. Logout invalidates the current session; My profile has Log out everywhere. Password changes, disabling/re-enabling and deleting/restoring users invalidate existing sessions. Role and school permissions are read from the database for every authenticated request. Admins can change Account status in Edit person. Users must log in once after this release because previous stateless cookies are rejected. Existing passwords and signing secrets were preserved.

The additive [session migration](../../../db/migrations/20260907_revocable_sessions.sql) was rehearsed on an isolated Neon branch, then applied separately to staging and production. No business database was copied. The migration preserved existing users. The rehearsal branch `br-morning-glade-adu8v769` is retained for repeatable checks and is not connected to either app. All disposable test accounts, sessions and schools were removed after verification; the owner separately approved production fixture deletion. Both databases retain their five original users, including the active student-only teststudent account.

Verification: 68 regression tests on Node.js 22, production builds, 13 database scenarios, two concurrency scenarios, 13 live API scenarios in each environment and browser checks at 1440 and 390 px. Forecast access, student/admin boundaries, live role/school changes, single/global logout, disabling, password changes and deletion passed. Production logs include the expected 403 denials generated by the permission tests; no unexpected application failures were found. Mobile coverage uses browser emulation, not a physical iPhone.

See [release details, operational limits and rollback](../releases/RELEASE_2026-09-07_SESSION_REVOCATION.md). Next bounded work is login abuse protection and CSRF/origin controls for mutations, followed by the tenant/privacy audit and the global-identity/membership decision. The complete roadmap is below. Future releases retain staging-first owner review unless explicitly authorised otherwise.

## Current development direction: self-service and school monetisation

On 7 September the owner said they were happy with the forecast module and design and requested a revised development plan. The review is saved in [Development plan](../../DEVELOPMENT_PLAN.md), with a supporting [Commercial and privacy architecture proposal](../../COMMERCIAL_AND_PRIVACY_ARCHITECTURE.md). The previous plan is preserved unchanged in [the September archive](../plans/DEVELOPMENT_PLAN_ARCHIVE_2026-09-07.md).

Recommended next work: session/tenant security, global accounts and multi-school roles, then self-service registration and privacy controls. Follow with forecast-to-lesson discovery and reliable booking, configurable plans and school subscriptions, Connect lesson payments, then packages and verified feedback. Preserve the accepted forecast model and design.

Commercial recommendations are proposals: keep the current surfer forecast free; offer a free school listing and a 30-day management trial, then test a €39/month school plan. Consider optional paid surfer tools only after validating demand. Prices, tax treatment, merchant responsibilities, retention policies and provider choices require resolution before their relevant launch. The supplied operator name/tax number is recorded in the new documents; missing legal/contact details must not be invented.

This planning change modifies documentation only. It does not implement features, provision services, alter accounts or databases, or authorise deployment. The next implementation brief and acceptance criteria are in the plan. Continue the staging-first owner-review workflow for future releases.

## Earlier application change: login caption, 7 September 2026

Application revision `8e9a9bb4b446f3db92b8e321abddd8a158a625c7` changes the login caption to “Lessons, people and forecasts in one place.” The owner explicitly requested both staging and production for this copy change. The recorded verified deployment IDs are staging `dpl_JE31dDrmXcnqdCRDkv3eSLyJrJd3` and production `dpl_4jHMiHpdM2hHGjukmuw7xSkDmS5e`. This documentation review does not perform another live verification.

## Previous release: forecast refresh recovery and login wording

The owner explicitly authorised these fixes on staging and production on 6 September 2026, with verification afterwards. Both environments now run application revision `657333b8dc1c37798cf3c342ae59370f4a7c65d1`. Staging was verified before production. The login tagline is “Made for surfers and surf schools”.

Production's intermittent unavailable forecasts came from failed weather requests being cached as successful partial results for ten minutes. The fix adds bounded provider retries, preserves a compatible complete forecast with its original timestamp and a warning, retries incomplete data after one minute, waits for simultaneous refreshes and shows visible refresh feedback. No forecast inputs are invented or mixed across refreshes. Spot calibration, permissions, schema and business records are unchanged.

All 58 tests and the build passed. Live verification passed in each environment for all 17 spots, 6,936 scored hourly records, 16 days, energy and water-temperature availability, lesson conditions and simultaneous refreshes. Desktop/mobile browser checks passed at 1440 and 390 px; controlled local failures confirmed retained content, honest timestamps and automatic recovery. Both databases had complete caches without failure markers afterwards, and deployment-scoped warning/error/fatal logs were empty during verification.

Verified staging deployment: `dpl_6FmcNRKzy3ZCSxnhnPtWkEvxpysV`. Verified production deployment: `dpl_2rNHMmgvgkLND5tbpVsMaSosCV6w`. A documentation-only follow-up keeps both Git branches together. Diagnosis, release details, test limits and rollback are in [Forecast refresh recovery](../releases/RELEASE_2026-09-06_FORECAST_REFRESH.md). This release is complete; the owner's explicit approval applies to these fixes and the login wording, not future unrelated releases.

## Previous release: São Pedro WNW calibration

The owner explicitly authorised this database calibration on staging and production on 6 September 2026, including Bico and Bafureira while preserving their individual behaviour. All three spots now admit useful WNW swell around 280–283°, with strong shelter retained from 290°. Only their generic `exposureByDirection` and `sizeCeilingCurve` settings changed. The current versions are São Pedro 4, Bico 5 and Bafureira 4 in both databases.

The supplied 0.9 m / 10 s / 283° reference now produces small rideable surf, approximately 0.3–0.6 m and Fair at São Pedro/Bico. Bafureira remains more dependent on larger swell and a favourable mid-to-high tide. Existing tide rules, swell gains, experience thresholds and all other calibration values are preserved. No runtime engine or page code changed; forecast and lesson requests load the new database revision directly.

Staging was updated and verified before production. Both passed 1,224 hourly assessment comparisons across the three spots, all 16 forecast days, configuration freshness, unchanged unrelated spots and student write denial. Desktop and mobile browser checks at 1440 and 390 px passed for all three spots, selected-day values, quality colours, time selection and page width. All 49 tests and the build passed. Direct Neon checks confirm matching calibration hashes and versions for all 17 spots across environments, with matching history entries for the new revisions. Browser testing used Chromium desktop/mobile emulation, not a physical iPhone.

The documentation and regression-test follow-up is committed to both Git branches; it makes no runtime code change. Evidence, precise parameter values, before/after results, test limits and rollback versions are in [São Pedro calibration release](../calibration/CALIBRATION_2026-09-06_SAO_PEDRO.md). Reload an already-open Conditions page to retrieve the revised settings immediately. No schema migration, business-record copy or shared-default change was performed.

## Previous release: mobile browser viewport correction

A physical iPhone browser screenshot showed the Conditions workspace using roughly 85% of the available width and leaving a dark strip at the right edge. Application revision `23bdcc385a8c54025d80a24a93eb87bea6d20857` corrects the global mobile viewport and makes the app root, workspace, mobile header and content area fill the available browser width. Safe-area padding is retained for iPhone cut-outs, and pinch zoom remains available.

- Verified staging deployment: `dpl_5RT6XfaU3RwuJNvvX8H6DDAZRrPi`.
- Verified production deployment: `dpl_4wBXGTptaTpdmJrueUvGiNsmQqmW`.
- Both custom domains serve the same application revision.

All 44 tests and the production build passed. Local, staging and production browser checks covered iPhone Safari and iPhone browser profiles at 320, 375, 390, 393, 402, 430, 499, 589, 760 and 761 px. They verified the viewport definition, full-width app shell, the mobile-to-desktop breakpoint, long spot names, document overflow, larger text, browser zoom and browser exceptions. Deployment-scoped error and fatal logs were empty during live verification.

This change affects only browser metadata and responsive CSS. It does not change the database, conditions data, forecast model, permissions or service-worker behaviour.

## Previous release: home-screen support

The owner explicitly authorised deployment of home-screen support to both environments on 6 September 2026. Application revision `1b474234a0187c53d7047d0f64fe9fb534c15582` was verified on staging, then deployed and verified on production. Both environments support browser-tab icons and smartphone home-screen installation, including Apple metadata and a dedicated iPhone icon. The app opens Conditions in a standalone window and retains normal authentication.

- Verified staging deployment: `dpl_BGDLjaWwUpohyH5cxQMaA2Jmfqar`.
- Verified production deployment: `dpl_2rgdYZy7hcmtLSVu9nLnVcABNKUi`.
- Previous production rollback reference: `65cdc1ebf3bf0502a8383d7a71060fd7099806af`, deployment `dpl_DLjzUskKXsSTwfLemWr972EPWH59`.
- A documentation-only follow-up records completion on both Git branches. The IDs above identify the tested application release.

All 44 tests and the build passed. Local, staging and production browser checks passed for public manifest/icon loading, required icon sizes, manifest parsing and primary-icon decoding, Chrome installation diagnostics with no errors in a temporary regular profile, app launch through login into Conditions, navigation/public-page metadata, browser-colour updates and mobile layouts. The Apple image is opaque and the Android maskable artwork stays inside its safe circle. Browser checks use mobile emulation; a physical iPhone Home Screen installation was not available to test.

No database migration, business-record copy or service-worker cache was introduced. Forecast freshness and server permissions are unchanged. Installation instructions, assets and verification limits are in [Home-screen support](../../HOME_SCREEN.md). This release is complete; the specific permission to deploy both environments does not replace the standing staging-review requirement for future changes.

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

No database synchronisation is needed for presentation changes. Both environments have separate databases and can accumulate different bookings, login metadata and forecast-cache entries. To roll back this release, redeploy the previous production application reference above through the normal release process; retain the current production database and reconcile any subsequent code changes. Full release details are in [presentation release notes](../releases/RELEASE_2026-09-06_PRESENTATION.md).

Environment IDs, rollback resources and local setup are in [Staging environment](../../ENVIRONMENTS.md). The [development plan](../../DEVELOPMENT_PLAN.md), [design review](../audits/UX_AUDIT_2026-09.md#conditions-presentation-review-6-september-2026), [algorithm](../../CONDITIONS_ARCHITECTURE.md) and [spot schema](../../SPOT_DATA_MODEL.md) contain the detailed decisions.
