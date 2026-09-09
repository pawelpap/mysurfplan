# MyWavePlan current handover

Updated 9 September 2026. This is the single current handover. [Documentation index](README.md) · [Current task roadmap](IMPLEMENTATION_ROADMAP.md) · [Product plan](DEVELOPMENT_PLAN.md) · [Environment guide](ENVIRONMENTS.md).

## Current position

The forecasting module and accepted visual design remain the baseline. A1 school-access/privacy protections and A2 dependency/security cleanup are deployed on staging and production. The verified runtime commit is `4f9d93fb64b5d4ccc046849d8eb9d795caa3857c`, released on 9 September.

| Environment | URL | Git branch | Vercel project | Verified runtime deployment |
| --- | --- | --- | --- | --- |
| Staging | [staging.mywaveplan.com](https://staging.mywaveplan.com) | `staging` | `mysurfplan-staging` | `dpl_3fbAuy5PCQYosxCvjAqsTPiVwh3R` |
| Production | [mywaveplan.com](https://mywaveplan.com) | `main` | `mywaveplan-prod` | `dpl_AXGvebpEZyjMn6f2nQB6ivLCYjRU` |

The table identifies builds that received the full runtime checks. Documentation-only follow-ups can produce later deployment IDs with the same application code.

The runtime uses Next.js 16.3.4, React 19.2.8 and Neon driver 1.1.0 on Node.js 22. Webpack remains the explicit development/build bundler after a local Turbopack rehearsal exposed nested lesson-route 404s. Two dynamic queries use the new driver's parameterised API. Contentful's empty generated directory and three unused settings per Vercel project were removed, together with five unused packages. [Dependency decision and maintenance](DEPENDENCY_BASELINE.md), [release evidence and rollback](archive/releases/RELEASE_2026-09-09_DEPENDENCY_BASELINE.md).

Verification: clean install, zero known npm audit findings, no invalid peers, 83 regression tests, successful build and 13 real API/database scenarios on the isolated rehearsal branch, staging and production. Browser checks passed at desktop/mobile widths with hourly swell details, tide interaction, light/dark appearance, refresh, legal navigation and logout. Simulated locations at Bico and Praia Grande confirmed automatic nearest selection and all 17 spots in distance order. A–Z/manual-selection behaviour, explicit spot links and location-denied fallback passed on both live environments. Staging checks completed before production promotion. No matching runtime error/fatal logs were returned during verification. A physical iPhone/Safari session was not tested in this release.

No schema migration, spot/calibration update, database copy or account reset was required. Disposable release fixtures were removed. One existing lint warning for avatar images remains for B7's media work. A1's [current permissions](ACCESS_CONTROL.md) remain in force; independent admin/instructor roles and global membership are future B1/B2 work.

Forecasts include 17 active database spots, lesson conditions, tides/daylight, swell components, energy/power, water temperature and required experience. Generic São Pedro was removed; Bico and Bafureira remain separate, and Praia da Torre is included. Calibration uses generic database parameters. Preserve the accepted colours, equal metric emphasis, selected-time graph interaction, mobile layout, appearance selector and nearest-spot behaviour. [Latest documented spot rollout](archive/calibration/2026-09-07-local-review/README.md).

Staging and production databases are separate. Spot/configuration parity was checked at the documented release; sessions, caches and operational records can subsequently differ. Do not copy a business database to make a presentation release or assume historical row counts are current.

## Next development step

**A3: decide the authentication, transactional email and background-job approach. Effort S; BE and Ops.**

Document whether to retain or migrate the current authentication, based on email verification, password recovery and platform-admin MFA requirements. Select the proposed email provider, sender/domain setup and durable retries/jobs, with costs and EU-region requirements. Keep provider purchases, account changes and provisioning separate from this decision. A3 should give B1/B2 a stable basis for global users, school memberships and independent roles.

A1 and A2 are complete. Prepare B1's additive membership schema/backfill and B2's authorisation change after A3. A4/A5 privacy and permitted-use decisions, A7 capacity/recovery and A8's EU destination work remain open. Localisation is still plan-only. Task estimates, dependencies and completion evidence are maintained in the [roadmap](IMPLEMENTATION_ROADMAP.md).

## Accepted direction and pending implementation

- One global personal account, multiple school memberships and independent instructor/admin roles. Ownership, platform authority and school subscriptions are separate. The [registration design](REGISTRATION_AND_MEMBERSHIP_PROPOSAL.md) is accepted; implementation is pending.
- EU storage is the preferred launch policy. A8 chooses the exact region and covers database/recovery copies, media, logs, runtime and external processors before real onboarding. The last infrastructure check, 8 September, recorded Neon in AWS us-east-1. No EU migration has occurred.
- Localisation is roadmap-only at the owner's explicit request. A9 establishes the switcher and language framework; B10 completes English, European Portuguese and Spanish before G1. French is optional. No localisation implementation has started.
- G1 is a controlled self-service/pay-at-school pilot; G2 adds paid school software; G3 adds online lesson payments. Consent, GTM, GA4, dataLayer events and Search Console are included in C5/C6, with payment events added when commerce ships.
- Keep the current surfer forecast free. Prices, trial/grace periods, payment configuration and legal policies remain proposals until their recorded decisions. Paid commercial services activate through L1 immediately before their first qualifying use; technical capacity/recovery upgrades happen when needed.
- The [small-launch budget](LAUNCH_COST_ESTIMATE.md) is €70–100/month before tax and payment fees under its assumptions. No purchase was made. The last account review recorded Vercel Hobby, Vercel-managed Neon Free and 10/10 occupied branch slots; recheck capacity before migration rehearsal. See [infrastructure decisions](INFRASTRUCTURE_CAPACITY_AND_UPGRADES.md).
- Later reviews, progress, opt-in rankings, feedback prompts, forecast evaluation, service providers, advertising and mobile apps are conditional roadmap work. Surfline session imports remain deferred. Do not add artificial forecast probabilities or let payment affect organic rankings or forecast scores.

## Release and verification workflow

Use the [environment guide](ENVIRONMENTS.md) for database mapping, local setup and migration prerequisites. Never commit secrets, session files or private connection exports. Keep existing provider accounts; a migration proposal does not authorise reconnecting or switching accounts.

Prepare a bounded change, verify it locally, deploy to staging and test the affected desktop/mobile journeys. Production follows the owner's approval unless that specific task explicitly authorises promotion after passing staging tests. After promotion, verify production, update this handover and add a dated release record. Do not treat approvals in archived releases as authority for new work.

Run relevant automated and build checks for runtime changes. Use targeted link/content checks for documentation-only changes. Preserve evidence and a compatible rollback path; clean only authorised disposable fixtures and close temporary test tabs. Shared requirements are in the [roadmap definition of done](IMPLEMENTATION_ROADMAP.md#shared-definition-of-done).

## Documentation organisation

The 9 September tidy-up kept the current roadmap, product plan, handover and supporting references at the docs root. Superseded plans, dated releases/audits and calibration evidence now live under [archive](archive/README.md). The former README-staging.md is now ENVIRONMENTS.md and covers both environments. Relative links and the application README were updated.

The [full prior handover](archive/handovers/HANDOVER_2026-09-09_BEFORE_DOCS_CLEANUP.md) preserves older deployment IDs, rollout decisions and verification history. Historical rollback resources are evidence to recheck, not current instructions. No historical evidence was intentionally discarded.
