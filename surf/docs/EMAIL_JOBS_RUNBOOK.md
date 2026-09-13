# Application email and job operations

13 September 2026. A6/A7 foundation, with activation deferred by the owner until registration. See the [release record](archive/releases/RELEASE_2026-09-13_EMAIL_JOBS.md). This does not complete A6 monitoring, A7 capacity approval or B3 registration.

## Current scope

The additive outbox, worker, Mailjet adapter, authenticated callbacks and shared Support email design are implemented. Only an operator-triggered `email.delivery_check` template is allowed. No existing login, forecast, lesson or UI route enqueues email. Sending defaults to off, there is no cron entry, and neither live Vercel project has Mailjet API credentials. Domain verification and a Vercel integration installation did not populate those credentials. No application email has been sent or verified through Mailjet in this release.

The owner will upgrade the existing Vercel team when the registration flow needs reliable email. Do not activate a paid schedule now. Zoho business/support email works independently. Mailjet remains the agreed application sender.

## Implementation and safety

- Migration: `db/migrations/20260913_email_outbox.sql`, checksum tracked by `identity_schema_migrations`; run `node scripts/migrate-email-jobs.mjs rehearsal --rehearse`, then `--apply` on rehearsal/staging/production in order. The runner pins direct Frankfurt hosts, requires private connection exports and defaults to an audit. Never re-run the legacy bootstrap against live databases.
- `job_environment` binds each database to staging or production. Separate databases and secrets remain mandatory. `job_outbox` stores opaque idempotency keys, minimal references, an HMAC recipient hash and an AES-256-GCM encrypted short-lived payload. Job/environment/type context is authenticated with the ciphertext. No plaintext recipient or provider response is retained in job metadata.
- A caller can pass its transaction's query to `enqueueDeliveryCheck`; rollback also removes the job. B3 must add its own allowlisted message types, business-state checks and templates in a reviewed migration. Do not reuse the delivery-check type for password links or arbitrary HTML.
- Atomic claims use `FOR UPDATE SKIP LOCKED`, with 60-second leases and at most three sends per invocation. Requests time out after eight seconds. Database quota reservation and dispatch marking commit before the network call. An abandoned pre-dispatch lease returns to pending; an abandoned dispatch becomes `delivery_unknown`. Stale workers cannot overwrite completed jobs.
- Confirmed throttling retries after 1, 2, 5, 15 and 60 minutes with jitter, or later if `Retry-After` requires it. Six attempts maximum, always bounded by expiry. Explicit rejection stops; 5xx, malformed success and network uncertainty do not automatically resend. Mailjet CustomID is correlation, not an exactly-once promise.
- Delivery callbacks require environment-specific Basic authentication plus the opaque signed event payload and matching recipient hash/job. Message GUIDs avoid JavaScript integer loss for Mailjet's large numeric IDs. Duplicate events have no second effect. Hard bounce, spam and unsubscribe suppress further mail; soft bounces are recorded without application resend. Negative terminal events dominate late `sent` events. `sent` means acceptance by the destination mail server, not that a person read the message.
- Both environments remain restricted to at most five approved test recipients in this release. Production daily/monthly limits are at most 150/4,500; staging at most 20/500. Attempts, including unknown outcomes, consume the budget. These conservative limits leave shared-account headroom but do not measure manual Mailjet sends or other applications. Confirm actual account entitlements before activation.
- Operator checks have a database-enforced one-minute enqueue cooldown. There is no public send relay or student/admin-session shortcut. Responses and logs omit recipients, message bodies and credentials.
- A pending payload expires after two hours for delivery checks. Terminal outcomes remove it immediately. Worker maintenance removes up to 100 old terminal jobs per run after 30 days, including associated event receipts; usage buckets older than two months are removed. Suppression hashes remain to prevent repeat delivery. All retention proposals and provider-side contacts/retention require A4/B8 review before real users. Cleanup does not run while the worker is disabled.

## Routes and required settings

| Route | Access | Purpose |
| --- | --- | --- |
| `GET /api/cron/jobs` | `Authorization: Bearer` using `CRON_SECRET` | Manually invoke a bounded worker now; schedule only after approval/readiness. |
| `GET /api/internal/email` | Separate `EMAIL_OPERATIONS_SECRET` bearer | Counts, oldest overdue time, heartbeat and budget usage. No recipient data. |
| `POST /api/internal/email` | Operations bearer | Body contains only `idempotencyKey`; sends no email itself, queues the fixed check for the first configured test recipient. |
| `POST /api/webhooks/mailjet` | Basic username is environment, password is `EMAIL_CALLBACK_SECRET` | Accept required delivery events, max 50 per body and 64 KB. |

All routes return `503 email_disabled` before loading the database while `EMAIL_ENABLED` is absent/false. Invalid methods return 405. Once enabled, missing/incorrect authentication returns 401 before any database access. Invalid configuration fails closed.

Required server-only settings for later activation:

| Variable | Requirement |
| --- | --- |
| `APP_ENVIRONMENT` | `staging` or `production`; matched to the database and project. |
| `VERCEL_ENV`, `VERCEL_PROJECT_ID` | Production deployment target and the correct existing project's ID. Ensure system environment variables are exposed. Neither preview nor an unknown project can send. |
| `EMAIL_ENABLED` | Explicit `true` only during approved delivery tests or activation. |
| `MAILJET_API_KEY`, `MAILJET_SECRET_KEY` | Separate staging/production sender credentials. Inspect existing account/subaccount entitlements; do not silently reconnect integrations. |
| `EMAIL_FROM` | Production `support@mywaveplan.com`; staging a verified sender at `staging-mail.mywaveplan.com`. That subdomain is not yet configured or verified. |
| `EMAIL_TEST_RECIPIENTS` | Comma-separated approved test addresses; no arbitrary public recipients in this release. |
| `EMAIL_PAYLOAD_KEY`, `EMAIL_PAYLOAD_KEY_ID` | Independent random 32-byte key encoded as 64 hex characters; version identifier. |
| `EMAIL_RECIPIENT_KEY` | Independent random HMAC secret, stable for suppression matching. |
| `EMAIL_CALLBACK_SECRET`, `EMAIL_OPERATIONS_SECRET`, `CRON_SECRET` | Different random secrets, different again between environments; minimum 32 characters. |
| `EMAIL_DAILY_LIMIT`, `EMAIL_MONTHLY_LIMIT` | Positive integer budgets within the bounds above. Start delivery tests with smaller limits. |

Store secrets only in the correct Vercel project's production target and the approved secure recovery mechanism. No secrets in Git, screenshots, callback exports or chat. Protect callback URLs containing Basic credentials from logs. A6 must define the independent alert channel before scheduling; an email failure must not depend on that same email service to alert the operator.

## Support email design

`lib/email/template.mjs` supplies the shared MyWavePlan Support shell. It uses the existing wave logo, teal accent, navy text, mobile-friendly spacing and a Support Team footer linking to `support@mywaveplan.com` and the website. There is no phone number. Copy is escaped; both HTML and plain text are present. The logo URL is a public static asset shared by all recipients, with no recipient/job identifiers. Mailjet open and click tracking are disabled. Client image blocking still leaves the brand name, message and contact details readable. Verify received rendering in Apple Mail/Gmail and on a phone before sending registration emails.

Poppins is the preferred typeface, matching the website, with Arial, Helvetica and sans-serif fallbacks declared inline on the message text. Regular and bold Latin/extended Latin WOFF2 files are hosted under each environment's `/fonts/poppins/` path, with the SIL Open Font License included. Font requests contain no recipient identifiers and do not contact Google. Public font responses allow cross-origin loading by email clients. Word-based Outlook gets an explicit Arial override; Apple Mail can load Poppins, while Gmail and unsupported clients use the fallback. See the [email font compatibility matrix](https://www.caniemail.com/features/css-at-font-face/). This does not change the website's font loading or the Mac Mail signatures.

Run `npm run preview:email` in `surf` after changing the template. This generates the [local preview](assets/email/support-email-preview.html) and the public, non-indexed `/email-preview/support.html` sample from the actual delivery-check renderer. The hosted sample resolves fonts from its current environment; sent messages use absolute HTTPS asset URLs. The preview contains no real recipient, job identifier, token or credential and sends no email.

## Activation before B3 registration

1. Finish reviewed policy/provider/retention decisions and the separately authorised B3 implementation. Current account/forecast journeys continue without the worker; registration, password recovery, invitations and reminders are not delivered by this release.
2. Configure separate Mailjet credentials, sender authentication and required `sent`, `bounce`, `blocked`, `spam`, `unsub` callbacks. Use Mailjet's authenticated HTTPS callback URL and version-2 grouped events. Confirm the live account's quotas and status. Do not enable open/click events.
3. Configure staging server-only settings and one approved test recipient. Queue one check, invoke the worker manually, verify delivery, authenticated callback, suppression behaviour, mobile/desktop email design and a reply reaching Zoho Support. Inspect received MIME for disabled tracking. Repeat the applicable checks in production with separate secrets. Real inbox/callback tests are still outstanding.
4. The owner upgrades Vercel to Pro before registration activation. Add `/api/cron/jobs` with a one-minute schedule, verify the authenticated deployed trigger, and test a deliberately missed attempt followed by recovery. Leave staging scheduling off outside active tests, using a documented environment-specific scheduling strategy. Do not add a shared cron entry that silently wakes both databases every minute.
5. Connect an independent operator alert for pending work overdue by five minutes, stale heartbeat, unknown sends, repeated provider rejection and budget exhaustion. Measure Neon active time and review the US$20 notification. A single continuously active 0.25-CU endpoint is roughly 180 CU-hours per 30 days; this is a workload estimate, not spending approval.
6. Open registration only after all B3 gates pass. Future verification/recovery links need their own expiry, supersession, scanner/replay/race and deletion tests. Add reminder/payment/deletion job types separately, with request-path enforcement of deadlines and permissions.

## Recovery and rollback

Set `EMAIL_ENABLED=false` and redeploy to stop new worker/API operations. An already executing request may finish its current bounded send. Remove/pause the schedule too if active. Keep the additive tables during an application rollback; existing app code does not depend on them.

Do not reset unknown jobs to pending. Reconcile the opaque job/provider IDs with Mailjet and authenticated events; confirm delivery status before any separately authorised replacement message. Never print raw provider records into a public incident report.

Only one payload key version is active in this initial release. Drain/cancel pending jobs before rotation. Preserve the previous key securely for its backup retention period; after a restore, keep sending off, inspect/restage unknown work and reconcile already-sent messages before reactivation. A missing/wrong payload key stops that job and erases its active payload; the safe recovery is a new owner-authorised delivery check. B3 must extend key recovery for real, short-lived security links and verify deletion/revocation after restores. HMAC key changes require a suppression migration; do not rotate it blindly. A6/A4 must settle the secure key backup owner and access process before activation.

## Provider references

[Mailjet send contract](https://dev.mailjet.com/docs/email-api/send-api-v31/send-basic-email), [event types](https://dev.mailjet.com/docs/email-api/webhooks/event-types), [callback authentication/retries](https://dev.mailjet.com/docs/email-api/webhooks/webhooks-overview), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing). Verified 13 September 2026. These provider documents do not replace the outstanding live delivery tests.
