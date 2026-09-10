# Environments and release workflow

Maintained operating reference, organised 9 September 2026. Project/branch mapping and B2 deployments were checked live on 9 September; capacity/region planning also uses the dated infrastructure review. [Docs index](README.md) · [Current handover](HANDOVER.md).

## Environment mapping

| Environment | URL | Git branch | Vercel project | Neon branch |
| --- | --- | --- | --- | --- |
| Staging | [staging.mywaveplan.com](https://staging.mywaveplan.com) | `staging` | `mysurfplan-staging` | `br-small-salad-adx0nsj2` |
| Production | [mywaveplan.com](https://mywaveplan.com) | `main` | `mywaveplan-prod` | `br-weathered-silence-adp30k9s` |

Both Vercel projects use application root `surf`. Neon project: `shy-paper-68550619`, in the existing Vercel-managed organisation. Its last recorded region is AWS us-east-1. Both A2 Vercel deployment records report `iad1`; A2 did not move runtime or storage to the EU. EU migration is planned under A8 and has not happened. Verify the actual destination before any migration or write operation. Current quota, recovery and region decisions are in [infrastructure capacity and upgrades](INFRASTRUCTURE_CAPACITY_AND_UPGRADES.md).

Both environments run the approved F18 application `7b3046b841e5c32a5f39e0acc9a28b6929a5865a`, promoted with documentation commit `89652325fc80a7a76813ccdea3e93b7cdbd08f2b` on 10 September. Production passed the same API/browser checks as staging. [Production evidence](archive/releases/RELEASE_2026-09-10_CONDITIONS_UX_PRODUCTION.md). No database migration or copy was required. [F18 daylight/cache/mobile staging evidence](archive/releases/RELEASE_2026-09-10_SPOT_CARDS_DAYLIGHT.md). Deployment IDs and next work are maintained in [HANDOVER.md](HANDOVER.md); [membership release evidence](archive/releases/RELEASE_2026-09-09_MEMBERSHIP_AUTHORISATION.md) records the B2 rollout. The application dependency baseline remains A2.

## Local setup and database prerequisites

Use Node.js 22 and run `npm ci` from `surf`. Keep `DATABASE_URL` and `SESSION_SECRET` in an ignored `.env.local`. Use a randomly generated signing secret of at least 32 bytes; production-mode builds reject missing, short or development values. Preserve existing valid environment secrets. Contentful is unused; its three legacy variables were removed from both Vercel projects in A2 and must not be recreated for normal setup. Never commit credentials, connection exports or browser sessions.

Verify the database endpoint and branch before local writes. Prefer a confirmed isolated rehearsal branch for migration tests. The last account review found 10/10 occupied branches; do not delete a branch or assume another one can be created without reviewing its purpose and capacity.

The deployed authentication runtime requires these additive migrations on an older database:

- [Optional usernames](../db/migrations/20260905_login_usernames.sql), for username-aware login.
- [Revocable sessions](../db/migrations/20260907_revocable_sessions.sql), for database-backed sessions.
- [Login limits](../db/migrations/20260908_login_limits.sql), for shared rate counters.

They have already been applied to the recorded staging and production databases. The 7 September session release required one re-login when stateless cookies were replaced; it is not a requirement to invalidate sessions again on every deployment. Non-browser mutation clients must send `X-MyWavePlan-Request: 1` when Origin is absent; valid same-origin browser requests remain compatible.

For a fresh database, review [schema.sql](../db/schema.sql) and the migration requirements of the target runtime before initialisation. The historical conditions setup uses `node scripts/migrate-conditions.mjs --staging` after verifying the endpoint. Its `--staging` flag is an acknowledgement, not automatic endpoint verification. It loads `.env.local`, adds conditions tables/lesson references and seeds initial spots/tide data while preserving existing spot edits. Initial seeds do not reproduce later admin calibrations or the current reviewed catalogue; preserve or migrate the intended current spot records/history. See [spot data model](SPOT_DATA_MODEL.md).

Run `npm run dev`, `npm test` and `npm run build` from `surf` for application work. The build includes `npm run lint`; development and build scripts explicitly use Webpack. Keep the reviewed Node.js 22 / Next.js 16 baseline and run `npm ls --all` plus `npm audit` before releases. See [dependency configuration](DEPENDENCY_BASELINE.md). Database rehearsal and deployed verification scripts are linked from their release records. Live verification scripts can create disposable records; inspect their scope before running them. Use explicit private connection files and clean only authorised fixtures.

### Current B2 migration and checks

Both live databases use `memberships` authority. [B2 runtime and migration contract](MEMBERSHIP_AUTHORISATION.md) records the two-phase prepare → compatible deployment → activate sequence. Use `migrate-membership-authority.mjs`, `check-membership-authority-schema.mjs` and `check-membership-release.mjs` for current verification. B1 compatibility tests must not run against an activated B2 database. An old application rollback is unsafe; use B2-compatible code or a forward repair.

### Historical B1 membership migration

The following procedure applies only to an older database before B2 activation.

[Membership data model and migration procedure](MEMBERSHIP_DATA_MODEL.md) describes the versioned additive schema. Use `node scripts/migrate-memberships.mjs <environment> --audit` first; `--apply` is explicit and checks the verified direct endpoint. The runner applies the SQL, backfill and checksum in one transaction with source-data fingerprints and bounded locks. Rehearse on the existing isolated branch before staging; promote separately to production after checks. No live authority change, database copy, owner inference or email verification occurs in B1.

`db/schema.sql` is now explicitly the legacy bootstrap. Apply B1 through its migration runner afterwards; do not use bootstrap SQL to upgrade an existing environment. `check-membership-schema.mjs` verifies the new constraints with rolled-back fixtures. The historical `check-school-access-release.mjs` checks B1's API compatibility and requires the B1 migration before running. Its older 13-case version is preserved in the A2 release commit for historical reproduction.

## Forecast access and database separation

The app fetches Open-Meteo forecasts and calculates tides from harmonic constants. [Conditions architecture](CONDITIONS_ARCHITECTURE.md) documents providers, model, freshness, tide datum and calibration limits. The free hosted endpoint is restricted to non-commercial use. Complete the A5/L1 classification and configure server-side `OPEN_METEO_API_KEY` for licensed commercial access when required; the app selects customer endpoints automatically.

Production was initialised from reviewed merged data on 5 September and subsequently received separate migrations and calibration updates. The databases remain independent. Bookings, sessions, operational timestamps and caches can diverge; a later code or presentation release does not copy or reset them. See the [dated database promotion](archive/releases/RELEASE_2026-09-05_DATABASE_PROMOTION.md) for historical merge and rollback resources, and the [7 September spot promotion](archive/releases/RELEASE_2026-09-07_FORECAST_CALIBRATION.md) for the latest documented calibration synchronisation.

The owner authorised a one-off B2 cleanup on 9 September. Both environments now retain the two named accounts, Demo Surf School, its test-student customer link and matching forecast configuration. All other disposable operational records were removed. Protected passwords/session records were not copied or changed; caches and security counters remain separate. This does not change the policy against routine database cloning. See the B2 release evidence.

## Useful browser checks

On both environments, login always follows the device and has no selector; saved signed-in preferences are preserved. Elsewhere, appearance defaults to the device setting. System, Light and Dark choices apply per browser/origin; staging and production preferences are separate. Check login, workspace/mobile menu, forms, public schedule and tide charts, including reload and live system changes. Quality tiles retain semantic colours and the selected-day outline.

The first spot picker after login requests location once per page load. A fresh Conditions screen selects the nearest spot when location succeeds; explicit spot links, manual choices and requested dates take precedence. A–Z is the fallback when location is denied or unavailable. Switching order preserves selection; clicking Nearest to me retries location. Coordinates stay in memory and are not sent to app APIs; distances are straight-line estimates. Lesson forms require deliberate spot selection. Use synthetic coordinates for tests.

[Home-screen support](HOME_SCREEN.md) covers icons and iPhone/Android installation. Each origin has its own manifest identity; staging does not launch production. No offline/service-worker forecast cache is implemented. Test desktop/mobile, appearance, selected-time tide interaction, hourly parameter parity and permissions for affected releases.

## Deployment and review

Push the reviewed change to `staging`, wait for READY, then verify the staging custom domain. Leave production on its existing release until the owner approves, unless the specific task already authorises promotion after successful staging tests. Historical release approvals do not authorise new changes. After promotion through `main`, verify production and record evidence, compatible rollback and remaining limits in the current handover and a dated archive/releases record.

The student-only `teststudent` account and Demo Surf School are available in both recorded environments. A1 verified demo isolation against two disposable schools; [current permissions](ACCESS_CONTROL.md) document its scope. Use dedicated test fixtures and preserve unrelated records. Lessons must select a database spot. Keep credentials and private test state outside committed documentation.

Do not synchronise entire databases as part of a UI release. For any migration, rehearse first, preserve writes during cutover and define a rollback that accounts for subsequent data. Inspect historical rollback branches before relying on them. Close temporary testing tabs and reset viewport overrides afterwards.
