# MyWavePlan current handover

Updated 10 September 2026. This is the single current handover. [Documentation index](README.md) · [Current task roadmap](IMPLEMENTATION_ROADMAP.md) · [Product plan](DEVELOPMENT_PLAN.md) · [Environment guide](ENVIRONMENTS.md).

## Current position

**F18 is deployed and verified on staging, awaiting owner review. Production remains on B2.** The owner authorised staging only. [Conditions UX implementation](CONDITIONS_UX_IMPLEMENTATION.md) is the current behaviour contract; numerical ratings are absent from spot/day tiles, spot cards show now during daylight or the next sunrise at night, and day tiles show 12:00. The follow-up batches requests, reuses summaries for five minutes and fits two mobile carousel cards across on larger phones. The chart cursor controls the detailed view only.

**B2 is deployed and verified on staging and production.** Full release checks ran on `bcb5ceaa640571915129b070ad4ad94b188ea80f`. Memberships now govern school capabilities; global accounts work with no school, several schools and combined administrator/instructor roles. Conditions remains first. Personal My bookings/My teaching and the school workspace selector are available.

| Environment | URL | Git branch | Vercel project | Fully checked deployment |
| --- | --- | --- | --- | --- |
| Staging | [staging.mywaveplan.com](https://staging.mywaveplan.com) | `staging` | `mysurfplan-staging` | `dpl_3qMjzy4ttvuQqftsfUk84e1ouKnY` (F18 daylight follow-up) |
| Production | [mywaveplan.com](https://mywaveplan.com) | `main` | `mywaveplan-prod` | `dpl_FETHv1xL5N3Cgiq5y7LoRLCzaGif` |

F18 application commit is `faed37656edc134696cb87a0047596041b769c72`. The owner-approved daylight/cache/mobile follow-up passed local and staging checks; [release evidence](archive/releases/RELEASE_2026-09-10_SPOT_CARDS_DAYLIGHT.md). Production custom-domain inspection still resolves to B2 documentation commit `91bc4fe2f9cd4c230f05f8ba7928e13610e2e9f3`, deployment `dpl_9uSc1nTvVFCwNS3pfk8sC9JHLa8s`; its last full B2 journey checks are recorded in the table. Documentation-only follow-ups can produce newer deployment IDs with identical application code. [B2 release evidence](archive/releases/RELEASE_2026-09-09_MEMBERSHIP_AUTHORISATION.md), [runtime and migration contract](MEMBERSHIP_AUTHORISATION.md), [current permissions](ACCESS_CONTROL.md).

Both databases have the same schema and checksummed B1/B2 migrations, with `memberships` authority. B2 retired the B1 bridge, blocked legacy authority writes, removed the compulsory school and replaced cascading school-to-user deletion with SET NULL. School administrators cannot manage global credentials/status. Personal bookings use explicit user links; staff booking-on-behalf is separate. School suspension/closure preserves personal login and other-school access.

The owner explicitly authorised deleting irrelevant test data and matching production. Each environment now retains **two accounts** (the owner's platform administrator and `teststudent`), **Demo Surf School**, its one explicitly linked student record and **17 active surf spots**. Other test accounts, schools, instructor records, lessons and bookings were removed after rollback rehearsals. Existing passwords, verification values, protected session records and forecast configuration were unchanged by cleanup. Operational data and current forecast parameters match. Historical calibration values also match; environment-specific audit notes/IDs, sessions, login counters and caches remain separate. Demo Surf School is the only unresolved legacy ownership record; no owner was inferred. The earlier unclaimed test-person/booking issues were removed by this authorised cleanup.

Verification passed: 88 regression tests, Node.js 22 build, dependency tree and zero npm audit findings; migration transaction rehearsal; nine database scenarios, 20 deployed API groups and seven browser checks per environment. Staging received a further seven API groups and seven browser checks after cleanup. Saved pre-migration logins remained valid. Native Chrome checked school-role privacy, multi-school navigation, nearest Bico, 17 spots/16 forecast days, keyboard tide selection, mobile dark mode and no horizontal overflow/page errors. Runtime error/fatal scans returned no matching entries. Disposable fixtures, test sessions and browser contexts were cleaned. Physical iPhone/Safari was not tested; continuous monitoring remains A6.

Next.js 16.3.4, React 19.2.8, Neon driver 1.1.0, Node.js 22 and explicit Webpack remain the A2 baseline. One existing avatar-image lint warning remains for B7. Forecast calculations, colours, parameters and spot calibrations are unchanged.

## Next development step and planning decisions

**F17 is approved; owner review of F18 staging is next.** The [Figma handoff](CONDITIONS_UX_FIGMA_REVIEW.md) retains design evidence; the [implementation contract](CONDITIONS_UX_IMPLEMENTATION.md) records later owner decisions. Do not deploy to production before approval. After F18, core onboarding continues with B3 and its privacy, EU, email and localisation prerequisites.

The owner reviewed the account interface during B2 and accepted a following UI release. The [account and lifecycle follow-up](ACCOUNT_AND_LIFECYCLE_UX_FOLLOWUP.md) documents the exact scope: B3/B4 replace the older single-initial-role/school account form with clearer global account creation and multi-membership management; B5/B8/C4 improve school closure, account deletion and lesson-removal journeys. Current detail screens already provide school/lesson removal, global account deactivation and membership removal. Deactivation is not permanent erasure. This remains scheduled work, not a missing database capability.

The roadmap has **70 items: six complete and 64 open**. A3 is complete as a [decision](AUTH_EMAIL_AND_JOBS_DECISION.md): retain app-owned auth, use Mailjet Free initially, and implement a Neon outbox with a Vercel Pro minute worker when email flows ship. Mailjet, the receiving support mailbox, DNS and jobs are not activated. Intended From/Reply-To is `MyWavePlan <support@mywaveplan.com>`. Arrange provider/sender/quota and inbox verification before B3; AWS signup is not required. F17 needs no email account.

A4/B6 privacy/policies, A5 permitted use, A6/A7 capacity/recovery and A8's EU move remain open. A9 localisation is plan-only until authorised. The [roadmap](IMPLEMENTATION_ROADMAP.md) owns the dependencies and launch gates.

## Accepted direction and pending implementation

- One global personal account, multiple school memberships and independent instructor/admin roles. Ownership, platform authority and school subscriptions are separate. The [registration design](REGISTRATION_AND_MEMBERSHIP_PROPOSAL.md) is accepted. B1/B2 storage and runtime are deployed; B3–B5 self-service flows remain pending.
- EU storage is the preferred launch policy. A8 chooses the exact region and covers database/recovery copies, media, logs, runtime and external processors before real onboarding. The last infrastructure check, 8 September, recorded Neon in AWS us-east-1. No EU migration has occurred.
- Localisation is roadmap-only at the owner's explicit request. A9 establishes the switcher and language framework; B10 completes English, European Portuguese and Spanish before G1. French is optional. No localisation implementation has started.
- G1 is a controlled self-service/pay-at-school pilot; G2 adds paid school software; G3 adds online lesson payments. Consent, GTM, GA4, dataLayer events and Search Console are included in C5/C6, with payment events added when commerce ships.
- Keep the current surfer forecast free. Prices, trial/grace periods, payment configuration and legal policies remain proposals until their recorded decisions. Paid commercial services activate through L1 immediately before their first qualifying use; technical capacity/recovery upgrades happen when needed.
- The [small-launch budget](LAUNCH_COST_ESTIMATE.md) is now €90–120/month before tax/payment fees for the proposed minute-worker and email setup. Continuous polling can keep Neon active; this is a future scenario, not today’s bill. No purchase was made. The last account review recorded Vercel Hobby, Vercel-managed Neon Free and 10/10 occupied branch slots; recheck capacity before migration rehearsal. See [infrastructure decisions](INFRASTRUCTURE_CAPACITY_AND_UPGRADES.md).
- Later reviews, progress, opt-in rankings, feedback prompts, forecast evaluation, service providers, advertising and mobile apps are conditional roadmap work. Surfline session imports remain deferred. Do not add artificial forecast probabilities or let payment affect organic rankings or forecast scores.

## Release and verification workflow

Use the [environment guide](ENVIRONMENTS.md) for database mapping, local setup and migration prerequisites. Never commit secrets, session files or private connection exports. Keep existing provider accounts; a migration proposal does not authorise reconnecting or switching accounts.

Prepare a bounded change, verify it locally, deploy to staging and test the affected desktop/mobile journeys. Production follows the owner's approval unless that specific task explicitly authorises promotion after passing staging tests. After promotion, verify production, update this handover and add a dated release record. Do not treat approvals in archived releases as authority for new work.

Run relevant automated and build checks for runtime changes. Use targeted link/content checks for documentation-only changes. Preserve evidence and a compatible rollback path; clean only authorised disposable fixtures and close temporary test tabs. Shared requirements are in the [roadmap definition of done](IMPLEMENTATION_ROADMAP.md#shared-definition-of-done).

## Documentation organisation

The 9 September tidy-up kept the current roadmap, product plan, handover and supporting references at the docs root. Superseded plans, dated releases/audits and calibration evidence now live under [archive](archive/README.md). The former README-staging.md is now ENVIRONMENTS.md and covers both environments. Relative links and the application README were updated.

The [full prior handover](archive/handovers/HANDOVER_2026-09-09_BEFORE_DOCS_CLEANUP.md) preserves older deployment IDs, rollout decisions and verification history. Historical rollback resources are evidence to recheck, not current instructions. No historical evidence was intentionally discarded.

Latest F18 verification, 10 September: 102 tests and Node.js 22 lint/build passed. The initial F18 dependency tree/audit checks remain applicable; no dependencies changed in the follow-up. Fourteen API groups and nine native Chrome browser groups passed locally and on staging, including batch/single-summary equivalence, partial failure isolation, cache reuse, nearest Bico, linked chart controls, hourly swell components and login themes. Mobile checks fit two cards at 430 px and found no page overflow at 390/320 px. Runtime error/fatal scan on the live deployment returned no matches. The pre-existing avatar warning remains; physical iPhone/Safari was not tested. Test sessions and temporary browsers were cleaned. [Latest release evidence](archive/releases/RELEASE_2026-09-10_SPOT_CARDS_DAYLIGHT.md).
