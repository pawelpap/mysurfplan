# Temporary public student demo

Added 12 September 2026 for friends testing the forecast. This is temporary access, separate from personal registration and the planned public forecast work (B3/C1).

## Entry and permissions

On staging and production, choose **Try the demo** or submit **Log in** with both fields empty. The button works even if the browser has autofilled other credentials. Demo entry always opens Conditions. Partial, missing or incorrect credentials never fall back to the demo.

The dedicated account is named **Demo student**, username `demo-student`, with a synthetic address `demo-student@mywaveplan.invalid`. It has no password, no verified email claim, and no instructor/admin/platform roles. It is linked as a customer to Demo Surf School. The existing `teststudent` account and its password remain separate and unchanged.

The session has the student role plus `demo: true`. Forecasts, spot comparison, charts and the full 16-day forecast are available. The demo workspace is focused on Conditions. API writes, booking changes, private staff endpoints and logging out every visitor are blocked server-side. Each visitor gets their own revocable session. Disabling the account, or granting it staff/platform authority, prevents new demo logins and invalidates access through existing sessions.

Network and network/account rate limits remain active. Public demo visitors do not share the normal 40-attempt account-wide quota. The normal password-login limits are unchanged. Session cookies retain the existing seven-day expiry and secure attributes.

## Storage and rollout

Migration `20260912_public_demo` adds `users.is_demo`, a unique active-demo index, a student/no-password constraint, `account_demo_eligible()` and one synthetic user/customer record per environment. Environment-specific IDs may differ. Existing accounts, students and spot calibrations are preserved. The version/checksum is recorded in `identity_schema_migrations`.

Apply the migration before deploying the application. The migration runner supports a full rollback rehearsal and checks real session queries, disabled-account handling and attempted staff/platform promotion. Release checks are in `scripts/check-public-demo-release.mjs`.

| Environment | Demo user ID | Neon branch |
| --- | --- | --- |
| Staging | `03685b30-abe4-4b8c-9604-2ccacdae4af6` | `br-small-salad-adx0nsj2` |
| Production | `28f3e70e-4ed9-471d-b04c-c1d767db918c` | `br-weathered-silence-adp30k9s` |

Both belong to Neon project `shy-paper-68550619`, database `neondb`. Verify the identity and flag before cleanup; do not assume another environment has the same user ID.

## Disable and remove later

Review this access before real self-service onboarding or the G1 pilot. Do not reuse the demo identity for a real person, add personal details to it or grant staff access. The demo is not a substitute for individual user accounts.

1. Disable **Demo student** in the platform Accounts screen in each environment. Confirm it is the account with username `demo-student` and `is_demo=true`, not `teststudent` or the platform owner. This stops both new demo logins and existing demo access. Confirm an empty login is rejected and an already-open demo session can no longer load forecasts.
2. In the same retirement release, remove the Try the demo button and empty-credential branch, restore required credential fields, and remove demo-specific navigation. Deploy and test normal login/logout on staging, then production. Do not leave a broken demo invitation visible.
3. After checking dependencies, remove only that demo user's sessions and synthetic customer/user records. Check for linked bookings first; do not cascade-delete shared school or lesson data. Preserve Demo Surf School, `teststudent`, the owner account and all surf spots. Decide separately whether the original shared `teststudent` account should also retire.
4. Remove unused demo schema/code with a new versioned migration after the application no longer queries it. Keep migration history and this retirement record. Record the date and verification in the handover and roadmap.

If rolling back to an application older than this feature, **disable the demo account first**: the old application does not enforce the additional demo read-only restrictions. Leave the additive schema in place until the later cleanup migration.

Never log credentials, session cookies or tokens when testing or cleaning up. The account can be disabled without deleting the school or changing anyone else's password.
