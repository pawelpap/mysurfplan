# MyWavePlan current handover

Updated 9 September 2026. This is the single current handover. [Documentation index](README.md) · [Current task roadmap](IMPLEMENTATION_ROADMAP.md) · [Product plan](DEVELOPMENT_PLAN.md) · [Environment guide](ENVIRONMENTS.md).

## Current position

The forecasting module and accepted visual design are the implemented baseline. The latest recorded runtime on both staging and production is `76bdcb73ae4713d913a2dd3ccc337a8781da5d07`, verified on 8 September. This documentation tidy-up did not recheck live deployments, change application code, migrate data or deploy anything.

| Environment | URL | Git branch | Vercel project | Recorded runtime deployment |
| --- | --- | --- | --- | --- |
| Staging | [staging.mywaveplan.com](https://staging.mywaveplan.com) | `staging` | `mysurfplan-staging` | `dpl_9qXjY5xNZcP4ehuYuTBicqbYfN6x` |
| Production | [mywaveplan.com](https://mywaveplan.com) | `main` | `mywaveplan-prod` | `dpl_44J4FUH7pZeon6twpNYonzcP73zX` |

The latest release added shared login limits, safe login errors and mutation-origin protection. Its additive migration was applied separately to both databases. Recorded verification: 77 regression tests, seven isolated database scenarios, nine live API scenarios per environment and desktop/mobile browser checks. These are prior release results, not tests rerun during this tidy-up. See [request-security evidence and rollback](archive/releases/RELEASE_2026-09-08_REQUEST_SECURITY.md).

Forecasts include 17 active database spots, lesson conditions, tides/daylight, swell components, energy/power, water temperature and required experience. Generic São Pedro was removed; Bico and Bafureira remain separate, and Praia da Torre is included. Calibration uses generic database parameters. Preserve the accepted colours, equal metric emphasis, selected-time graph interaction, mobile layout, appearance selector and nearest-spot behaviour. [Latest documented spot rollout](archive/calibration/2026-09-07-local-review/README.md).

Staging and production databases are separate. Spot/configuration parity was checked at the documented release; sessions, caches and operational records can subsequently differ. Do not copy a business database to make a presentation release or assume historical row counts are current.

## Next development step

**A1: audit and fix school boundaries, public-response privacy and demo isolation. Effort M; FE, BE and DB.**

- Inventory read/write endpoints and verify platform-admin, school-admin, instructor, student and unauthenticated access.
- Test two-school isolation, including altered resource IDs/filters and private response fields.
- Remove production `/test/*` playground routes and prevent demo access to customer-private records.
- Preserve existing legitimate access, session/origin/rate protections, forecasts and design. Record gaps that need the later membership migration.

Then complete supported dependency work and prepare B1/B2's global identity and school-membership migration. A3–A5 provider/policy decisions and A8's EU destination decision can progress alongside A1. Task estimates, dependencies and completion evidence are maintained only in the [roadmap](IMPLEMENTATION_ROADMAP.md).

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
