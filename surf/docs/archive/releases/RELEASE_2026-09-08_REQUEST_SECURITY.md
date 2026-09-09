# Login and request security, 8 September 2026

> Archive status: Dated implementation evidence. Statements about current deployments, data, approvals and rollback refer to this record’s date; they are not new deployment instructions. See the [current handover](../../HANDOVER.md) and [current roadmap](../../IMPLEMENTATION_ROADMAP.md).

Runtime revision: `76bdcb73ae4713d913a2dd3ccc337a8781da5d07`.

The owner authorised implementation, staging deployment and testing, then production if staging passed. Both environments now run this revision. Forecast calculations, spot calibrations, design, existing passwords and signing secrets were preserved.

## Behaviour

Login attempts use shared PostgreSQL counters, so limits apply across server instances. Each fixed 15-minute window admits up to 10 attempts per network and identifier pair, 40 per normalised identifier across networks, and 80 per network across identifiers. Successful attempts count too. Blocked requests return 429 and a Retry-After value; blocked attempts do not extend expiry. Username and email are separate identifiers, not a canonical account-ID lock. The shared teststudent account remains subject to the same limits.

Vercel requests use its trusted x-vercel-forwarded-for header. Other forwarding headers are ignored; IPv6 addresses share a /64 bucket. Missing or invalid trusted addresses share a bounded unknown bucket. Network limiting happens before identifier counters and password work. See [Vercel request headers](https://vercel.com/docs/headers/request-headers).

Counter keys are HMAC-SHA256 values using the existing SESSION_SECRET. The table stores no raw IP address, identifier or password. Rows expired for more than 24 hours become eligible for opportunistic removal in batches of 500 during subsequent login activity. This is not a scheduled 24-hour erasure guarantee. Concurrent increments are atomic; infrastructure failure rejects login with a safe 503 response.

Invalid credentials, missing users and disabled/deleted users receive the same 401 message. A missing user still incurs scrypt password work through a dummy hash. This reduces account-enumeration differences; it is not a claim of perfectly identical timing across all database paths. Existing username login is unchanged. Request bodies are limited to 16 KB, identifiers to 320 characters and passwords to 256 characters.

All 14 writable API handlers check request origin before processing mutations, with an additional guard in requireAuth. Browser requests must have an exact same-origin host from the configured deployment hosts and HTTPS; cross-site and same-site subdomain metadata is rejected. Local HTTP origins are permitted only in development/test. No wildcard preview origins or forwarded-host trust is used.

When Origin is absent, a client must provide `X-MyWavePlan-Request: 1`. The shared UI request helper now supplies it. It is an explicit non-browser API marker, not a secret. Cross-origin browser requests with this header require CORS preflight, which the app does not enable. Older already-open clients with a valid same-origin Origin continue working without the new marker. Read-only requests are unchanged.

## Migration and rollout

The additive migration [20260908_login_limits.sql](../../../db/migrations/20260908_login_limits.sql) creates auth_login_limits and its expiry index. Apply it before deploying this runtime against any older database.

Rehearsal used existing isolated branch `br-morning-glade-adu8v769`, which is not connected to either live app. Neon refused another branch because the branch limit was full. The migration was then applied separately to staging `br-small-salad-adx0nsj2` and production `br-weathered-silence-adp30k9s` in project `shy-paper-68550619`. No business database was copied. The production migration preserved all five users.

Verified runtime deployments:

| Environment | Deployment |
| --- | --- |
| Staging | `dpl_9qXjY5xNZcP4ehuYuTBicqbYfN6x` |
| Production | `dpl_44J4FUH7pZeon6twpNYonzcP73zX` |

Documentation and verification-script follow-ups do not change runtime behaviour.

## Verification

- 77 unit/regression tests passed, including origin validation, rate keys, handler error behaviour and existing forecast/session tests.
- Seven isolated database scenarios passed: repeatable migration, 20 concurrent pair attempts admitting exactly 10, non-extending expiry, recovery, distributed identifier limit, network limit and safe cleanup of expired current buckets.
- Nine live API scenarios passed separately on staging and production. They covered all 14 mutation handlers, missing/opaque origins and cross-site metadata, old-client compatibility, student write denial, normal creation/editing, consistent errors, spoofed forwarding headers, rate denial and expiry recovery.
- In-app browser checks confirmed student login, a safe failed-login message, successful retry and populated forecasts. Workspace button automation did not respond in that browser. Independent Chrome checks confirmed desktop navigation and the 390-pixel mobile menu. Mobile coverage is browser emulation, not a physical iPhone.
- Both Vercel builds reached READY. Error/fatal log scans for each runtime deployment returned no entries during verification. Expected 401/403/429 responses were generated deliberately by the tests.

Dedicated test users and schools were removed after verification. Rate counters expire through the normal policy; test cleanup does not clear real users' limits. Browser test sessions use the existing session expiry policy. The user's existing browser tabs and account sessions were preserved; temporary test tabs were closed and viewport overrides reset.

Scripts: [database rehearsal](../../../scripts/check-login-limits.mjs), [live release check](../../../scripts/check-request-security-release.mjs). The live verifier requires an explicit environment, a private connection file at `/private/tmp/mwp-security-ENV-url`, and separate check/cleanup commands. It creates disposable records and must not be run as a read-only health check. Never commit connection files or fixture state.

## Rollback and remaining work

Roll back application code to `2c354a83e3b3de70f476aaab51050dfa9b3270b5` if necessary. The additive counter table can remain. Removing it while this runtime is active makes login fail closed. Do not rotate SESSION_SECRET as a rate-limit reset; that also affects authentication.

This is a bounded security release, not a complete security audit. Next: audit cross-school access and instructor/student privacy, remove public playground routes and isolate demo data. Review dependency security upgrades. Password recovery, its own abuse controls, platform-admin MFA and global multi-school identity remain future work.
