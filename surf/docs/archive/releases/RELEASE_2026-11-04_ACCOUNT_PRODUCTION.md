# Production account release, 4 November 2026

The first production release of the localised account flows is live on MyWavePlan. The production and staging login pages show the same signup and recovery actions. Production accepts signup requests from any valid email address, with email verification, rate limits and send budgets in place. Staging account pages explain that email is limited to invited testers, and both the server and worker enforce its allowlist. Staging uses its own Mailjet key and Neon branch and has no recurring schedule.

## Setup and ownership

- Vercel builds production from GitHub `main` and staging from `staging`. The production project's `surf/vercel.json` schedules the authenticated `/api/cron/jobs` endpoint every ten minutes. Only the production project has this schedule. Signup and reset requests commit to the Neon outbox and trigger an immediate targeted Vercel background send. The scheduled worker handles retries, interrupted jobs and retention work.
- Neon production applied `20261006_legal_evidence`, `20261104_preferred_locale`, `20261104_french_locale`, `20261104_account_registration` and `20261104_account_lifecycle`. A savepoint rehearsal verified all five changes and rolled them back before the release transaction applied them. The ledger records each checksum.
- Terms and privacy version `2026-11-04.4` are published in English, Portuguese, Spanish and French. The terms describe password-confirmed immediate closure and the exceptions that go to the Support review queue. Personal-data erasure requests go through Support. The release preserves legal acceptance evidence and publishes no school-processing agreement.
- Mailjet's production key sends from `support@mywaveplan.com` and uses the same Reply-To. Mailjet confirmed SPF and DKIM for the domain. The five grouped callbacks cover Sent, Bounce, Blocked, Spam and Unsubscribe. Open and click tracking are disabled. Vercel holds the Mailjet credentials, callback authentication and worker secrets in production-scoped Secret variables.
- Healthchecks.io monitors the scheduled production worker, independently of Mailjet. The production check uses a ten-minute period with a five-minute grace window. Staging has a separate check and secret and stays idle while its cron is off. For a staging test window, deploy the same schedule to staging and resume its check. Pause the staging check and remove the schedule at the end of the window. The worker reports overdue work, imminent reset expiry, recently expired or uncertain deliveries, provider rejection and exhausted send quotas during the scheduled run. This avoids separate database polling. Healthchecks sends alerts to the Zoho Support mailbox. The owner manages the Support closure queue.

## Support account activity emails

Production queues a fixed message to Support after a successful signup, password change or reset, or completed self-closure. The notice and its account change commit together. Failed attempts and closure requests still waiting for review do not send an activity email. The notification includes the event and Lisbon time, without the person's name, email address, password or account ID. The normal ten-minute worker sends these notices under the same delivery limits and retry rules. Staging does not send account activity mail to Support.

The `20261104_account_activity_notices` migration adds the three message types and a production-bound enqueue function. In a future analytics release, decide which routine account activity emails to replace with consent-appropriate metrics. Keep operational failure alerts separate from product analytics.

## Verification and activation

Production signup and password reset emails reached the allowlisted test inbox. Both recorded a live Mailjet Sent callback after one attempt. The production test verified exact terms acceptance, no school access on signup, one-time verification and reset links, old-session revocation and immediate self-closure. The closed test account cannot log in. Its acceptance record remains available.

A controlled Healthchecks failure reached the Support mailbox. The next scheduled production run restored the check and the recovery email also reached Support. The cron alone processes at most three jobs per sweep, so watch overdue work as well as successful heartbeats.

The account activity test produced one signup, two password and one closure notice. All four reached Support, recorded a Mailjet Sent callback and had their queued payloads cleared. Both disposable production accounts were closed after their tests.

The account pages have a terms retry control that keeps the verification link and entered fields in memory. The allowlist notice and larger mobile help-link targets are available in all four supported languages. The desktop login illustration keeps its height when the language or form content changes. The mobile illustration keeps its existing layout.

Production enabled `ACCOUNT_EMAIL_PUBLIC=true` after the allowlisted tests verified signup, reset, closure, callback receipts and independent Support alerts. For a stop, turn off public account email or email sending as appropriate and redeploy. To stop the recurring worker, remove the production cron definition and redeploy, then check Vercel's registry. Instant Rollback alone leaves the cron schedule in place. Keep the additive schema, published policy versions, historical acceptances and closure records.

The release used the GitHub connector for reviewed tree and ref updates, Neon SQL transactions for schema and policy verification, the Vercel connector and CLI for deployment and cron checks, Chrome and Apple Mail for provider setup and inbox confirmation, Healthchecks.io for independent alerts, and Astra for read-only database, security and browser review. Run `npm test` and `npm run build` in `surf` for the code checks.
