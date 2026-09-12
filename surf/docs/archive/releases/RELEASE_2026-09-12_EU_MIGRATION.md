# EU database and runtime migration, 12 September 2026

The owner authorised A8, staging first and production after successful tests. Both live environments now use Neon and Vercel application functions in Frankfurt. No pages, components, styles, forecast calculations, dependencies, domains, DNS or email configuration changed.

## Live release

| Environment | Deployment | Database branch | Direct endpoint |
| --- | --- | --- | --- |
| Staging | `dpl_JAnGkb1GidwiSWyfZr4KbvsN4VEL` | `br-shy-grass-b2hqthrm` | `ep-shiny-violet-b2em1q82.c-6.eu-central-1.aws.neon.tech` |
| Production | `dpl_3UsDoixmwAyNPZ8S6rJSWQV74cBR` | `br-sparkling-hat-b2ogsvs0` | `ep-soft-smoke-b2v7g8iu.c-6.eu-central-1.aws.neon.tech` |

Source commit `73a9ae1`; both deployments were built from the same Git archive. Vercel project IDs and custom domains are unchanged. Both deployment API records report `regions: ["fra1"]`; live database-health responses also identify `fra1` and return HTTP 200 with `db: true`.

Neon project `crimson-butterfly-63506764` (`mywaveplan-eu`), region `aws-eu-central-1`, uses the existing Vercel-managed Launch installation `icfg_gvSsEvrggHMQgb3MKabtIBbD`, resource `store_z5kN7J9epTJSjxzw`. Defaults and both live computes are 0.25–1 CU with 300-second idle suspension. Project history retention is seven days. No Vercel plan upgrade or new provider account was made. Staging has a separately reset database password. Vercel `SESSION_SECRET` IDs and update timestamps were preserved; sensitive values were not extracted or replaced.

## Method and integrity

Each environment received its own final US snapshot, never the other environment's users or sessions. Statement-level write fences cover INSERT, UPDATE, DELETE and TRUNCATE on all 24 source public tables, including existing connections. The final consistent snapshot was exported under REPEATABLE READ, restored while the destination was offline, cleaned, compared, and then its ready deployment was promoted. The source fences remained until the old US project was deleted after final verification.

The forward migration removes only empty `public.surf_lessons`, `public.surf_bookings` and the unused `neon_auth.users_sync`/schema. It refuses populated tables and unexpected dependencies; no CASCADE is used. Historical SQL/checksums remain unchanged. The obsolete cross-environment reconciliation script now refuses execution.

Final comparisons passed for 21 application tables, excluding the two retired tables and the intentionally extended migration ledger. Twelve schema groups cover columns/nullability, constraints, indexes, triggers, routines, enums, views, grants, extensions, sequences, row security and policies. Five stored migration checksums match source files. Both environments retain three users, one school, two student records, zero lessons and 17 active spots after fixture cleanup. The owner's platform authority and existing password/session data were preserved. Every stored calibration still validates.

## Compatibility findings

Vercel provisioning selected PostgreSQL 18.6; the US source used 17.11. Rehearsal and live tests therefore covered a major PostgreSQL upgrade as well as region migration. `pgcrypto` moved from 1.3 to 1.4 and `pg_jsonschema` from 0.3.3 to 0.3.4. Other extensions stayed unchanged.

The operator restore tool addresses two discovered restore issues without weakening constraints:

- The existing calibration validator performs an unqualified lookup. pg_restore's empty search path makes it return false. The tool uses `public` in the isolated restore session, retaining PostgreSQL's implicit built-in precedence; stored function definitions stay unchanged.
- Neon-owned `cloud_admin` default table/sequence ACLs cannot be transferred by the database owner. Only those two provider defaults are excluded. Application grants are compared after restore.

PG18 adds NOT NULL rows to `pg_constraint`; column nullability is compared directly. It also prints a redundant `AS text` alias in two non-leading UNION arms of `account_school_access`. Only that exact formatting difference is normalised for the view fingerprint. Other definitions must match. Early rehearsal failures were rolled back before either live cutover.

## Verification

- Node.js 22: all 108 unit tests, lint and production build passed. One pre-existing avatar-image lint warning remains.
- Fresh legacy bootstrap and migrations through B2/public demo/cleanup completed on an isolated EU branch. Cleanup is repeatable and rejects each populated legacy table and an unexpected dependent view.
- Nine membership-authority database checks passed with rolled-back fixtures.
- Twenty school/account/booking API checks passed locally, then on staging and production. Dedicated fixture accounts, schools, lessons and bookings were removed.
- Fourteen forecast API checks and nine desktop/mobile browser groups passed locally and on both live domains. This includes 17 spots, 16-day forecasts, calibration output, geolocation/A–Z fallback, linked charts and layout. Browser errors were empty.
- Seven public-demo API groups passed on each live environment, including empty/partial credentials, student-only access and isolated logout.
- Existing valid cookies survived each cutover; explicitly revoked cookies remained invalid. Only the check's own sessions were logged out.
- French/mobile and Portuguese/desktop translation-mutation and recovery checks passed on both live domains. Test browser contexts were closed.
- A native Neon snapshot was restored to a separate EU branch. Data/schema comparison passed before the later canary erasure and revocation were replayed; both restored canary tokens were then rejected.
- The write fence blocked all four write forms on an already-open test connection and was safely removed on the rehearsal branch.

Two illustrative health requests from the developer's network measured 291/78 ms on EU staging and 1055/177 ms on the still-US production deployment. These are small first/subsequent-request samples, not a cold-start benchmark or latency guarantee.

## Retirement and recovery

The owner explicitly authorised finalisation and removal of the old setup on 12 September and waived US rollback retention. All five old US computes were disabled, then Vercel resource `neon-lime-house` (`store_d6iQGmMzzlg5IKVW`) was disconnected from both projects and deleted. Neon project `shy-paper-68550619`, including the old ten-branch setup, no longer appears in the account. Vercel lists only the EU resource. The CLI resolves the resource by name; using its store ID returned “not found” without changing anything.

Active unprefixed database variable IDs/update times and SESSION_SECRET metadata remained unchanged after unlinking. Both live health endpoints again returned HTTP 200 with database connectivity in fra1. Both passed the seven demo/API groups again, including normal teststudent login, 17 spots, 16 forecast days, student restrictions and independent logout. Their three accounts, one school and 17 active spots remain; the retired legacy objects are absent.

The owner separately approved deletion of `a8-restored-verification` (`br-bold-dust-b2bjj1xq`) and both temporary snapshots; those deletions succeeded. Four EU branches remain: production, staging, reusable `security-rehearsal` and `staging-ancestor-no-runtime`. The ancestor is needed by staging and must not be deleted blindly. Its unused compute is now disabled following the owner’s specific approval; neither live app uses it. Full IDs and lifecycle purposes are in the [current runbook](../../EU_DATA_MIGRATION_PLAN.md).

US-retirement and EU-test-deletion approval blocks were resolved by explicit owner approvals. No integration installation or authenticated provider account was removed or switched. The existing EU resource uses the same Neon Launch installation. No new Vercel plan purchase, domain or DNS change was made.

The temporary migration test server was stopped. The ignored local `.env.local` was updated from the retired US host to pooled EU staging, preserving other values. Existing user development servers need a restart to pick up this URL. Private local migration archives, keys, connection exports and test cookies are disposed of at final handover; no US rollback export is retained. Historical Vercel releases are not compatible rollback targets now that their old database is deleted. The verified Frankfurt release is the recovery baseline.

Recovery remains available through seven-day EU Neon history and the tested procedures. Native snapshot restore must use `finalize: false` while validation and erasure/revocation replay take place. Finalisation can swap names and computes; re-resolve branch IDs afterwards. Future restore operations must preserve later erasures/revocations and valid writes before reopening traffic. A6/B8 still need durable operational replay/retention jobs, incident ownership and alerts.

Accurate wording: MyWavePlan's primary application database and application functions run in Frankfurt, EU. The old US project has been deleted. This does not promise immediate erasure of provider-internal backups or EU-only CDN, builds, logs, administration, support or other processors. A4 provider/legal review remains open.
