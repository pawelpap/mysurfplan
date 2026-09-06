# MyWavePlan development plan

Last updated: 6 September 2026.

This is the current working plan. Update it after meaningful changes. The previous detailed plan and change log are preserved in `DEVELOPMENT_PLAN_ARCHIVE_2026-06.md`. Findings and implementation limits are in `UX_AUDIT_2026-09.md`.

## Current direction agreed with the owner

Build and review a working proposal at https://staging.mywaveplan.com. Use Figma as a supporting design reference when useful.

Standing deployment instruction, clarified by the owner on 6 September 2026: deploy changes to staging, complete the checks and tell the owner staging is ready. Stop before production and wait for the owner's explicit approval of that change after they have tested staging. Passing automated checks, approval of an earlier release or a request for further changes does not authorise production deployment. This applies to small visual corrections as well as larger releases.

The earlier instruction allowing automatic promotion of the calibration, swell-energy and water-temperature release was specific to that completed release. It must not be reused for later changes.

Each screen should support one task. Lists help people find a record. Details explain a record. Creation, editing and booking management use dedicated screens with a clear route back. Avoid combining unrelated tasks or presenting future functionality as if it works.

## September release: generic database calibration

Owner decision, 6 September 2026: all surf calibration values and configurable rules must live in the database in a proper generic schema. This is the next development priority. Keep the reusable calculation engine and validation in code; remove spot-specific branches, named spot presets and hard-coded calibration defaults from it.

Scope:

- [x] Inventory every calibration value and rule in the existing model, including wave gains, directional curves, period response and limits, wind adjustments, tide suitability, score weights and penalties, quality boundaries, experience thresholds, severe-condition limits and displayed surf-range factors.
- [x] Design a documented, versioned database schema for model profiles, generic rule definitions and spot assignments or overrides. Specify types, units, valid ranges, required fields and rule precedence, with database and API validation. A loosely structured JSON object alone is not sufficient. Shared defaults must also be stored and versioned in the database.
- [x] Replace `bico` and `bafureira` tide presets with generic tide-range rules conditional on swell or other supported inputs. Replace `northWindShelter` with a reusable wind-direction exposure curve. No rule may depend on a spot name, slug or forecast date.
- [x] Make the shared engine load a complete validated configuration for both the Conditions screen and lesson forecasts. Missing or unsupported configuration must produce a clear error instead of silently using hard-coded calibration values. Keep mathematical operations, unit conversions and configuration validation in code.
- [x] Provide platform-admin editing for all calibration settings, with units, validation, change notes, source references, version history, concurrent-edit protection and restoration of earlier versions. Record which engine/configuration versions produced an assessment and make cache reuse respect those versions.
- [x] Migrate all existing spots and shared defaults into the new schema, preserving current forecast behaviour, spot IDs, lesson links and calibration history. Keep rollback available. Treat this task as a structural cleanup; changes to forecast assumptions require separate evidence and review.
- [x] Verify equivalent results using fixed forecast inputs before and after migration. Cover Bico's swell-dependent tide range, Bafureira, directional interpolation and north wrap, Caparica, score/experience boundaries and missing data. Demonstrate that a new spot and its calibration can be configured entirely through the database-backed admin workflow without changing application code.
- [x] Update the algorithm and schema documentation, deploy to staging and verify desktop/mobile admin editing plus forecast/lesson consistency. Promote after staging checks pass, as authorised by the owner.

Completion means every tunable surf calibration value and supported calibration rule is database-owned, validated and versioned; the same generic engine evaluates every spot without embedded local exceptions.

Current implementation references: [algorithm and architecture](CONDITIONS_ARCHITECTURE.md), [spot schema and coefficients](SPOT_DATA_MODEL.md), and [`lib/conditions/model.mjs`](../lib/conditions/model.mjs).

## September release: swell energy and water temperature

Owner request, 6 September 2026: calculate swell energy and present it clearly in forecasts and lesson conditions. Schedule this after the generic database calibration cleanup.

- [x] Define the metric, formula, units and assumptions using authoritative references. Distinguish energy from wave power, verify which height and period variables the provider supplies, and document any approximation.
- [x] Calculate the metric consistently for the available swell components and define how they combine without double-counting. Distinguish offshore values from any estimated local values; use the generic calibration schema for all tunable coefficients, thresholds and display bands.
- [x] Show swell energy in the Conditions screen and lesson details, with clear units and a short explanation. Values must follow the selected graph time or lesson time, refresh with the forecast and remain readable on mobile.
- [x] Keep energy separate from surf quality and required experience so a high value does not imply good or beginner-friendly conditions. Review any future influence on those scores as a separate model change.
- [x] Verify reference calculations, units, multiple swells, missing inputs, time selection and lesson consistency. Document the method and validate the desktop/mobile presentation on staging before the authorised production deployment.

Implemented and locally verified: 37 tests pass, including 5,712 legacy parity cases. API mutation tests on a disposable Neon branch cover creation, validation, version conflicts, history restoration, default-profile revision and student denial. Browser checks pass at 1440, 390 and 320 px, including native touch, keyboard time selection, exact metric synchronisation, lesson cards, missing future temperature and admin editor layout. Calibration-only staging release `41bbb72` is live and its API checks pass. The complete application release `ae55e26` passed live API and browser checks on staging and production. All 17 database spot configurations, the schema and default profile match between environments. Existing production business records and legacy calibrations were verified unchanged. See [release notes](RELEASE_2026-09-06.md).

- [x] Add independent best-match marine sea-surface temperature ingestion, join it by UTC timestamp and preserve missing values beyond its forecast horizon. A temperature outage must not disable the wave forecast.
- [x] Present energy and water in matching teal cards in selected conditions, expanded mobile hours and lesson details, with compact desktop hourly values and optional explanations.
- [x] Document the formula, units, partition mapping, period approximation, offshore interpretation and water-data horizon in [Swell energy and water temperature](SWELL_ENERGY_AND_WATER_TEMPERATURE.md).
- [x] Complete live staging verification for both additions, then migrate production and deploy the same code.

## Presentation adjustment: equal emphasis for forecast parameters

Owner feedback, 6 September 2026: energy and water temperature should have the same visual emphasis as the other parameters. The separate teal cards and icons were replaced with shared metric cells in selected conditions, expanded mobile hours and lesson details. Values, units, explanations and selected-time behaviour were preserved. Commit `1938804` was deployed to staging and production before the owner clarified the approval requirement above. All subsequent changes must wait for the owner's staging review and explicit production approval.

## Staging proposal: consistent emphasis for all forecast parameters

Owner clarification, 6 September 2026: no forecast parameter should be visually highlighted above the others. Include surf quality and required experience in the same metric grid as the physical conditions. Remove filled score badges and oversized score typography from selected forecasts, lessons, daily outlooks and mobile hours. Keep clear labels, units, quality descriptions and readable experience levels. Deploy to staging for the owner's review; production must retain the previously approved version until the owner explicitly approves this proposal.

## Decision: keep our swell-energy measure

Owner request, 6 September 2026: investigate Surfline's energy units and try to provide a comparable scale. Surfline uses kJ with height, period and spot-direction effects. Its public explanation does not specify the full coefficients or reference dimensions needed to reproduce the numbers. Our current offshore kJ/m² density and kW/m power cannot be converted to that scale by changing the unit label.

- [x] Verify Surfline's published definition and document the distinction in [Swell energy and water temperature](SWELL_ENERGY_AND_WATER_TEMPERATURE.md#surfline-units-investigation-on-6-september-2026).
- [x] Owner decision after reviewing the finding: keep our existing energy density in kJ/m² and estimated power in kW/m. No Surfline-scale conversion is scheduled. Preserve equal visual emphasis with the other parameters.

The research has not changed application code or deployments. The consistent-emphasis proposal remains on staging only, awaiting review.

## Staging review: conditions layout and hourly parity

Owner request, 6 September 2026: keep every forecast parameter available on desktop and mobile, add desktop hourly swell components, restrict spot settings to platform admins, improve dropdown spacing, order spots alphabetically and simplify the screen without removing data.

- [x] Reuse one hourly details component in expandable desktop rows and mobile cards. Include primary, secondary and tertiary swell height, period and direction; gusts; tide height/stage/trend; weather and rain; swell energy and power; water temperature; and assessment notes. Keep quality, experience and estimated surf in the hour summary.
- [x] Put the tide/time control before selected-time metrics. Preserve daylight markers, tide extremes, keyboard and touch selection. Add selected-time gusts and tide stage/trend.
- [x] Remove duplicated spot headings and instructional banners. Use compact, unfilled disclosures for swell components and one forecast guide. Keep uncertainty, missing-data notices and operational assessment reasons.
- [x] Keep all metric values at the same visual level and retain the workspace typography, colours and form styles. Give native dropdown chevrons a 14 px right inset and reserve text space.
- [x] Sort the shared spot-list API alphabetically, ignoring case and accents. Both Conditions and lesson dropdowns use this list. Remove the obsolete priority input while preserving stored values.
- [x] Keep editor controls and direct editor URLs restricted to platform admins. Verify spot writes and calibration settings/history access are denied for other roles.
- [x] Deploy application commit `48b3a49` to staging and verify its custom domain: all 17 spots in alphabetical order, equal desktop/mobile hourly details, five viewport widths, explicit refresh, chosen-time keyboard/touch interaction, lesson conditions, missing data and role access. Production remains on `1938804`.
- [ ] Owner reviews the staging candidate and explicitly approves production. Do not promote before this approval.
- [ ] After approval, deploy the accepted code to production, verify it and update the deployment records, plan and [handover](HANDOVER.md). This candidate requires no database migration.

Review findings and decisions are in [the conditions design review](UX_AUDIT_2026-09.md#conditions-presentation-review-6-september-2026).

## Environments and design references

- Application: Next.js Pages Router in `surf/`, React, SQL through Neon.
- Repository: `pawelpap/mysurfplan`.
- `main` publishes through Vercel project `mywaveplan-prod` to mywaveplan.com.
- `staging` publishes through Vercel project `mysurfplan-staging` to staging.mywaveplan.com.
- Both Vercel projects use root directory `surf`.
- Neon project `shy-paper-68550619`: production branch `br-weathered-silence-adp30k9s`, staging branch `br-small-salad-adx0nsj2`.
- Work branch: `codex/task-oriented-staging`.
- Figma: https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ
- Current page: `CURRENT - Task-oriented UX - September 2026` (`309:2`).
- Previous page: `ARCHIVE - Previous app design - June 2026` (`20:2`).

## Milestone 1: working UX proposal on staging

Implementation:

- [x] Inspect source, existing plans, live screens, GitHub, Vercel, Neon and Figma.
- [x] Document the audit and distinguish implemented functions from missing features.
- [x] Build a consistent workspace shell with visible school context and role-based navigation.
- [x] Give lists, details, create/edit forms and booking management separate screens.
- [x] Preserve school, screen, selected record and lesson period in URLs.
- [x] Default to upcoming lessons; add Past and student My bookings views.
- [x] Add search and role/level filters to the main lists.
- [x] Implement lesson detail editing, including duration and capacity, with server validation.
- [x] Add dedicated instructor assignment and booking tasks.
- [x] Add school editing and focused account forms.
- [x] Simplify login and public schedules; preserve the lesson through login.
- [x] Exclude expired public lessons and remove instructor emails from public lesson responses.
- [x] Restrict student attendee data to their own booking.
- [x] Replace CDN Tailwind styling with local CSS; keep Poppins and system-font fallback.
- [x] Remove mock forecasts and misleading inactive controls from the proposal.
- [x] Add focused validation tests and declare the Neon dependency directly.
- [x] Complete production build using Node.js 22 and six validation tests.
- [x] Verify mobile lesson list, single-column form, menu and Escape dismissal at 390 px.
- [x] Verify the final login illustration and date/time fix on staging.
- [x] Publish the initial proposal on staging.
- [x] Verify the final update on staging.
- [x] Owner reviewed the UX proposal positively and approved production promotion on 5 September 2026.
- [x] Promote the accepted version to production and verify it there.

No database migration is required for this milestone. No payment module, real forecast or attendance state is claimed as complete.

## Milestone 2: spot and lesson conditions

The owner authorised this work on staging and explicitly asked to keep production unchanged.

- [x] Add a separate Conditions task with a spot selector and sixteen forecast days.
- [x] Store 17 nearby spots in Neon, including separate São Pedro Bico and Bafureira profiles.
- [x] Require an active database spot for lesson creation, editing and new bookings.
- [x] Add global spot creation and editable local calibration with version history.
- [x] Integrate real swell, wind and simplified weather forecasts.
- [x] Calculate full-horizon astronomical tides from open harmonic constants.
- [x] Show quality and required experience separately, including lesson-level mismatch warnings.
- [x] Show time-specific conditions across the complete lesson duration.
- [x] Refresh on page reload, share duplicate requests briefly, and check automatically while open.
- [x] Build responsive desktop and mobile forecast layouts with tide curves and direction arrows.
- [x] Start the default hourly forecast at 06:00 and include first light, sunrise, sunset and last light.
- [x] Add the staging `teststudent` account with student permissions; only platform admins can manage spots.
- [x] Verify live 16-day coverage for every seeded spot and test permissions, missing data and time zones.
- [x] Deploy and verify this work at staging.mywaveplan.com.
- [x] Owner reviewed the conditions and approved production promotion. Continue tuning spot assumptions using local observations.

See [Conditions architecture, sources and limitations](CONDITIONS_ARCHITECTURE.md). Numerical surf coefficients are initial heuristics. Tide heights use mean sea level and a named regional reference. Commercial API access must be configured before commercial use; no paid subscription has been purchased.

## Core reliability backlog

Continue after the conditions tasks above:

1. Link instructor login accounts to teaching profiles. Migrate existing records safely and keep account/profile changes consistent.
2. Harden sessions and account lifecycle: required production secret, expiry enforcement, Secure cookies, revocation, login rate limiting and consistent permission checks.
3. Verify school scoping, student privacy and booking/capacity integrity with integration tests, including concurrent requests.
4. Add actual attendance states and instructor access for assigned lessons. Keep attendance inside the lesson workflow.
5. Add student registration, multi-school memberships and school-admin approval.
6. Add self-service profile editing, profile image upload and password reset delivery.
7. Remove public playground routes and standardise error responses and authenticated cache behaviour.

Preserved product decisions:

- Password login is sufficient for now; passwords use versioned scrypt hashes.
- Telephone number is optional and stored on users.
- People share first name, family name, email, telephone, photo and description fields.
- A user should eventually belong to multiple schools through `user_school_roles`; `users.school_id` is a temporary single-school model.
- Students should self-register and request school membership; school admins approve access.
- School admins manage lessons and bookings. Instructors should manage attendance for assigned lessons.
- Keep the `/` workspace and public `/:slug` schedules while validating UX. Query routes currently give each task a distinct URL without introducing `/admin` route churn.
- Conditions is the first menu item and the default workspace after login, including for the shared `teststudent` account. Explicit links to lessons and other tasks retain their destination.

## Conditions architecture and future payments

The conditions architecture, generic database calibration, swell energy and water temperature are implemented. The current task is the conditions presentation review above. Use instructor observations to refine each break and verify new regional tide references. Keep the difference between surf quality and required experience visible.

Payments are a future module. Agree booking/payment states, cancellation and refund rules, currencies and provider before implementation.

## Verification and deployment log

- 5 September 2026: Baseline build passed. Production and staging logins, public desktop/mobile screens, service access and environment mapping reviewed.
- 5 September 2026: Six validation tests and the production build passed with Node.js 22.
- 5 September 2026: Initial proposal deployed as `dcbd97d`. Follow-up: remove the staging label, improve mobile layouts, restore the surf illustration on login, and fix native date/time form saving. Conditions will start only after the owner provides the next instructions.
- 5 September 2026: Final application update `5c7e944` deployed successfully to staging (`dpl_GMLEteELqb2PuW9rb7ZJbAdA9oVy`). Verified the illustrated login on desktop and mobile, lesson creation, date/time/duration/capacity editing, instructor assignment, bookings, full-capacity validation and person editing. Mobile checks at 390 × 844 covered list/form layout, navigation and Escape dismissal. Public date filtering passed without browser errors after the timezone hydration fix.
- Review data is available in the staging-only school `Demo Surf School - UX review`, with two lessons, sample instructors and two bookings. Sample user profiles have no login password configured. Existing user-created schools were preserved.
- This pass does not establish full student/instructor end-to-end coverage or concurrent booking correctness. Those remain in the reliability backlog. Production remains on `520d826` at mywaveplan.com. The UX proposal was subsequently accepted for staging; conditions instructions are now incorporated into Milestone 2.

- 5 September 2026: Applied the additive conditions migration to staging only. Seeded 17 spots, mapped existing lessons and verified complete 16-day live forecasts for every spot. Reload and duplicate-refresh checks passed.

- 5 September 2026: Conditions code `3b0d00b` deployed successfully to staging (`dpl_Ht1GcpjdBvVGT8VRZwzFaBcs2HTM`). Verified all 16 outlook cards, last-day tide events, mobile width and lesson conditions on the custom staging domain. The browser sends `refresh=1` when a conditions page or lesson opens. All 17 automated tests and the production build passed. Production remains on `520d826` / `dpl_G8bxGKWi1rNNeTfif2TrQr63t2ZW`.

## Historical production promotion checklist, completed 5 September 2026

The conditions, optional-username, São Pedro exposure and Caparica wave-sample migrations and the student-only `teststudent` login were included in the approved production release below. These are completed steps, not instructions to repeat them. The current presentation candidate requires no migration or account provisioning; follow the current staging review and handover above.

- 5 September 2026 follow-up: added civil twilight and solar markers directly to the tide graph, student username login, strict platform-admin spot writes, compact mobile hourly cards and São Pedro directional sheltering. The corrected model treats swell partitions and wind waves separately and prevents flat surf receiving Good scores. Twenty-six automated checks and the Node.js 22 build passed before deployment.

- Later 5 September follow-up: retain São João's established wave sample for both Caparica beaches, reject entirely zero-filled wave grids, smooth the small-surf score threshold and simplify experience labels across forecast and lesson views. Rename the staging test school to Demo Surf School. All 29 automated checks and the Node.js 22 build passed. Mobile tide dragging, vertical scrolling, keyboard selection, outside-tap menu dismissal and Escape focus restoration were verified on staging.

- Follow-up UI: graph-selected time drives all summary parameters. Mobile supports direct touch/drag, expandable hour cards, a standard hamburger menu, outside-tap dismissal and Escape. Technical forecast commentary is removed from everyday screens; data attribution is retained on Legal.

## Approved production release, 5 September 2026

The owner requested production parity with staging, then confirmed that production-only records should first be added to staging. The isolated merge rehearsal passed, including a repeat run with no duplicate inserts. Jonny's existing login credential was copied only after explicit approval. The student-only `teststudent` account, Demo Surf School, all 17 spots and their latest calibration are included.

The release database is a fresh copy of the combined staging database. Schema comparison and fingerprints of all 12 business/reference tables matched. Forecast caches are copied too, then refresh independently. Original production data and the pre-merge staging state are retained as rollback resources. Environment-specific session-signing secrets are configured. See `README-staging.md` for the current branch mapping and rollback details.
