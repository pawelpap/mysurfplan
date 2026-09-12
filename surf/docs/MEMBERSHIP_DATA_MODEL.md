# Membership data model and B1 migration

Deployed and verified on staging and production, 9 September 2026. [Release evidence](archive/releases/RELEASE_2026-09-09_MEMBERSHIP_FOUNDATION.md). B1 implements the additive database foundation from the [accepted registration design](REGISTRATION_AND_MEMBERSHIP_PROPOSAL.md). See the [handover](HANDOVER.md) for verified deployment status and the [roadmap](IMPLEMENTATION_ROADMAP.md) for remaining work. This document describes B1's schema and migration contract, not a completed self-service registration flow.

> Current status: B2 has replaced B1’s live authority and retired its bridge. This file retains the dated B1 migration contract. Use [Membership authorisation](MEMBERSHIP_AUTHORISATION.md) for current behaviour and operators’ commands. Do not run B1 compatibility checks against an activated B2 database. The B1 data counts below precede the owner-authorised B2 test-data cleanup.

## Historical B1 authority and scope

**B1 kept `users.role` and `users.school_id` authoritative until the B2 cutover.** Existing sessions, API permissions, profiles, booking links and forecast calculations use their current code. The new tables can represent several memberships and independent administrator/instructor roles, but adding such rows does not grant live application access yet. B2 has since switched the permission resolver and UI to them. The rest of this section describes the earlier B1-only phase.

Students are personal accounts and school customer records, not staff memberships. Global account disabling remains separate from membership suspension. An account's role or school assignment is evidence for backfill; a matching email address is not evidence of a verified account claim or school ownership.

## Implemented schema

| Record | Fields and constraints |
| --- | --- |
| `identity_migration_state` | One row, initially `authority = legacy_shadow`. B2 must retire the compatibility bridge in the same controlled migration that changes authority. This is not an application feature flag exposed to users. |
| `school_memberships` | UUID ID, school/user foreign keys, `active`/`suspended`/`left` status, `legacy_user`/`explicit` origin and timestamps. Unique school/user relationship. Separate indexes support user lookup and same-school ownership constraints. |
| `membership_roles` | Membership ID and `school_admin`/`coach` role form the primary key. Independent roles can coexist. Origin, granting actor/time and optional revocation time. Revoked roles do not grant access in the future resolver. |
| `platform_role_assignments` | UUID ID, user ID, constrained `platform_admin` role, origin, actor/time and revocation. At most one unrevoked assignment per user/role. School roles cannot contain platform authority. |
| `schools` additions | `workspace_kind` (`legacy`/`self_service`), `workspace_status` (`draft`/`active`/`suspended`/`closed`), `listing_status`, nullable `owner_membership_id` and generated `owner_required_status`. These do not change current public listings or existing access in B1. |
| `school_invitations` | School, normalised invited email, one or two distinct fixed staff roles, inviter, unique SHA-256-format token hash, expiry, lifecycle timestamps/status and accepting user. Optional explicit instructor/customer record references are constrained to the same school. One pending invitation per school/email. No sending or acceptance API is introduced in B1. |
| `identity_schema_migrations` | Migration ID, SHA-256 file checksum and application time. Reruns verify the checksum and mirrored assignments. An applied file must not be edited; future changes use a new migration. |
| `identity_reconciliation_issues` | Operator-only view of unresolved ownership, unclaimed records, missing/incompatible links, ambiguous normalised login identifiers and non-normalised emails. Returns record IDs, not credentials or email addresses. |

Existing instructor/customer IDs and explicit `user_id` links remain unchanged. The old global active-link uniqueness and cascading school-to-user relationship remain until B2; B1 must not enable no-school or multi-school accounts through the current API. No billing, consent, localisation or email-provider tables are activated by this task.

### Ownership constraints

The `(schools.id, owner_membership_id)` foreign key proves that an owner belongs to the same school. Non-closed self-service workspaces require an owner. A second deferred foreign key includes the generated required status `active`; it prevents an ownership transfer/activation racing with suspension or removal of the target membership. It uses PostgreSQL's foreign-key locking rather than an unlocked cross-table check.

Owner creation/transfer can be a single transaction because these foreign keys are deferred. Closure permits a historical inactive owner. Removing an owner account later requires the B8 ownership/erasure process; this schema is not permission to cascade away personal accounts. A membership's active status does not override global account disabling or school/commercial restrictions.

### Invitation limits

The table validates token shape, fixed role values, same-school record references and consistent lifecycle fields. It does not establish verified identity or implement a secure acceptance flow on its own. B4 must verify the authenticated invitee, expiry at acceptance time, single use, current inviter authority and explicit claim consent in an atomic operation. Expired pending invitations must be transitioned before replacement. Never put raw invitation tokens in database records, logs or analytics. Account-erasure handling must cover accepting-user references and retained invitation history.

## Backfill and compatibility

The migration copies only proven legacy assignments:

- School administrators and instructors receive a `legacy_user` membership and their existing role. Soft-deleted accounts receive a left membership without an active grant.
- Existing platform administrators receive a separate platform assignment. The legacy `admin` alias, if present, follows the current authentication semantics.
- Student accounts receive no staff membership. No account is marked email-verified, no password/session is replaced and no instructor/customer link is inferred.
- All existing schools remain `legacy`, with ownership unresolved. The added draft/unlisted defaults apply to the future workspace model; they do not hide schools or disable today's lessons.

An `AFTER INSERT/UPDATE` trigger on legacy user role, school and deletion fields maintains legacy-derived memberships/roles in the **same transaction** as current API writes. Transfers leave the previous membership and revoke its mirrored roles. Profile edits and global disabling do not redefine school membership. Explicit assignments are not revived or revoked by this bridge. Current code continues to enforce global disabling and deleted-school restrictions independently.

The trigger does not write back to users, does not copy personal data and does not change current permission decisions. B2 must lock out competing legacy writes during its final reconciliation and authority switch, retire the bridge, and then enable the new membership writer. Do not combine old and new permission grants.

## Reconciliation recorded before rollout

On 9 September, staging and production each contained five users, seven schools, nine instructor records, eight customer records, seven lessons, five bookings and 17 active spots. These are release observations, not permanent expected row counts.

| Finding in each live environment | B1 decision |
| --- | --- |
| One instructor account with no explicit instructor-record link | Preserve the account and its proven instructor role; report the missing link. Do not claim an instructor record by email. |
| Two student accounts without explicit customer-record links | Preserve their accounts. Resolve through the future verified claim/booking flow. |
| Nine unclaimed instructor and seven unclaimed customer records | Preserve IDs and history. No automatic account association. |
| Seven schools with no proven owner | Keep all seven in legacy mode, unassigned. Resolve ownership explicitly before self-service activation; an old administrator role would not prove ownership. |
| No ambiguous normalised login identifiers or incompatible explicit links found | Keep the reconciliation view for later changes; do not assume these findings stay zero forever. |

The expected backfill for these observations is one active instructor membership/role and one platform assignment per environment. The three student accounts gain no staff authority. Recheck the report before B2 instead of relying on these dated counts.

## Migration and verification procedure

Use Node.js 22 and a private direct connection export for the confirmed environment. The runner checks its pinned endpoint and database; it never falls back to a local `.env`. A8 migrated the current mappings to Frankfurt: use the isolated `security-rehearsal` branch for checks. The former US rehearsal branch/project was deleted. Historical B1 checks apply only before B2 authority activation; do not replay them on a current live database. [Environment and recovery map](EU_DATA_MIGRATION_PLAN.md).

From `surf`, the supported commands are:

```sh
node scripts/migrate-memberships.mjs rehearsal --audit
node scripts/migrate-memberships.mjs rehearsal --rehearse
node scripts/migrate-memberships.mjs rehearsal --apply
node scripts/check-membership-schema.mjs rehearsal --concurrency
node scripts/migrate-memberships.mjs rehearsal --apply
node scripts/migrate-memberships.mjs staging --apply
node scripts/check-membership-schema.mjs staging
node scripts/check-school-access-release.mjs staging
```

`--audit` is the default and uses a read-only transaction. `--rehearse` is restricted to the isolated branch and rolls back the full migration/backfill, checking that the new tables disappear and source data remain unchanged. `--apply` takes a transaction-level advisory lock and bounded source-table locks, records source counts/digests, applies the SQL and backfill, forces deferred constraints, compares the original records and records the checksum before commit. Source data are not printed. A failure rolls back all changes; lock waits time out rather than waiting indefinitely.

The executable SQL is [20260909_global_memberships.sql](../db/migrations/20260909_global_memberships.sql). The [legacy bootstrap schema](../db/schema.sql) remains the fresh-database starting point; use the versioned migration runner after bootstrap so B1 definitions and backfill have one source of truth. The runner expects the existing username, conditions, revocable-session and login-limit baseline to be present. Endpoint changes require a fresh mapping check and update to the operator script before writes.

After staging checks, apply the same migration separately to production and repeat schema/API/browser checks. Never copy the staging database onto production. Record Git/deployment IDs and test evidence in the release report. Keep a logged-in browser session across migration/release to check continuity; verify conditions, nearest/A–Z/manual selection, mobile layout, lessons and permissions.

### Rollback boundary

Before a successful commit, ordinary transaction rollback restores the original schema and records; this is rehearsed explicitly. After a B1-only release, rolling back application code is compatible with the added tables because live application authority has not changed. Prefer leaving harmless additive tables in place.

If the compatibility trigger itself causes a live write incident, an authorised operator can disable only `trg_legacy_membership_bridge` on `users` and roll back the application release. This preserves current user writes but makes the mirrored data stale; audit and reconcile under controlled writes before B2. Do not restore a whole old database or drop populated membership tables to undo an application deployment. Once B2 allows independent multi-school assignments, reverting to the old single-school application requires a different, reviewed recovery procedure.

PostgreSQL references: [foreign-key and uniqueness constraints](https://www.postgresql.org/docs/current/ddl-constraints.html), [transactional and deferred trigger behaviour](https://www.postgresql.org/docs/current/sql-createtrigger.html).
