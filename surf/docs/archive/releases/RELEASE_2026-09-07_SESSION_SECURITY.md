# Session security release

> Archive status: Dated implementation evidence. Statements about current deployments, data, approvals and rollback refer to this record’s date; they are not new deployment instructions. See the [current handover](../../HANDOVER.md) and [current roadmap](../../IMPLEMENTATION_ROADMAP.md).

7 September 2026. Application revision: `729489e909204135ace79c399ce1fe5cc6c7b5c6`.

The owner authorised a bounded security task with staging verification, then explicitly authorised production after successful checks. The same application revision is now deployed to both environments. Subsequent documentation commits do not change runtime behaviour.

| Environment | Verified application deployment | Domain |
| --- | --- | --- |
| Staging | `dpl_EXKgZYtiV5XwTpzMTJZBLPtCtn8F` | https://staging.mywaveplan.com |
| Production | `dpl_6LEtFTbQ8cYcATF4acVyX7eLKhrG` | https://mywaveplan.com |

## Change

Previously, the browser cookie had a seven-day lifetime, but the server accepted a correctly signed session without enforcing its issue time. Cookie parsing could throw on malformed percent encoding, signatures were compared as strings and cookies did not explicitly use Secure.

The new shared session module:

- Enforces seven-day expiry from the signed `iat`, rejecting the session at the exact expiry boundary. Missing, non-integer, non-positive or excessively future issue times fail validation. A 60-second future allowance handles small server clock differences; it does not remove expiry.
- Requires a non-development production signing secret of at least 32 bytes after trimming for validation. It preserves the actual configured key, so deployments do not rotate secrets. The development fallback is available only in explicit development/test runtime mode.
- Issues and clears host-only cookies with Path=/, HttpOnly, SameSite=Lax and Secure in production mode. Staging also uses production mode. Explicit local development remains usable over HTTP.
- Parses only the session cookie, rejects ambiguous duplicates, extra token segments, invalid encodings, oversized values and invalid JSON safely, and compares HMAC signatures using `crypto.timingSafeEqual` after validating length/encoding. Existing role checks remain in the auth wrapper.

The existing payload/signature format is retained. Actual pre-release student cookies were accepted after each deployment. Sessions already seven days old will require login again.

No schema migration, password change, session-key rotation or business-data copy was performed. Normal verification logins update the existing test user's login timestamp; forecast views can refresh their normal caches.

## Verification

- All 64 regression tests passed, including a full run on Node.js 22. Six new session tests cover the exact expiry boundary, old-format compatibility, malformed/tampered/wrong-key tokens, timestamp bypass attempts, duplicate/unrelated cookies, production configuration and login/logout cookie attributes.
- The local Next.js production build passed on Node.js 24. Vercel built and deployed both environments with the project's Node.js 22 configuration.
- Both custom domains passed HTTP checks for actual pre-release session compatibility, new student login, secure cookie creation/clearing, malformed/tampered/duplicate token rejection and unauthenticated versus student-denied access to the user-admin API.
- Browser checks cover desktop 1440 px and mobile 390 px: login to Conditions, authenticated session, logout, re-login, HttpOnly visibility and page width. The forecast remains rendered. No browser exceptions were reported. Mobile coverage is browser emulation, not a physical iPhone.
- Deployment-scoped Vercel error/fatal queries returned no entries during the verification windows. This is bounded release verification, not an ongoing monitoring guarantee.

Browser automation required DOM-based activation of some rendered controls when its reference clicks did not activate them. A URL wait also expected a query string while the app correctly returned to `/`; direct URL, authenticated API and rendered-heading checks confirmed success. These were verification-tool issues, not application changes.

## Scope limits and next work

This release does not add server-side session revocation, password-change invalidation, immediate role/membership refresh, login rate limiting or CSRF protection. Browser logout clears the browser cookie; a copied valid token remains usable until expiry. Those broader controls remain in Phase 0 of the [development plan](../../DEVELOPMENT_PLAN.md). No public registration or forecast access gate is implemented here.

The operator should retain a randomly generated environment-specific signing secret of at least 32 bytes. The length check alone cannot prove key entropy. See [Node.js constant-time comparison](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b) for the comparison primitive's scope.

## Rollback

If necessary, redeploy the prior application revision `8e9a9bb4b446f3db92b8e321abddd8a158a625c7` through the appropriate environment's Git branch. Previous production deployment: `dpl_4jHMiHpdM2hHGjukmuw7xSkDmS5e`; previous staging deployment: `dpl_JE31dDrmXcnqdCRDkv3eSLyJrJd3`. Keep the database and signing secrets unchanged. A rollback also restores the previous expiry/parsing weaknesses, so prefer a forward fix where practical. Future releases still require the normal staging-first approval workflow.
