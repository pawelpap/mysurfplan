# B2 global identity and school authorisation

Implementation and rollout reference, 9 September 2026. Release verification is in progress; the [handover](HANDOVER.md) records the last fully verified deployment. This completes the runtime part of the [B1 membership schema](MEMBERSHIP_DATA_MODEL.md). Self-registration, invitations and ownership claims remain B3–B5.

## Runtime contract

A session identifies a global user. Its validity depends on that user's password/session version, expiry, revocation, deletion and disabling. It no longer depends on a single school remaining open. The same signed session-token format and secret are retained.

A single session lookup loads current platform authority and school relationships from the database. Only that request shares its lookup. `users.role` and `users.school_id` remain as historical fields after activation; they cannot grant staff or platform authority. `account_school_access` selects exactly one authority model according to the migration state, never a union of old and new grants.

For each school, the capability resolver distinguishes:

- Personal context: an explicit customer record or a retained legacy school context permits the existing school schedule journey. It grants no staff role. A suspended or removed staff member may still use personal bookings.
- Management: an active membership with a non-revoked school administrator role, or the school's active owner. Platform administrators have platform oversight.
- Teaching: an active membership with a non-revoked instructor role, an explicit same-school instructor record and an assignment to the lesson. An owner or administrator is not automatically an instructor.
- School lifecycle: deleted, suspended or closed schools grant no operational capability. Historical personal bookings remain visible and can be cancelled by their owner.

Current code still separates public schedules from private school access. B2 does not open global lesson discovery or automatic joining; C1–C3 provide those journeys. A person without a school can log in, use forecasts and see their personal bookings. No new account is linked to an unclaimed record by matching email.

## Account and school controls

`/api/users` and `/api/users/[id]` are platform-only account administration. School administrators cannot create global credentials, read platform account lists, reset passwords, change a global email or disable/delete a global account. Sensitive global account changes are transactional; changing email clears its verification and revokes old session versions. Existing password and disabling revocation remain active.

`/api/memberships` manages one explicit school. Its responses contain names, school roles, membership state and owner indication, without personal email, login timestamps or global status. Existing staff can hold both administrator and instructor roles. Suspension/removal affects only that school. Owners cannot be removed before ownership is transferred. Self-demotion/removal requires another administrator. Adding a previously unaffiliated account is restricted to a platform operator until B4's verified invitations ship.

A newly granted instructor role creates a new explicitly linked instructor record if no linked record or conflicting school email exists. Existing matching records are left unclaimed. The reconciliation view reports an instructor membership without a record; B4 resolves any existing-record claim with verification. Ownership transfer is likewise a future B5 flow; the owner indication is not a new transfer interface.

The platform's Accounts screen is separate from the selected school's People screen. Global accounts may have no school. Staff roles are edited in People using independent checkboxes. The workspace selector includes all available school relationships. Conditions remains first. My bookings and My teaching are personal views across schools. The existing school lesson and roster controls remain available according to current capabilities.

The UI refreshes account access on focus, visibility changes, account-change events and its existing periodic refresh. Changes to school capabilities remount lesson data so an old staff roster is not reused in a reduced-permission view. Every API request still enforces current permissions independently of UI state.

## Booking identity and concurrency

Personal bookings always use the authenticated user ID and current name. Existing explicitly linked customer IDs are reused even if the account email changes. New personal customer records receive an explicit user link. A conflicting unclaimed email returns a conflict for school assistance; no history is silently claimed or overwritten.

Staff booking is an explicit `onBehalf: true` operation, authorised separately for the selected school or assigned instructor. The school retains operational customer records. Browser controls currently expose roster modification to administrators, as before B2.

`reserve_lesson` locks the lesson before reading capacity and writing the booking. Its later statements see committed bookings after any wait. This avoids the earlier single-statement snapshot problem under concurrent reservations. A repeat request reuses the existing booking; rebooking reactivates a cancelled record. Personal cancellation selects the customer by user ID, not by a caller-supplied email. Capacity, spot activity, lesson time and school lifecycle are rechecked in the transaction.

## Migration and rollout

Both SQL files are versioned, checksummed and applied by `scripts/migrate-membership-authority.mjs`. Use the verified private direct connection exports from the environment guide. The runner locks source/membership tables and compares source-row counts and content fingerprints before committing. It never copies a database.

1. Rehearse both files and permission/booking scenarios inside a rolled-back transaction on the isolated branch. Apply them there for application tests.
2. Apply `prepare` to staging. This installs database helpers while retaining `legacy_shadow` and the B1 bridge.
3. Deploy the compatible B2 application to staging and wait for READY. During this short transition, reads/login/forecasts remain available; account/membership writes requiring the new model return a retryable error.
4. Apply `activate`. Under bounded locks, reconcile the legacy-derived assignments, remove the B1 bridge and switch to `memberships` atomically. Replace the school-to-user cascade with `ON DELETE SET NULL`, remove the old required-school constraint, and replace global instructor/customer link uniqueness with uniqueness within each school. Original source records remain unchanged.
5. Verify the saved pre-migration login, database constraints, complete API journeys, desktop/mobile navigation, forecasts and nearest selection. Clean exact disposable fixtures.
6. After staging passes, repeat prepare, deployment, activation and verification separately on production. Do not replace its data with staging.

From `surf`:

```sh
node scripts/check-membership-authority-schema.mjs rehearsal --rehearse-all
node scripts/migrate-membership-authority.mjs rehearsal prepare --apply
node scripts/migrate-membership-authority.mjs rehearsal activate --rehearse
node scripts/migrate-membership-authority.mjs rehearsal activate --apply
node scripts/check-membership-release.mjs rehearsal
node scripts/migrate-membership-authority.mjs staging prepare --apply
# Deploy the compatible application and confirm READY.
node scripts/migrate-membership-authority.mjs staging activate --apply
node scripts/check-membership-authority-schema.mjs staging
MWP_BROWSER_CHECK=1 node scripts/check-membership-release.mjs staging
```

`--rehearse-all` is restricted to the isolated branch before these files have been applied. For an activated database, omit that flag. Browser checks use an installed Playwright module, settable through `MWP_PLAYWRIGHT_MODULE`, and isolated Chrome contexts. No user browser profile is changed. B1's old migration/release tests describe the previous authority model and must not be run against an activated B2 database.

## Rollback boundary

Before activation, the previous runtime remains compatible with the additive preparation. After activation, the old role/school writer is blocked by a database trigger and the old application is not a safe rollback target. Reverting could lose multi-school access or invalidate no-school logins. Keep the B2-compatible runtime and repair forwards, disabling affected account/membership mutations temporarily if necessary while preserving login and personal bookings.

An activation error rolls back the entire transaction. No existing account IDs, sessions, passwords, lesson/booking records, spot settings or calibrations are migrated by copying or guessed association. Recovery must preserve subsequent membership and booking changes. Do not drop the new tables or reset the database to undo a release.
