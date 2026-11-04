# Registration on staging

A visitor requests an email first. The verified link opens the personal account form for name, password, adult confirmation and acceptance of the current terms. Account creation grants no school access. The original app destination is offered after signup and normal sign-in. Existing personal accounts can edit their name from the profile. Email and access changes follow their separate workflows.

Recovery sends a link only for an active, verified account eligible for self-service recovery. The reset replaces the password and revokes existing sessions in one transaction. Platform administrators use the operator recovery procedure. The app accepts existing password hashes and uses stronger scrypt settings for newly stored hashes. The common and breached password check and session-safe legacy rehash remain open before public activation.

## Staging activation

1. Obtain approval for a new terms version that describes verified self-registration. The terms reviewed on 4 November say that an administrator creates each account. Review the corresponding privacy wording for email, adult confirmation and recovery data. Publish the approved terms as staging previews under a new version in each language. Set `ACCOUNT_REGISTRATION_TERMS_VERSION` to that version.
2. Create or use a dedicated Mailjet staging subaccount and verify a sender under `staging-mail.mywaveplan.com` for that key. Enter its `MAILJET_API_KEY` and `MAILJET_SECRET_KEY` directly in the sensitive environment settings of the `mysurfplan-staging` Vercel project. Set `EMAIL_FROM` to the verified sender and use `support@mywaveplan.com` for replies.
3. Complete the [email activation runbook](EMAIL_JOBS_RUNBOOK.md), including separate worker, callback, payload and recipient secrets, the staging recipient list, quotas and an authenticated worker run. Verify the worker runs regularly before enabling registration. The request endpoint rejects issuance if the worker has no successful heartbeat within five minutes or its recorded quota is exhausted.
4. Set `ACCOUNT_REGISTRATION_ENABLED=true` and `EMAIL_ENABLED=true` only in the staging project for the approved test window. Staging always uses `EMAIL_TEST_RECIPIENTS`. `ACCOUNT_EMAIL_PUBLIC` applies only in production and needs a separate release decision.
5. With approved test inboxes, verify the two received emails on desktop and mobile. Test verification and recovery, sender authentication, Support replies, callback recording, language, expiry, one-time use and old-session revocation. Compare the received emails with the [Figma previews](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ?node-id=441-2).

The additive migration is `20261104_account_registration.sql`. Apply it before the updated worker. While the feature is disabled, normal sign-in remains available. The deployment can be tested on staging separately from Mailjet and legal activation.
