# MyWavePlan current handover

Updated 9 September 2026. This is the single current handover. [Documentation index](README.md) · [Current task roadmap](IMPLEMENTATION_ROADMAP.md) · [Product plan](DEVELOPMENT_PLAN.md) · [Environment guide](ENVIRONMENTS.md).

## Current position

**B1 is deployed and verified on staging and production.** The verified release commit is `f006f4608b2979bf4b0d1a74944279075c61da40`. It adds the membership foundation while preserving current application permissions and design. A1 access/privacy protections and A2 dependency/security cleanup remain in place.

| Environment | URL | Git branch | Vercel project | Verified release deployment |
| --- | --- | --- | --- | --- |
| Staging | [staging.mywaveplan.com](https://staging.mywaveplan.com) | `staging` | `mysurfplan-staging` | `dpl_67Wc4hPy7cgcRUrhKNzwrCP1p4rz` |
| Production | [mywaveplan.com](https://mywaveplan.com) | `main` | `mywaveplan-prod` | `dpl_4KxMZiEsGGHMFXb2CWJ18jSXhiDK` |

These are the builds that received the full release checks. Documentation-only follow-ups can produce later deployment IDs with identical application code. [B1 release evidence](archive/releases/RELEASE_2026-09-09_MEMBERSHIP_FOUNDATION.md), [implemented model and migration procedure](MEMBERSHIP_DATA_MODEL.md).

B1 adds school memberships, independent staff-role rows, separate platform assignments, constrained school ownership, invitation storage and an operator reconciliation view. A one-way database trigger mirrors legacy user role/school/deletion changes atomically. `users.role` and `users.school_id` remain authoritative; new membership rows cannot grant live access until B2. No registration, invitation sending, payment, localisation or design flow was enabled.

The same checksummed migration was applied separately to both databases. Source-data fingerprints passed before commit, the complete database schema comparison returned no differences, and legacy/shadow assignment differences remain zero. Each environment retains five accounts, seven schools, nine instructor records, eight customer records, seven lessons, five bookings and 17 active spots at this release. Sessions and caches can differ. No database was copied or reset, and no spot/calibration, password or email-verification values were changed by the migration.

Reconciliation found one instructor account and two student accounts without explicit person-record links, nine unclaimed instructor records, seven unclaimed customer records and seven schools without proven owners. Preserve these records. Schools remain explicitly in legacy mode with no inferred owner; resolve claims before self-service activation. The model document records the decisions and the operator view for B2/B4/B5.

Verification: 83 regression tests, successful Node.js 22 build, zero known npm audit findings, full transaction/DDL rollback and idempotency rehearsal, 24 isolated database scenarios including two ownership races, then 22 schema scenarios and 15 deployed API scenarios in each live environment. Seven browser checks passed in each: retained pre-migration login, automatic nearest Bico and 17-spot distance order, A–Z/manual selection, native tide keyboard interaction, all detailed forecast parameters, mobile dark mode without page overflow, and no page errors. Runtime error/fatal log scans returned no matching entries. All disposable fixtures and test browsers were cleaned up. A physical iPhone/Safari session was not tested.

Next.js 16.3.4, React 19.2.8, Neon driver 1.1.0, Node.js 22 and explicit Webpack remain the A2 baseline. One existing avatar-image lint warning remains for B7. [Dependency reference](DEPENDENCY_BASELINE.md), [A2 evidence](archive/releases/RELEASE_2026-09-09_DEPENDENCY_BASELINE.md), [current permissions](ACCESS_CONTROL.md).

Forecasts retain the accepted colours, equal metric emphasis, selected-time interaction, mobile layout, appearance selector, nearest selection and all 17 spots, including Bico, Bafureira and Praia da Torre. [Latest documented spot rollout](archive/calibration/2026-09-07-local-review/README.md). Piotr's proposed redesign remains future F17/F18 work.

## Next development step and planning decisions

**Next: B2, global identity and school capability authorisation. Effort L; FE, BE and DB.** Begin with B1's reconciliation report, define the capability resolver and plan the authority switch under controlled legacy writes. Retire the compatibility bridge before enabling independent multi-school assignments. Update sessions, API permissions and workspace controls, then remove the old single-school constraints/cascading user deletion at the verified transition point. Preserve bookings and session security; school admins must no longer control global credentials or account status. Rehearse no-school access, two-school isolation, combined roles and immediate suspension. B3–B5 add self-service and verified claims later.

The roadmap now has **70 items: four complete and 66 open**. A3 is complete as a [decision](AUTH_EMAIL_AND_JOBS_DECISION.md): retain app-owned auth, use Mailjet Free initially, and implement a Neon outbox with a Vercel Pro minute worker when email flows ship. Mailjet, the receiving support mailbox, DNS and jobs are not activated. Intended From/Reply-To is `MyWavePlan <support@mywaveplan.com>`. Arrange provider/sender/quota and inbox verification before B3; **do not request AWS signup for the current plan**. No email account is required for B2.

[Piotr's conditions UX feedback](CONDITIONS_UX_REVIEW_PROPOSAL.md) is recorded for later. F17 requires desktop/mobile Figma prototypes and owner review; F18 implements the approved scope through staging review. No Figma file or UI change was made for that proposal.

A4/A5 privacy and permitted-use decisions, A7 capacity/recovery and A8's EU destination work remain open. Minute polling changes Neon consumption, so A7 must settle the technical plan before live jobs. Localisation remains plan-only until authorised. The [roadmap](IMPLEMENTATION_ROADMAP.md) owns dependencies and task status.

## Accepted direction and pending implementation

- One global personal account, multiple school memberships and independent instructor/admin roles. Ownership, platform authority and school subscriptions are separate. The [registration design](REGISTRATION_AND_MEMBERSHIP_PROPOSAL.md) is accepted. B1 storage is deployed; B2–B5 runtime and self-service flows remain pending.
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
