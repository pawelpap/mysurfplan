# Production account release, 4 November 2026

The first production release of the localised account flows is live on MyWavePlan. The production login hides the signup and recovery links during allowlisted testing. Testers can reach the account pages directly. The server and Mailjet worker both enforce the recipient allowlist. Staging uses its own Mailjet key and Neon branch and has no recurring schedule.

## Setup and ownership

- Vercel builds production from GitHub `main` and staging from `staging`. The production project's `surf/vercel.json` schedules the authenticated `/api/cron/jobs` endpoint every ten minutes. Only the production project has this schedule. Signup and reset requests commit to the Neon outbox and trigger an immediate targeted Vercel background send. The scheduled worker handles retries, interrupted jobs and retention work.
- Neon production applied `20261006_legal_evidence`, `20261104_preferred_locale`, `20261104_french_locale`, `20261104_account_registration` and `20261104_account_lifecycle`. A savepoint rehearsal verified all five changes and rolled them back before the release transaction applied them. The ledger records each checksum.
- Terms and privacy version `2026-11-04.4` are published in English, Portuguese, Spanish and French. The terms describe password-confirmed immediate closure and the exceptions that go to the Support review queue. Personal-data erasure requests go through Support. The release preserves legal acceptance evidence and publishes no school-processing agreement.
- Mailjet's production key sends from `support@mywaveplan.com` and uses the same Reply-To. Mailjet confirmed SPF and DKIM for the domain. The five grouped callbacks cover Sent, Bounce, Blocked, Spam and Unsubscribe. Open and click tracking are disabled. Vercel holds the Mailjet credentials, callback authentication and worker secrets in production-scoped Secret variables.
- Healthchecks.io monitors the scheduled production worker, independently of Mailjet. The check uses a ten-minute period with a five-minute grace window. The worker reports overdue work, imminent reset expiry, recently expired or uncertain deliveries, provider rejection and exhausted send quotas during the scheduled run. This avoids separate database polling. Healthchecks sends alerts to the Zoho Support mailbox. The owner manages the Support closure queue.

## Verification and activation

Production signup and password reset emails reached the allowlisted test inbox. Both recorded a live Mailjet Sent callback after one attempt. The production test verified exact terms acceptance, no school access on signup, one-time verification and reset links, old-session revocation and immediate self-closure. The closed test account cannot log in. Its acceptance record remains available.

A controlled Healthchecks failure reached the Support mailbox. For a release or incident check, confirm the next authenticated scheduled worker run marks the check healthy. The cron alone processes at most three jobs per sweep, so watch overdue work as well as successful heartbeats.

The account pages have a terms retry control that keeps the verification link and entered fields in memory. The private production email notice and larger mobile help-link targets are available in all four supported languages.

Keep `ACCOUNT_EMAIL_PUBLIC=false` until the production rollout gates are recorded as passed. For a stop, turn off public account email or email sending as appropriate and redeploy. To stop the recurring worker, remove the production cron definition and redeploy, then check Vercel's registry. Instant Rollback alone leaves the cron schedule in place. Keep the additive schema, published policy versions, historical acceptances and closure records.

The release used the GitHub connector for reviewed tree and ref updates, Neon SQL transactions for schema and policy verification, the Vercel connector and CLI for deployment and cron checks, Chrome and Apple Mail for provider setup and inbox confirmation, Healthchecks.io for independent alerts, and Astra for read-only database, security and browser review. Run `npm test` and `npm run build` in `surf` for the code checks.
