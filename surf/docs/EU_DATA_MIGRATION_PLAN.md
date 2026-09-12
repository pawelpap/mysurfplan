# EU database migration and recovery runbook

Updated 12 September 2026. **Staging and production migration, verification and old-US retirement are complete.** [Release evidence](archive/releases/RELEASE_2026-09-12_EU_MIGRATION.md) · [Environments](ENVIRONMENTS.md) · [Handover](HANDOVER.md)

## Current placement

- Neon: `crimson-butterfly-63506764`, `mywaveplan-eu`, AWS Frankfurt (`aws-eu-central-1`), PostgreSQL 18.6.
- Staging: `br-shy-grass-b2hqthrm`, direct host `ep-shiny-violet-b2em1q82.c-6.eu-central-1.aws.neon.tech`.
- Production: `br-sparkling-hat-b2ogsvs0`, direct host `ep-soft-smoke-b2v7g8iu.c-6.eu-central-1.aws.neon.tech`.
- Existing Vercel projects deploy functions to `fra1`. Domains, DNS, provider accounts and application UI are unchanged.
- Live computes: 0.25–1 CU, 300-second idle suspension. Project recovery history: 604,800 seconds. Existing Launch billing and the owner's US$20 spending notification remain; the notification is not a cap.
- Runtime URLs are explicitly managed per environment. Production preview/development fallback points to EU staging. Staging's database password is separate. Do not reconnect resources with default branch settings that overwrite this mapping.
- Existing Vercel session-signing secrets were preserved. Sensitive env pulls return redacted values, so they are not a usable signing-key backup. Never replace a secret with the redacted export.

## Migration procedure used

The tools [eu-migration.mjs](../scripts/eu-migration.mjs), [configure-eu-deployment.mjs](../scripts/configure-eu-deployment.mjs) and [check-migrated-sessions.mjs](../scripts/check-migrated-sessions.mjs) require explicit environments/hosts and private connection files. Read the scripts before reuse. They are pinned to this migration, not a generic production reset facility.

1. Verify source/destination IDs, region, app deployments, current permissions, every table and dependency. Keep each environment's own users, sessions, memberships and calibration records.
2. Create a consistent custom-format dump under an exported REPEATABLE READ snapshot. Local archives are AES-256-GCM encrypted; input files/keys have mode 0600 in a mode-0700 directory. Keep secrets and personal payloads outside Git and tool output.
3. Rehearse restore and the forward `20260912_remove_unused_legacy` migration on an isolated branch. Exclude inactive `neon_auth`; refuse populated legacy tables and unknown dependencies. Preserve immutable migration history. The retired cross-environment merge script must not be reused.
4. Compare application data fingerprints and schema, including permissions, sequences, row security and calibration validation. Test fresh migration replay and the cleanup refusal cases. The release record describes the reviewed PG17→PG18 and extension differences.
5. Test the application, native backup restore, later erasure/revocation replay and an existing connection under the write fence. Keep mail sending disabled for fixture tests.
6. Prepare the EU Vercel deployment with `--prod --skip-domain`. Verify it is READY while the live custom domain still uses the source. Preserve SESSION_SECRET.
7. Fence all source writes, including old deployments and login/cache writes. Capture the final source snapshot, restore the offline target and compare. Promote only after success. After traffic opens, verify valid/revoked cookie continuity, health, school permissions, forecasts, geolocation, mobile and demo access.
8. Do staging first, then production. Recheck and record current branch IDs after native restore operations, which can swap names and computes.

The source calibration validator depends on a public search path. The operator restore session sets `search_path=public`, keeping implicit pg_catalog precedence. It does not disable constraints or edit calibration functions. Only provider-owned cloud_admin default ACLs are excluded; application grants must match. PG18 NOT NULL metadata and a narrowly identified redundant UNION alias are handled explicitly by the comparison tool.

## Rollback and erasure protection

The old US project has been deleted with explicit owner approval; there is no US rollback copy. Do not point the application to a historical US URL or deployment after EU has accepted writes. That can lose new data or revive revoked/erased records. Prefer a forward repair; otherwise fence the current authority, take a consistent copy, reconcile/replay all later writes and erasures, verify, and then reopen traffic on one authority only.

Neon history is configured for seven days. A native snapshot restore and an encrypted dump restore were tested in Frankfurt. Native snapshots currently require a root branch; the staging branch is not a root. For staging SQL recovery use the tested dump procedure or separately verify the applicable branch/PITR operation. A retention setting alone is not a tested complete recovery procedure.

Use `finalize: false` for snapshot recovery while checking data and replaying later erasures and revocations. Finalisation can move computes and swap branch names, even if a new name was supplied. Always list the branches and endpoints afterwards. Do not treat a previously saved branch ID as permanent across a finalised restore.

A6/B8 still need a durable operational erasure/revocation replay process, incident ownership, alerting and retention jobs. This rehearsal proves the procedure using disposable canaries; it does not implement those future jobs.

## Final resource inventory and retirement

The owner explicitly approved finalisation and old-setup removal on 12 September, waived US data retention, and separately approved deletion of the EU restore-test branch and snapshots. The proposed seven-day US rollback window was superseded. Seven-day **EU Neon recovery history** remains configured.

| Resource | Purpose and lifecycle |
| --- | --- |
| EU live staging / production | Current authority, keep. IDs and hosts above |
| EU `br-falling-cell-b2i32j8w`, `security-rehearsal` | Reusable isolated migration/security/API test branch. Direct host `ep-holy-breeze-b2bby6tz.c-6.eu-central-1.aws.neon.tech`. Contains the restored test dataset and is pinned in membership check scripts. Five-minute compute auto-suspension; restrict access and review before real personal data |
| EU `br-square-truth-b2ytepyn`, `staging-ancestor-no-runtime` | Required ancestor of staging and security rehearsal, retained to preserve branch ancestry. No live Vercel app points here. Its unused compute `ep-calm-scene-b2tuq8li` is disabled after specific owner approval. Do not delete without supported dependency handling |
| EU `br-bold-dust-b2bjj1xq`, `a8-restored-verification` | Deleted after owner approval; served neither app |
| EU snapshots `snap-patient-waterfall-b29po4i4`, `snap-fragrant-field-b21sdime` | Both deleted after owner approval; migration-test snapshots only |
| US `shy-paper-68550619`, `neon-lime-house` | Deleted, including the old ten-branch setup. All five computes were disabled first; Neon project listing then confirms only the EU project remains |
| Vercel old resource `store_d6iQGmMzzlg5IKVW` | Deleted using `vercel integration-resource remove neon-lime-house --disconnect-all --yes`. Resource listing confirms removal; old generated variables are absent from both projects |
| Vercel EU resource `store_z5kN7J9epTJSjxzw` | Existing Launch installation, current EU project. Runtime branch URLs are managed explicitly; integration listing shows no automatic project links by design |

Four EU branches remain. Active database variable IDs/update times and SESSION_SECRET metadata were verified unchanged after old-resource unlinking. Both custom-domain health endpoints reported HTTP 200, database connectivity and fra1; demo/normal-student login, 17 spots, 16-day forecasts and permission checks passed again after cleanup.

Automatic approval review initially blocked US retirement; the owner's subsequent explicit approval resolved it. EU restore-test deletion was separately approved and completed. Disabling the unused ancestor compute initially required a more specific confirmation. The owner supplied it and the endpoint is now disabled; branch data/ancestry remain intact. This does not block the completed migration or leave any US app/database runtime active. No provider/plugin account connection was changed.

Historical Vercel deployments may still appear in release history. They contain obsolete configuration and are not safe rollback targets after US deletion. Retain the verified Frankfurt release as the compatible application baseline. Any future repair must deploy with the current EU variables.

Temporary local connection exports, encrypted migration archives/keys and verification cookies are removed at final handover. The ignored local `.env.local` now uses pooled EU staging. Existing user development servers need restarting to load it. The migration's test server is stopped; user development servers and browser tabs are unaffected. No retirement automation or future US-deletion task remains.

## Privacy wording and next work

Accurate: **MyWavePlan's primary application database and application functions run in Frankfurt, EU.** The old US project and app-managed rollback copies have been retired. Provider-internal deletion/backup retention remains subject to its terms; project deletion is not proof of immediate physical media erasure. Do not claim all data, CDN traffic, logs, builds, provider administration, support access, mail or future media/analytics are EU-only. A4 must finish the processor/contract and transfer review.

Next technical work is A6/A7 email and job readiness: working support mailboxes, verified Mailjet sending/isolation, delivery tests, durable outbox/retries and the necessary scheduler/capacity decision. B3 self-registration follows with B6 policies and separately approved A9 localisation. No further paid upgrade, mailbox change or feature implementation was made by A8.
