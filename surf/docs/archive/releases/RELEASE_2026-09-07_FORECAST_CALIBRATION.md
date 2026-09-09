# Forecast calibration and tile cleanup, 7 September 2026

> Archive status: Dated implementation evidence. Statements about current deployments, data, approvals and rollback refer to this record’s date; they are not new deployment instructions. See the [current handover](../../HANDOVER.md) and [current roadmap](../../IMPLEMENTATION_ROADMAP.md).

The owner approved promotion of the reviewed staging spot data to production and removal of unclear forecast reminders. Both environments now serve application revision `428d35f3c2b4b03bec3d95edff4f806945e2690f` with matching spots, calibrations and disposable test lesson data. Documentation-only follow-up commits do not change this tested runtime.

## Changes

Removed “Long-range” from daily tiles and the conditional selected-day confidence/outlook reminder. No probability, replacement label or new forecast calculation was added. Quality colours, experience levels, all forecast parameters and the existing Forecast guide remain available.

The data review revised 16 existing spots, added Praia da Torre and removed generic São Pedro do Estoril. Bico and Bafureira remain separate, with their individual tide and swell behaviour. All calibration settings use the existing generic database schema v3. Sources, exact coefficients, limitations and staging scenario tests are in the [local calibration review](../calibration/2026-09-07-local-review/README.md). No further numerical tuning was performed during promotion. The settings remain provisional estimates, not verified accuracy claims.

Production was updated transactionally at `2026-09-07T20:11:01.157Z`, with version guards, configuration validation and calibration history entries. The owner had confirmed that all lesson data was disposable and requested parity with staging. Six production-only test lessons were removed, including the five attached to generic São Pedro. The remaining lesson, booking and coach-assignment records were synchronised with staging.

| Verified data | Staging | Production |
| --- | ---: | ---: |
| Active spots | 17 | 17 |
| Lessons | 7 | 7 |
| Bookings | 5 | 5 |
| Lesson coach assignments | 4 | 4 |

Spot IDs, metadata, active flags, calibration configurations, versions, schema/profile references, notes and sources match. Current versions are Bico 6; Bafureira, São João and Cornélia 5; the other revised spots 3; Torre 1. Schemas, shared reference configuration and account records already matched and were preserved. This was a scoped data promotion, not a complete database clone. Authentication sessions, forecast caches, calibration audit event IDs and operational timestamps remain environment-specific. Credentials and private test lesson backups are not published in the repository.

## Verification

- All 68 regression tests passed on Node.js 22; both Vercel production builds succeeded. `git diff --check` passed.
- Both live environments returned 17 spots, 16 forecast days and 408 assessed hours per spot, totalling 6,936 scored hourly records each. Every score was finite and matched calculation with the intended database configuration/version. No stale responses or provider issues were reported during these checks.
- Water temperature was available for 271 hours per spot. It remains unavailable outside the provider's returned coverage; no values were extrapolated.
- The test student could read forecasts, could not modify spots (403), and received 404 for deleted generic São Pedro. Verification logged out only its own temporary API sessions.
- Chrome checks at 1710 px and mobile emulation at 390 × 844 px confirmed 16 coloured tiles, no removed labels, no document overflow and no reminder on a selected later forecast day. Production browser error logs were empty. This is browser emulation, not a physical iPhone test.
- Deployment-scoped error/fatal runtime log checks returned no entries in either environment during verification.
- Independent post-transaction database checks confirmed semantic parity for spots, lessons, bookings and coach assignments. The [promotion receipt and compact live results](../calibration/2026-09-07-local-review/production-release.json) record the verified counts and versions without account or lesson contents.

## Deployments and rollback

| Environment | Verified application deployment |
| --- | --- |
| [Staging](https://staging.mywaveplan.com) | `dpl_G4FBsNGEBHEChCWTu3q3qN18m6KD` |
| [Production](https://mywaveplan.com) | `dpl_AeVESYAoN7mfLn8V8aYuW2NwgrkQ` |

Both custom domains were verified on revision `428d35f`. Previous deployment references are staging `dpl_28GE7uZrCGM8FCGYEsC6ovSSNPPY` and production `dpl_G69ZRhvP2gdum4RKZw4GNWtdULq8`, revision `8890400b7173c013382652580b859cfb7ca6256c`.

Rolling back application code restores the reminder wording but does not undo database calibration. To roll back individual spots, restore selected prior configurations from the review's saved snapshots as new audited revisions after validating current versions. The removed generic spot row and history are saved in the review; deleted disposable lesson contents are intentionally not part of the release evidence.

This release is complete. The next application task remains login abuse protection and CSRF/origin controls, followed by the tenant/privacy audit. Surfline session imports remain deferred. Future releases retain staging-first review unless the owner explicitly authorises otherwise.
