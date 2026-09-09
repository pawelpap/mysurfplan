# Revocable sessions – 7 September 2026

> Archive status: Dated implementation evidence. Statements about current deployments, data, approvals and rollback refer to this record’s date; they are not new deployment instructions. See the [current handover](../../HANDOVER.md) and [current roadmap](../../IMPLEMENTATION_ROADMAP.md).

The owner authorised implementation and staging verification, then production deployment if staging passed. Application revision: `aa695a964c362e53712a5990a305ee2174e6d818` (session implementation `06db155`, followed by profile spacing). Both environments are deployed and verified. Follow-up documentation and verification-script commits preserve this application revision.

## Behaviour

Each login creates a random 256-bit session token. Only its SHA-256 hash is stored in `auth_sessions`; the token is carried inside the existing signed, Secure, HttpOnly, SameSite=Lax cookie. Cookie and database expiry both enforce seven days. Existing stateless cookies require a one-time re-login because they have no revocable database record.

Every authenticated API request reads the current user, role, school scope and account status from Neon. Repeated checks share a lookup only within that request. A deleted or disabled user, deleted school, expired session or revoked session is rejected. Database failures deny protected access with a generic temporary-unavailability response. An already authorised request can finish; committed changes apply to the next request.

Normal logout revokes the current session before clearing its cookie. **My profile → Log out everywhere** invalidates all sessions for that user, including the current device. Another user's sessions remain valid. A per-user `auth_version` also covers concurrent logins and global revocation. Login issuance checks that the password hash still matches the hash verified by the login handler, with a user-row lock to serialise security changes.

Changing a password, disabling/re-enabling an account or soft-deleting/restoring it increments `auth_version` through a database trigger. Restoring an account never restores an old session. Role and school changes retain sessions but use current permissions. Admins can change Account status in Edit person; self-disable and self-deactivation are rejected there. Existing deactivation remains a soft delete, separate from reversible disabling.

The workspace refreshes account information on navigation, focus, visibility changes, permission errors and every minute while visible. Logout also notifies other tabs. These keep the interface current; server checks enforce access independently. The session endpoint rejects cross-origin logout requests that supply a different Origin. Full mutation CSRF protection remains a separate task.

## Database and rollout

Apply [the additive migration](../../../db/migrations/20260907_revocable_sessions.sql) before the application deployment in each environment. It adds `users.auth_version`, `users.disabled_at`, `auth_sessions`, two indexes and an invalidation trigger. The canonical schema contains the same migration. No password, signing-secret or business-data replacement is needed.

Rehearsal branch: `br-morning-glade-adu8v769`, cloned from production in Neon project `shy-paper-68550619`. Applying the migration twice passed and preserved the existing user count. Thirteen database integration scenarios and two concurrent login/logout scenarios passed; all test records were rolled back or removed. The rehearsal branch is retained for repeatable checks; it is not connected to either app. Staging migration preserved its five pre-existing users. Production migration preserved all nine users present during verification, including four disposable test accounts.

Expired session records are removed in bounded batches of up to 500 during successful logins. With no logins, expired records remain until the next cleanup; their presence never allows expired access. Larger scale will need scheduled cleanup and login abuse controls. No IP address or user-agent history is collected for sessions.

Do not remove the additive schema during rollback. A return to the old stateless implementation would also remove revocation guarantees; prefer a forward fix. If an emergency rollback is required, explicitly assess session invalidation and signing-key rotation rather than claiming the old release preserves these controls.

## Verification

- 68 regression tests passed on Node.js 22, including current-permission checks, legacy-cookie rejection, database failures and an audit that every API authentication call awaits the database result. Existing forecast/calibration tests remain green.
- The local production build passed. The deployment builds run on Node.js 22.
- The isolated database check covers hashed storage, password-verification races, current/global logout, live roles, account disable/restore, password changes, deletion/restore, deleted schools, expiry and malformed tokens.
- Staging: 13 live API scenarios passed, covering legacy-cookie rejection, single/global logout, copied-cookie replay, role/school changes, cross-school denial, disabling/restoring, password changes, deactivation, invalid/cross-origin logout, self-disable protection and student forecast access. Desktop 1440 px and mobile 390 px checks passed. Admin account-status saving and mobile logout-everywhere worked; no horizontal overflow or browser exceptions. A minor spacing correction was verified before production. Staging deployment: `dpl_2w1L1GqYVjNF5qmCzaWKdiGNPC6z`.
- Production: the same 13 API scenarios passed. Desktop and mobile student login, Conditions, My profile and logout-everywhere passed; HttpOnly cookies were not visible to page JavaScript. Production deployment: `dpl_J9LhMTb81ZG6qe82G33GBMzaJcDC`. The logs contain the expected 403 denials from cross-school tests, with no unexpected application failures. Mobile checks are browser emulation, not a physical iPhone.
- All disposable staging and production fixtures were removed. Original user counts returned to five in each environment; the shared teststudent account remains active with student rights. No existing user was disabled, deleted or given another role by the verification scripts. Production cleanup required an additional explicit owner approval after automatic review rejected irreversible fixture removal; that approval was received, dependencies were checked and the scoped cleanup completed.

Repeatable checks: [database rehearsal](../../../scripts/check-revocable-sessions.mjs), [concurrency check](../../../scripts/check-session-concurrency.mjs) and [deployed API verification](../../../scripts/check-session-release.mjs). They require explicit private connection files and create only disposable fixtures. Keep those files outside Git, remove fixtures after browser verification and delete the local credential files.

## Remaining work

This is a bounded session release, not a complete authentication audit. Login/recovery rate limiting, consistent safe errors and enumeration protection, full CSRF controls, platform-admin MFA, tenant/privacy audit and dependency upgrades remain in Phase 0. Global identities, multi-school memberships, verified registration and password recovery remain in Phase 1. Public forecast access and payment plans are unchanged.
