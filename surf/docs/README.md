# MyWavePlan documentation

11 November 2026. B4 staff invitations and team administration are released on staging and production. Application source hashes match; staging has no cron and production retains its ten-minute email worker. The next build is B5 draft-school creation and onboarding. See the [release record](archive/releases/RELEASE_2026-11-11_STAFF_INVITATIONS.md) and [current handover](HANDOVER.md). Older dated release/status notes are historical.

## Start here

| Document | Role and current status |
| --- | --- |
| [HANDOVER.md](HANDOVER.md) | **Current handover.** Latest recorded release, pending work, decisions and next development step. |
| [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) | **Current task list.** Canonical remaining tasks, S/M/L estimates, dependencies and launch gates. B4 is released; B5 draft-school creation and onboarding is next, with B7 before uploaded branding. |
| [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) | **Current product plan.** Direction, commercial proposals and delivery phases. The roadmap owns individual task status and ordering. |
| [ENVIRONMENTS.md](ENVIRONMENTS.md) | **Current operating reference.** Local setup, staging/production mapping, migrations and release workflow. Replaces README-staging.md. |

## Maintained design and planning references

| Document | Status and purpose |
| --- | --- |
| [Personal data and privacy inventory](PRIVACY_DATA_INVENTORY.md) | A4 audit, 12 September: required/optional/excluded fields, operator details, live schema/count findings, purposes, providers, retention proposals and delivery gaps. |
| [Privacy and contract drafts](PRIVACY_DOCUMENT_DRAFTS.md) | Status of local private drafts: privacy notice, pilot terms and school processing schedule. Full owner-specific text remains in ignored `docs/private/`; review and working contact required before B6 publication. |
| [EU migration and recovery runbook](EU_DATA_MIGRATION_PLAN.md) | Completed Frankfurt database/function move, tested recovery, legacy cleanup, US retirement and current EU branch purposes. [Release evidence](archive/releases/RELEASE_2026-09-12_EU_MIGRATION.md). |
| [Children and guardian bookings](CHILDREN_AND_GUARDIAN_BOOKINGS.md) | F11 proposal: separate purchaser/participant, guardian bookings, age eligibility, private child records and optional later 16–17 accounts. Initial pilot remains adult-only. |
| [Business mailbox setup](MAILBOX_SETUP.md) | Active Zoho Mail Lite mailbox and Support alias; Vercel DNS, authentication and delivery verification. |
| [Mac and iPhone Mail setup](MAIL_CLIENT_SETUP.md) | Verified EU IMAP/SMTP settings, Mac account and signatures, iPhone instructions; Notes disabled. |
| [Authentication, email and jobs decision](AUTH_EMAIL_AND_JOBS_DECISION.md) | A3 decision complete, 9 September. Retain auth; Mailjet Free for the initial pilot; durable outbox/worker; support mailbox, activation requirements and costs. Disabled A6 foundation is delivered; provider activation and B3/B9 account/security flows remain open. |
| [Registration and membership](REGISTRATION_AND_MEMBERSHIP_PROPOSAL.md) | Accepted design. B1/B2 identity and membership runtime are implemented; registration and invitations are now released; school creation/claiming remain B5. |
| [Account and lifecycle UI follow-up](ACCOUNT_AND_LIFECYCLE_UX_FOLLOWUP.md) | Owner’s B2 review: clearer account/membership forms and removal/closure/deletion flows, tracked in B3/B4/B5/B8/C4. |
| [Conditions UX review proposal](CONDITIONS_UX_REVIEW_PROPOSAL.md) | Approved F17 brief and owner feedback; F18 is complete and verified on staging and production. |
| [Conditions Figma review](CONDITIONS_UX_FIGMA_REVIEW.md) | Desktop/mobile and light/dark proposal, frame links, carousel/catalogue, charts, hourly lesson actions, navigation decisions and visual checks. Approved for implementation; see the final F18 contract. |
| [Commercial and privacy architecture](COMMERCIAL_AND_PRIVACY_ARCHITECTURE.md) | Target architecture. Billing, entitlements, privacy and consent are planned; final provider and policy decisions remain open. |
| [Infrastructure capacity and upgrades](INFRASTRUCTURE_CAPACITY_AND_UPGRADES.md) | Account observations dated 8 September and current upgrade/EU-region decisions. Recheck live quotas before changes. |
| [Launch cost estimate](LAUNCH_COST_ESTIMATE.md) | Dated budget with active Zoho mailbox, selected Blob storage and explicit production-only versus conservative two-worker assumptions. An estimate, not an invoice or spending approval. |
| [Target market estimate](TARGET_MARKET_ESTIMATE.md) | Separate market research and assumptions. Does not approve pricing, revenue claims or change the delivery sequence. |
| [Product expansion assessment](PRODUCT_EXPANSION_ASSESSMENT.md) | Conditional later opportunities: reviews, progress, forecast evaluation, vendors, advertising and mobile apps. |

## Implemented feature references

| Document | Purpose |
| --- | --- |
| [Dependency baseline](DEPENDENCY_BASELINE.md) | A2 versions, cleanup, lint/build configuration and maintenance checks. |
| [Temporary public student demo](PUBLIC_STUDENT_DEMO.md) | Empty-field/demo-button entry, student permissions, environment IDs, disabling and eventual removal. |
| [School access and privacy](ACCESS_CONTROL.md) | Current A1/B2 route permissions, public/private fields, demo isolation and verification. |
| [Membership data model](MEMBERSHIP_DATA_MODEL.md) | Dated B1 foundation contract; its live compatibility bridge was retired by B2. |
| [Membership authorisation](MEMBERSHIP_AUTHORISATION.md) | B2 deployed on both environments: global sessions, independent school roles, personal bookings/teaching, migration and recovery contract. |
| [Conditions UX implementation](CONDITIONS_UX_IMPLEMENTATION.md) | F18 time model, responsive tiles, charts, compact summaries, login theme and release boundary. |
| [Conditions architecture](CONDITIONS_ARCHITECTURE.md) | Forecast calculation, providers, freshness and tide model. Dated calibration examples remain historical. |
| [Spot data model](SPOT_DATA_MODEL.md) | Generic spot schema, database-owned coefficients and admin workflow. Live database revisions are authoritative for numerical settings. |
| [Swell energy and water temperature](SWELL_ENERGY_AND_WATER_TEMPERATURE.md) | Calculations, units, sources and presentation decisions. |
| [Home-screen installation](HOME_SCREEN.md) | iPhone/Android installation, icons, manifest and recorded verification limits. |

## Historical records

[archive/README.md](archive/README.md) indexes superseded plans, the previous long handover, dated releases, UX audits and calibration evidence. Archiving a release or calibration report preserves its evidence; it does not mean the released feature has been removed. Numerical snapshots are not live database exports and must not overwrite newer configurations.

## Keeping the documentation clear

- Keep one current HANDOVER.md, one task roadmap and one product plan at this level. Update them in place.
- The handover owns the latest recorded runtime status; the roadmap owns remaining implementation status; the development plan explains product decisions. Supporting proposals do not mark a feature as implemented.
- Add a dated release record under archive/releases after verification and link it from the handover. Archive replaced handovers and plans with dates rather than leaving competing current versions here.
- Keep provenance, verification and rollback evidence. Historical approvals and commands apply to their original release, not to new work.
- Update this index and relative links when moving a document. Update status only from evidence; a documentation tidy-up does not constitute a deployment or live account check.

Latest application release: [11 November staff invitations](archive/releases/RELEASE_2026-11-11_STAFF_INVITATIONS.md). Earlier dated records remain historical.

## Legal implementation, 6 October 2026

[Legal routes, evidence contracts, current/provider roles and publication gates](LEGAL_IMPLEMENTATION.md) · [Staging release and validation](archive/releases/RELEASE_2026-10-06_LEGAL_STAGING.md). Full owner-specific text is in ignored `docs/private/` and the authorised staging database. A4/B6 remain partial; production approval is pending. The owner-selected GA4/Meta Pixel/LinkedIn Insight Tag/Google Ads/Microsoft Clarity stack remains inactive for C5/C6.
