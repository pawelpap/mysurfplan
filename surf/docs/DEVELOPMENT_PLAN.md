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
- [ ] Verify the final login illustration and date/time fix on staging.
- [x] Publish the initial proposal on staging.
- [ ] Verify the final update on staging.
- [ ] User reviews the staging app and requests/accepts adjustments.
- [ ] Promote the accepted version to production and verify it there.

No database migration is required for this milestone. No payment module, real forecast or attendance state is claimed as complete.

## Next workstream: conditions

After this UI pass, the owner will provide instructions for the conditions screen and for adding relevant conditions to lessons. Wait for those instructions before starting implementation. Prioritise this workstream next; retain the core reliability backlog below.

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

Conditions need architecture before interface expansion: spot coordinates and preferences, provider selection, ingestion/caching, freshness indicators, score calculation and degraded-data states. Build a useful standalone conditions task and link relevant readings to lessons.

Payments are a future module. Agree booking/payment states, cancellation and refund rules, currencies and provider before implementation.

## Verification and deployment log

- 5 September 2026: Baseline build passed. Production and staging logins, public desktop/mobile screens, service access and environment mapping reviewed.
- 5 September 2026: Six validation tests and the production build passed with Node.js 22. Browser checks in progress. The production branch/domain remain unchanged.

- 5 September 2026: Initial proposal deployed as `dcbd97d`. Follow-up: remove the staging label, improve mobile layouts, restore the surf illustration on login, and fix native date/time form saving. Conditions will start only after the owner provides the next instructions.
