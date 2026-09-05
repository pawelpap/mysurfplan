# MyWavePlan development plan

Last updated: 5 September 2026.

This is the current working plan. Update it after meaningful changes. The previous detailed plan and change log are preserved in `DEVELOPMENT_PLAN_ARCHIVE_2026-06.md`. Findings and implementation limits are in `UX_AUDIT_2026-09.md`.

## Current direction agreed with the owner

Build and review a working proposal at https://staging.mywaveplan.com. Use Figma as a supporting design reference when useful. The user will verify the app on staging. Promote to https://mywaveplan.com only after that review confirms it is ready.

Each screen should support one task. Lists help people find a record. Details explain a record. Creation, editing and booking management use dedicated screens with a clear route back. Avoid combining unrelated tasks or presenting future functionality as if it works.

## Environments and design references

- Application: Next.js Pages Router in `surf/`, React, SQL through Neon.
- Repository: `pawelpap/mysurfplan`.
- `main` publishes through Vercel project `mywaveplan-prod` to mywaveplan.com.
- `staging` publishes through Vercel project `mysurfplan-staging` to staging.mywaveplan.com.
- Both Vercel projects use root directory `surf`.
- Neon project `shy-paper-68550619`: production branch `br-gentle-dawn-ad5l1p9y`, staging branch `br-small-salad-adx0nsj2`.
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
- [x] Owner reviewed the UX proposal positively; production remains on hold.
- [ ] Promote the accepted version to production and verify it there.

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
- [x] Verify live 16-day coverage for every seeded spot and test permissions, missing data and time zones.
- [ ] Deploy and verify this work at staging.mywaveplan.com.
- [ ] Owner reviews the conditions and tunes initial spot assumptions.

See [Conditions architecture, sources and limitations](CONDITIONS_ARCHITECTURE.md). Numerical surf coefficients are initial heuristics. Tide heights use mean sea level and a named regional reference. Commercial API access must be configured before commercial use; no paid subscription has been purchased.

## Core reliability backlog

Prioritise after the UX review:

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

## Conditions architecture and future payments

The conditions architecture is implemented for staging and documented separately. Next, collect instructor observations to calibrate each break and verify new regional tide references. Keep the difference between surf quality and required experience visible.

Payments are a future module. Agree booking/payment states, cancellation and refund rules, currencies and provider before implementation.

## Verification and deployment log

- 5 September 2026: Baseline build passed. Production and staging logins, public desktop/mobile screens, service access and environment mapping reviewed.
- 5 September 2026: Six validation tests and the production build passed with Node.js 22.
- 5 September 2026: Initial proposal deployed as `dcbd97d`. Follow-up: remove the staging label, improve mobile layouts, restore the surf illustration on login, and fix native date/time form saving. Conditions will start only after the owner provides the next instructions.
- 5 September 2026: Final application update `5c7e944` deployed successfully to staging (`dpl_GMLEteELqb2PuW9rb7ZJbAdA9oVy`). Verified the illustrated login on desktop and mobile, lesson creation, date/time/duration/capacity editing, instructor assignment, bookings, full-capacity validation and person editing. Mobile checks at 390 × 844 covered list/form layout, navigation and Escape dismissal. Public date filtering passed without browser errors after the timezone hydration fix.
- Review data is available in the staging-only school `Demo Surf School - UX review`, with two lessons, sample instructors and two bookings. Sample user profiles have no login password configured. Existing user-created schools were preserved.
- This pass does not establish full student/instructor end-to-end coverage or concurrent booking correctness. Those remain in the reliability backlog. Production remains on `520d826` at mywaveplan.com. The UX proposal was subsequently accepted for staging; conditions instructions are now incorporated into Milestone 2.

- 5 September 2026: Applied the additive conditions migration to staging only. Seeded 17 spots, mapped existing lessons and verified complete 16-day live forecasts for every spot. Reload and duplicate-refresh checks passed.
