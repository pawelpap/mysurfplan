# MyWavePlan current handover

Updated 17 September 2026. This is the single current handover. The [roadmap](IMPLEMENTATION_ROADMAP.md) owns task status and dependencies; the [development plan](DEVELOPMENT_PLAN.md) explains product direction. [Documentation index](README.md) · [Environment guide](ENVIRONMENTS.md) · [Reconciliation evidence](archive/decisions/PROJECT_ALIGNMENT_2026-09-16.md).

## Current release

Production remains at `04d9c9a8ba15e06406ceae6101154cc391719a34`, containing application runtime `e6cfee77ee0517950107d0f01a76b7e0f900373f`. Staging now runs `3032204543a11308766efe148699624466d66bb3`, with small-surf calibration, consistent selected-day daylight windows on spot/day tiles and a bounded forecast archive. The active development branch is `codex/small-wave-windows`. [Staging release and checks](archive/releases/RELEASE_2026-09-17_SMALL_WAVE_STAGING.md).

**Production is on hold for the owner's staging review.** The later 17 September instruction supersedes earlier permission for automatic promotion. The production migration is not applied. Do not push to `main` or change production calibration without renewed approval.

| Environment | URL | Git branch | Vercel project | Reviewed runtime deployment |
| --- | --- | --- | --- | --- |
| Staging | [staging.mywaveplan.com](https://staging.mywaveplan.com) | `staging` | `mysurfplan-staging` | `dpl_2CZ7qmswzokQwoaowok1XqSLtGzu` |
| Production | [mywaveplan.com](https://mywaveplan.com) | `main` | `mywaveplan-prod` | `dpl_GqXkCSbo6ADaqeJjGZ4EhYfyaqWp` |

Both projects use `fra1` functions and Node.js 22. Production's full release checks remain in the [13 September typography record](archive/releases/RELEASE_2026-09-13_EMAIL_TYPOGRAPHY.md). The staging follow-up passes 133 tests and lint/build; the dated record distinguishes live checks from local tests. One existing avatar-image lint warning remains for B7. Staging checks do not establish production rollout or measured forecast accuracy.

The application baseline is Next.js 16.3.4, React 19.2.8, Neon driver 1.1.0, Node.js 22 and explicit Webpack. The [environment guide](ENVIRONMENTS.md) owns current database IDs and local setup. Both primary databases and application functions are in Frankfurt; this does not establish EU-only CDN, log, build, support or processor handling.

## Completed and partially completed work

Eight of 71 roadmap items are complete: **A1, A2, A3, A8, B1, B2, F17 and F18**. A3 is an architecture decision; the others have their recorded implementation/design evidence. The remaining 63 items include partial work and conditional later extensions, not 63 immediate launch blockers.

- **B1/B2:** global accounts and independent school memberships/roles are deployed. Sessions, school boundaries, personal bookings and teaching use membership authority. The B1 compatibility bridge is retired. Do not repeat the migration or roll back to pre-B2 code. [Runtime contract](MEMBERSHIP_AUTHORISATION.md), [release evidence](archive/releases/RELEASE_2026-09-09_MEMBERSHIP_AUTHORISATION.md).
- **F17/F18:** Conditions design, daylight/next-sunrise spot cards, stable noon day tiles in production, batched five-minute summaries, linked charts and compact mobile metadata are deployed. Preserve the [behaviour contract](CONDITIONS_UX_IMPLEMENTATION.md). [Production release](archive/releases/RELEASE_2026-09-10_CONDITIONS_UX_PRODUCTION.md), [tile follow-up](archive/releases/RELEASE_2026-09-10_TILE_PARAMETERS_PRODUCTION.md).
- **12 September maintenance:** public read-only Demo student access and the browser-translation rendering fix are deployed. Central error reporting is still A6 work. [Demo release](archive/releases/RELEASE_2026-09-12_PUBLIC_STUDENT_DEMO.md), [translation fix](archive/releases/RELEASE_2026-09-12_TRANSLATION_STABILITY.md).
- **A8:** Frankfurt migration, recovery rehearsals, unused legacy-table cleanup and owner-approved US retirement are complete. The old US project and its Vercel resource are deleted. [Migration/recovery runbook](EU_DATA_MIGRATION_PLAN.md), [release evidence](archive/releases/RELEASE_2026-09-12_EU_MIGRATION.md).
- **A6/A7, partial:** the environment-bound outbox, bounded worker, Mailjet adapter, authenticated events and Support email shell are deployed. Sending is disabled and there is no cron schedule. Only the operator delivery-check message exists; verification, recovery, invitation and lesson emails are future work. No actual Mailjet inbox/callback test has passed yet. [Activation runbook](EMAIL_JOBS_RUNBOOK.md).
- **Business email:** Zoho Mail Lite 5 GB is active for one user, `pawel@mywaveplan.com`, with `support@mywaveplan.com` as an alias. Delivery, replies, SPF/DKIM/DMARC and Mac-client checks passed. Mailjet is the separate application sender. [Mailbox evidence](MAILBOX_SETUP.md), [client setup](MAIL_CLIENT_SETUP.md).

The latest recorded database inventory, after the public demo and A8, has three accounts (owner, `teststudent`, Demo student), two school-student links, Demo Surf School and 17 active spots per environment. Lessons/bookings used as migration fixtures were cleaned. These are dated counts, not a fresh 16 September database audit. Demo Surf School remains the single unresolved legacy ownership record; no owner was inferred. Credentials, sessions, security counters and caches stay environment-local. [Privacy inventory](PRIVACY_DATA_INVENTORY.md), [demo lifecycle](PUBLIC_STUDENT_DEMO.md).

## Next development step and planning decisions

**Immediate work: owner review of the staging forecast changes, then production only after approval.** After this bounded task, the next core development task remains **A4/B6 legal pages and acceptance records**.

1. Complete the review of actual processing purposes, provider agreements/transfers and retention. Operator details, support contact and adult-only initial pilot are already confirmed. The [data inventory](PRIVACY_DATA_INVENTORY.md) and [unpublished policy drafts](PRIVACY_DOCUMENT_DRAFTS.md) are prepared; reviewed policy publication remains open. Fiscal/merchant decisions must be completed before their respective paid flows.
2. Implement accessible, versioned privacy/terms pages, minimal terms/school acceptance evidence and separate privacy-notice delivery. Optional preferences default off and can be withdrawn. Self-host the website's Poppins fonts and check external resources. The existing `/legal` page contains data licences only.
3. Implement **A9 localisation foundations**, then **B3 registration, verification, recovery and profiles**. A9 remains unimplemented; this reconciliation does not start it. English, European Portuguese and Spanish are the pilot languages, with French optional. B10 completes translation/QA before G1.
4. Complete **A6/A7 email activation** before B3 goes live: isolated Mailjet credentials and staging sender, real inbox/callback/reply tests, quotas, independent alerts, minute scheduling and measured Neon consumption. Keep staging unscheduled outside active tests. B3 must add its own message types and token/security flows; enabling the current worker alone does not implement registration.

A5 permitted-use/attribution review and L1 commercial activation apply at the relevant activity. C5 cookie consent precedes C6 optional GTM/GA4; tracking stays off until verified. Search Console and basic SEO do not require analytics consent. Retire the public Demo student entry during B3/C7 readiness. Complete the [account and lifecycle follow-up](ACCOUNT_AND_LIFECYCLE_UX_FOLLOWUP.md) through B3/B4/B5/B8/C4.

## Forecast investigation status

The bounded Caparica/São Pedro comparison is **closed**. The separate task “Correct surf spot data” completed the explanation and verified both environments without changing code or calibration; the owner confirmed resolution on 16 September. Do not carry that comparison forward as an unresolved defect or onboarding prerequisite. [Comparison and disposition](archive/calibration/2026-09-15-four-spots/README.md).

F19 remains the separately agreed broader review of forecast quality, weather sampling and validation against observations. Closing the comparison does not establish measured real-world accuracy or complete F19. The [Grande/Pequena](archive/calibration/2026-09-10-grande-pequena/README.md) and [Sintra neighbours](archive/calibration/2026-09-10-sintra-neighbours/README.md) changes remain dated calibration evidence. Live versioned database settings are authoritative.

The new 17 September Cornélia observation is separate from the closed comparison above. The owner reported clean 0.6–0.9 m surf at 08:00–09:00. Staging relaxes the small-surf size ceiling across all 17 spots and trials wider directional spread at both comparable Caparica spots. Both Caparica spots now have revision 6; all other staging spots advance one revision. Production retains the previous versions. The general default profile is v2 only on staging. [Trial, source limitations and review](archive/releases/RELEASE_2026-09-17_SMALL_WAVE_STAGING.md).

F9/F14/F19 remain open/partial. One structured observation fixture and six-hourly request-driven immutable forecast samples with 90-day retention are now on staging. This is not complete observation entry, fixed-lead archive coverage or an accuracy dashboard. No historical forecasts were invented from later retrievals. No cron was added.

Subsequent 17 September São Pedro trial: the owner authorised a provisional assumption after identifying Saturday's GFS/Surfline direction and component-height disagreement. Staging Bico is now revision **8**, Bafureira **7**. Their database exposure curves admit sheltered GFS 285–300° swell and taper strongly to 310°; displayed raw bearings and break-specific rules are unchanged. Saturday's live best windows are both 08:00–09:00, Fair, about 0.3–0.5 m; Sunday remains flat. All 137 tests and live API/browser checks passed. [Exact assumption, full replay, limitations and rollback](archive/calibration/SAO_PEDRO_DIRECTION_REVIEW_2026-09-17.md). This is separate from the closed 15 September comparison. Production remains unchanged and on hold; its later promotion must include this separate calibration after the small-wave migration.

## Infrastructure and commercial direction

- The Vercel team was rechecked on 16 September and is still **Hobby**. Pro is recommended for continued deployed commercial work and technically required before minute scheduling. Earlier deferral until registration concerned worker timing, not a commercial-use exemption. No purchase has been authorised or made in this reconciliation. [Capacity and upgrade record](INFRASTRUCTURE_CAPACITY_AND_UPGRADES.md).
- Neon Launch is active with the owner-reported US$20 notification, not a cap. A8 left four EU branches, 0.25–1 CU computes, five-minute idle suspension and seven-day history. Measure live worker consumption before activation; continuous polling can keep compute awake.
- **Vercel Blob Frankfurt is selected, not provisioned**, for B7 photos, school logos and graphics. Use separate environment stores/credentials, private originals/drafts, public published derivatives, Neon metadata, quotas and cleanup. Standard B5/B7/C2/C4 school branding belongs before G1. [Branding scope](IMPLEMENTATION_ROADMAP.md#school-branding-and-customisation), [media budget](LAUNCH_COST_ESTIMATE.md#vercel-blob-media-budget).
- The €90–120/month budget is a conservative future scenario with both databases continuously polled, not today's bill or the intended staging schedule. Default activation is production scheduling with staging off outside tests. [Cost assumptions](LAUNCH_COST_ESTIMATE.md).
- Preserve the free surfer forecast. G1 is the controlled adult self-service/pay-at-school pilot; G2 adds paid school software; G3 adds online lesson payments. Prices, trials, merchant arrangements and reviewed policies remain decisions in their assigned tasks. Later F/V/R/M extensions remain conditional.

## Release and verification workflow

Prepare bounded changes and verify locally, then on staging. Production requires the owner's approval unless the specific task authorises promotion after successful staging checks. Historical approvals do not authorise new releases. Preserve B2-compatible rollback, immutable migration history and forecast settings; never routinely clone databases. Use current EU endpoints, protect secrets and clean only authorised fixtures.

Update this handover, task status and dated evidence after each release. Label historical snapshots and live checks with their dates. For documentation-only work, check links, status consistency and the diff; do not imply a deployment or database audit. Keep existing provider accounts and do not reconnect or switch accounts without explicit authorisation. The [pre-reconciliation handover](archive/handovers/HANDOVER_2026-09-16_BEFORE_ALIGNMENT.md) preserves the older detail.
