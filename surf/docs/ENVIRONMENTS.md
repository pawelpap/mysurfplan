# Environments and release workflow

Maintained operating reference, organised 9 September 2026. Project/branch mapping and A1 deployments were checked live on 9 September; capacity/region planning also uses the dated infrastructure review. [Docs index](README.md) · [Current handover](HANDOVER.md).

## Environment mapping

| Environment | URL | Git branch | Vercel project | Neon branch |
| --- | --- | --- | --- | --- |
| Staging | [staging.mywaveplan.com](https://staging.mywaveplan.com) | `staging` | `mysurfplan-staging` | `br-small-salad-adx0nsj2` |
| Production | [mywaveplan.com](https://mywaveplan.com) | `main` | `mywaveplan-prod` | `br-weathered-silence-adp30k9s` |

Both Vercel projects use application root `surf`. Neon project: `shy-paper-68550619`, in the existing Vercel-managed organisation. Its last recorded region is AWS us-east-1. EU migration is planned under A8 and has not happened. Verify the actual destination before any migration or write operation. Current quota, recovery and region decisions are in [infrastructure capacity and upgrades](INFRASTRUCTURE_CAPACITY_AND_UPGRADES.md).

The latest recorded runtime is `9c96b5fc76f51153f6081da62b9ee788915b04e7` on both environments. Deployment IDs and next work are maintained in [HANDOVER.md](HANDOVER.md); [school-access release evidence](archive/releases/RELEASE_2026-09-09_SCHOOL_ACCESS_PRIVACY.md) records the last rollout.

## Local setup and database prerequisites

Use Node.js 22 and run `npm ci` from `surf`. Keep `DATABASE_URL` and `SESSION_SECRET` in an ignored `.env.local`. Use a randomly generated signing secret of at least 32 bytes; production-mode builds reject missing, short or development values. Preserve existing valid environment secrets. Never commit credentials, connection exports or browser sessions.

Verify the database endpoint and branch before local writes. Prefer a confirmed isolated rehearsal branch for migration tests. The last account review found 10/10 occupied branches; do not delete a branch or assume another one can be created without reviewing its purpose and capacity.

The deployed authentication runtime requires these additive migrations on an older database:

- [Optional usernames](../db/migrations/20260905_login_usernames.sql), for username-aware login.
- [Revocable sessions](../db/migrations/20260907_revocable_sessions.sql), for database-backed sessions.
- [Login limits](../db/migrations/20260908_login_limits.sql), for shared rate counters.

They have already been applied to the recorded staging and production databases. The 7 September session release required one re-login when stateless cookies were replaced; it is not a requirement to invalidate sessions again on every deployment. Non-browser mutation clients must send `X-MyWavePlan-Request: 1` when Origin is absent; valid same-origin browser requests remain compatible.

For a fresh database, review [schema.sql](../db/schema.sql) and the migration requirements of the target runtime before initialisation. The historical conditions setup uses `node scripts/migrate-conditions.mjs --staging` after verifying the endpoint. Its `--staging` flag is an acknowledgement, not automatic endpoint verification. It loads `.env.local`, adds conditions tables/lesson references and seeds initial spots/tide data while preserving existing spot edits. Initial seeds do not reproduce later admin calibrations or the current reviewed catalogue; preserve or migrate the intended current spot records/history. See [spot data model](SPOT_DATA_MODEL.md).

Run `npm run dev`, `npm test` and `npm run build` from `surf` for application work. Database rehearsal and deployed verification scripts are linked from their release records. Live verification scripts can create disposable records; inspect their scope before running them. Use explicit private connection files and clean only authorised fixtures.

## Forecast access and database separation

The app fetches Open-Meteo forecasts and calculates tides from harmonic constants. [Conditions architecture](CONDITIONS_ARCHITECTURE.md) documents providers, model, freshness, tide datum and calibration limits. The free hosted endpoint is restricted to non-commercial use. Complete the A5/L1 classification and configure server-side `OPEN_METEO_API_KEY` for licensed commercial access when required; the app selects customer endpoints automatically.

Production was initialised from reviewed merged data on 5 September and subsequently received separate migrations and calibration updates. The databases remain independent. Bookings, sessions, operational timestamps and caches can diverge; a later code or presentation release does not copy or reset them. See the [dated database promotion](archive/releases/RELEASE_2026-09-05_DATABASE_PROMOTION.md) for historical merge and rollback resources, and the [7 September spot promotion](archive/releases/RELEASE_2026-09-07_FORECAST_CALIBRATION.md) for the latest documented calibration synchronisation.

## Useful browser checks

Appearance defaults to the device setting. System, Light and Dark choices apply per browser/origin; staging and production preferences are separate. Check login, workspace/mobile menu, forms, public schedule and tide charts, including reload and live system changes. Quality tiles retain semantic colours and the selected-day outline.

The first spot picker after login requests location once per page load. A fresh Conditions screen selects the nearest spot when location succeeds; explicit spot links, manual choices and requested dates take precedence. A–Z is the fallback when location is denied or unavailable. Switching order preserves selection; clicking Nearest to me retries location. Coordinates stay in memory and are not sent to app APIs; distances are straight-line estimates. Lesson forms require deliberate spot selection. Use synthetic coordinates for tests.

[Home-screen support](HOME_SCREEN.md) covers icons and iPhone/Android installation. Each origin has its own manifest identity; staging does not launch production. No offline/service-worker forecast cache is implemented. Test desktop/mobile, appearance, selected-time tide interaction, hourly parameter parity and permissions for affected releases.

## Deployment and review

Push the reviewed change to `staging`, wait for READY, then verify the staging custom domain. Leave production on its existing release until the owner approves, unless the specific task already authorises promotion after successful staging tests. Historical release approvals do not authorise new changes. After promotion through `main`, verify production and record evidence, compatible rollback and remaining limits in the current handover and a dated archive/releases record.

The student-only `teststudent` account and Demo Surf School are available in both recorded environments. A1 verified demo isolation against two disposable schools; [current permissions](ACCESS_CONTROL.md) document its scope. Use dedicated test fixtures and preserve unrelated records. Lessons must select a database spot. Keep credentials and private test state outside committed documentation.

Do not synchronise entire databases as part of a UI release. For any migration, rehearse first, preserve writes during cutover and define a rollback that accounts for subsequent data. Inspect historical rollback branches before relying on them. Close temporary testing tabs and reset viewport overrides afterwards.
