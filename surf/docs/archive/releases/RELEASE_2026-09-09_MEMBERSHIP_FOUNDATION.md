# B1 membership foundation release

Completed 9 September 2026. The owner authorised B1 development, staging verification and production promotion after successful staging checks. [Current handover](../../HANDOVER.md), [implemented model and reconciliation](../../MEMBERSHIP_DATA_MODEL.md), [roadmap](../../IMPLEMENTATION_ROADMAP.md).

## Delivered

Additive school membership and role tables, separate platform-role assignments, school lifecycle/ownership fields, same-school active-owner constraints, invitation storage and an operator reconciliation view. A database trigger keeps legacy-derived assignments consistent with current user edits in the same transaction. Existing account fields remain the live permission authority until B2.

The release changes database definitions and operator/test scripts. Application page/API authorisation code, visual design, forecasting algorithms, spot/calibration data and authentication credentials are unchanged. No email service, subscription or new provider account was activated.

## Deployment and database evidence

Verified release commit: `f006f4608b2979bf4b0d1a74944279075c61da40`. Preceding commit `ebe590f` records the already approved A3 and Piotr design plans. Both are on `staging` and `main`.

| Environment | Verified deployment | Target and region | Build duration |
| --- | --- | --- | --- |
| [Staging](https://staging.mywaveplan.com) | `dpl_67Wc4hPy7cgcRUrhKNzwrCP1p4rz` | Production target in `mysurfplan-staging`, `iad1` | Approximately 29 seconds |
| [Production](https://mywaveplan.com) | `dpl_4KxMZiEsGGHMFXb2CWJ18jSXhiDK` | Production target in `mywaveplan-prod`, `iad1` | Approximately 28 seconds |

Both reached READY and received the correct custom-domain aliases. Staging verification completed before the production migration and `main` promotion. Documentation follow-ups can produce later deployment IDs with the same application code; these IDs identify the builds used for full verification.

Neon project remains `shy-paper-68550619`, AWS us-east-1. Migration applied separately to staging `br-small-salad-adx0nsj2` and production `br-weathered-silence-adp30k9s`. The existing isolated production-derived `br-morning-glade-adu8v769` was reused for rehearsal because all ten branch slots were occupied. No branch was deleted or reset, and no environment database was copied.

Migration: `20260909_global_memberships`. SHA-256:

```text
146f5b2f9dd3cf3d580dbf61c1fd5c91d5883986666ff82dabbc171ea1bcc2a8
```

The migration ledger records that checksum in both environments. Idempotent reruns verified the checksum and zero legacy/shadow assignment differences. A live Neon schema comparison of production against staging returned an empty diff after the checks.

Existing source-table counts and content digests matched before/after each migration transaction, including users, schools, instructor/customer records, lessons, assignments, bookings, sessions and forecast configuration. Each live environment retained five users, seven schools, nine instructor records, eight customer records, seven lessons, four instructor-to-lesson assignments, five bookings and 17 active spots. Forecast-cache and session activity can subsequently differ.

Each database received one active legacy instructor membership/role and one platform assignment. Students received no staff grants. Seven schools remain explicitly legacy and unowned. Unclaimed/missing person links were preserved and reported, not inferred by email. No emails were marked verified and no source IDs were changed.

## Verification

| Check | Result |
| --- | --- |
| Existing regression suite | 83 passed on Node.js 22.23.2. |
| Build and dependencies | Successful production build; npm audit reported zero known vulnerabilities. No dependency changes. Existing avatar-image lint warning remains for B7; no lint errors. |
| Migration rollback | Full DDL/backfill transaction rolled back on rehearsal; new membership tables disappeared and all source digests matched. |
| Rehearsal schema tests | 22 constraint/compatibility scenarios plus two real concurrent ownership races passed. Normal fixtures rolled back; exact committed race fixtures removed. |
| Staging schema tests | All 22 scenarios passed; fixtures rolled back. |
| Production schema tests | All 22 scenarios passed; fixtures rolled back. |
| Deployed API checks | All 15 scenarios passed on each live environment, including the retained A1 school/privacy/booking checks and two B1 compatibility/authority cases. Exact disposable schools/users/lessons/bookings removed. |
| Native browser checks | Seven checks passed on each environment using Playwright and isolated Chrome contexts; saved pre-migration test sessions remained valid without a fresh login. |
| Runtime errors | Error/fatal log queries for each verified deployment returned no matching entries during release verification. This is a bounded check, not continuous monitoring. |

[Schema test source](../../../scripts/check-membership-schema.mjs) covers dual roles, several memberships, fixed role vocabulary, role changes/transfers/deletion/restoration, global-disable separation, non-revival of explicit suspension, unclaimed/ambiguous links, ownership constraints, booking preservation, invitation integrity and retirement of the bridge. Concurrent tests cover both transfer-first and suspension-first races.

[API test source](../../../scripts/check-school-access-release.mjs) also verifies that current user creation, role changes, school transfer and deletion mirror correctly, while inserting new membership roles cannot grant live API authority before B2. Existing tests cover student booking/cancellation/rebooking, instructor assignments, foreign-school denial, response privacy, public schedules, demo isolation, full and lesson forecasts, health and removed test routes.

Browser checks covered automatic Bico selection at synthetic coordinates, all 17 spots in distance order, A–Z sorting, preservation of manual Carcavelos selection, native keyboard movement from 12:00 to 12:30 on the tide chart, matching condition detail time, all existing parameter labels, 16 forecast days, hidden platform-only controls, desktop light appearance and 390 × 844 mobile dark appearance without horizontal page overflow. No page errors were raised. Screenshots were visually inspected. A physical iPhone/Safari was not tested.

The first browser CLI did not reliably deliver native clicks/keys and stalled during a screenshot. Its test sessions were closed. The final acceptance checks used native Playwright interactions in fresh isolated Chrome instances with the saved test sessions; no application code was changed to accommodate the test tool.

After verification, only the two login sessions created for this release were revoked. Their saved cookies, private database connection exports and temporary browser helpers were removed. Other user sessions were retained.

## Rollback and next step

Pre-commit errors roll back the entire migration. After B1, the previous application code remains compatible with the additive schema because live permissions have not changed. Prefer leaving the additions intact. If the bridge causes a write incident, disable only `trg_legacy_membership_bridge` on `users`, preserve current writes and reconcile the now-stale shadow before B2. Do not restore an old whole database to undo an application release.

B2 must introduce the capability resolver, session/API/UI cutover and safe removal of legacy single-school constraints. Recheck the reconciliation report, retire the bridge under controlled writes, and only then enable independent memberships. Verified ownership, person claims and invitations remain B4/B5 flows. Account erasure must handle retained ownership/invitation references through B8.
