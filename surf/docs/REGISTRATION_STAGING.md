# Registration on staging

11 November: account flows remain available in both environments; B4 token-free invitation return destinations and four-language service-email privacy links are verified. Staging stays allowlisted and its cron/monitor are off outside tests. Production public email, ten-minute retries and monitoring remain active. Older activation steps below are historical; do not repeat account migrations or disable production scheduling. [Release](archive/releases/RELEASE_2026-11-11_STAFF_INVITATIONS.md).

A visitor requests an email first. The verified link opens the personal account form for name, password, adult confirmation and acceptance of the current terms. Account creation grants no school access. The original app destination is offered after signup and normal sign-in. Existing personal accounts can edit their name from the profile. Email and access changes follow their separate workflows.

Recovery sends a link only for an active, verified account eligible for self-service recovery. The reset replaces the password and revokes existing sessions in one transaction. Platform administrators use the operator recovery procedure. The app accepts existing password hashes and uses stronger scrypt settings for newly stored hashes. The common and breached password check and session-safe legacy rehash remain open before public activation.

## Staging activation

1. Use staging preview version `2026-11-04.3` for the registration test. It includes revised terms and privacy notices in all four languages, covering verified self-registration, adult confirmation, recovery and Mailjet. Set `ACCOUNT_REGISTRATION_TERMS_VERSION=2026-11-04.3` in the staging project. Public launch requires separately approved and published policies.
2. Create or use a dedicated Mailjet staging subaccount and verify a sender under `staging-mail.mywaveplan.com` for that key. Enter its `MAILJET_API_KEY` and `MAILJET_SECRET_KEY` directly in the sensitive environment settings of the `mysurfplan-staging` Vercel project. Set `EMAIL_FROM` to the verified sender and use `support@mywaveplan.com` for replies.
3. Complete the [email activation runbook](EMAIL_JOBS_RUNBOOK.md), including separate worker, callback, payload and recipient secrets, the staging recipient list, quotas and an authenticated worker run. Verify the worker runs regularly before enabling registration. The request endpoint requires a successful worker heartbeat within five minutes in manual mode or 15 minutes with automatic delivery enabled. It also checks the recorded send quota.
4. Set `ACCOUNT_REGISTRATION_ENABLED=true` and `EMAIL_ENABLED=true` only in the staging project for the approved test window. Staging always uses `EMAIL_TEST_RECIPIENTS`. `ACCOUNT_EMAIL_PUBLIC` applies only in production and needs a separate release decision.
5. With approved test inboxes, verify the two received emails on desktop and mobile. Test verification and recovery, sender authentication, Support replies, callback recording, language, expiry, one-time use and old-session revocation. Compare the received emails with the [Figma previews](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ?node-id=441-2).

The additive migration `20261104_account_registration.sql` is applied to staging. The registration release is deployed at commit `f9ff77cf2654cf8072a39681b6bd039aef96f539`. While the feature is disabled, normal sign-in remains available. Use manual worker runs for the allowlisted delivery test before scheduling recurring work.

## Verified staging delivery

On 4 November, Mailjet validated the separate staging sender domain and confirmed its SPF and DKIM records. The delivery check, account verification and password reset messages reached the approved inbox. The staged test account accepted the exact current terms, signed in without school access, rejected replayed verification and reset links, and signed in with its new password after reset. The old session no longer worked. The message Reply-To pointed to Support. Delivery event callbacks and a live reply to Support still need verification. The staging worker was run manually for the test.


## Automatic account email delivery

Add the following entry to `crons` in `surf/vercel.json` for the approved project's release. The same entry enables immediate account email delivery.

```json
{
  "path": "/api/cron/jobs",
  "schedule": "*/10 * * * *"
}
```

An accepted registration or recovery request commits its email to the existing outbox and asks Vercel to attempt that specific job in the background. The scheduled worker processes due retries and pending jobs that the immediate attempt missed, performs maintenance and records the health check. The scheduled worker needs its own successful heartbeat to keep account email ready. A missed immediate send or a due retry can wait until the next ten-minute sweep.

Keep the staging schedule off outside tests. To turn it off, remove the cron entry and redeploy, then verify the staging project has no active schedule. Removing the entry also returns staging to manual testing. A Vercel instant rollback alone does not disable cron.

For production, apply the reviewed registration and account lifecycle migrations if required, publish the approved policies, configure separate production Mailjet and Vercel credentials, and deploy the schedule to the production project. Verify its scheduled heartbeat, inbox delivery and failure alerts with an approved recipient before enabling public account email. Check actual Vercel and Neon usage after activation. A ten-minute sweep gives the database a chance to suspend after its five-minute idle timeout, roughly halving the compute time due to polling alone on an idle database.

See the [4 November production account release](archive/releases/RELEASE_2026-11-04_ACCOUNT_PRODUCTION.md) for the production schema, policy version, monitoring and rollback record.
