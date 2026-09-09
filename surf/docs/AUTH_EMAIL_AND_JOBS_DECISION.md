# Authentication, email and background-job decision

9 September 2026. **A3 complete: architecture decision only.** Implementation, provider activation and delivery tests remain in A6/A7 and B3/B9. This document refines the [accepted identity design](REGISTRATION_AND_MEMBERSHIP_PROPOSAL.md) and [roadmap](IMPLEMENTATION_ROADMAP.md). No application, database, DNS, provider account or subscription is changed by this decision.

## Decision

1. Retain MyWavePlan's application-owned accounts and database-backed sessions. Complete the security gaps below before self-service launch. Do not combine an authentication-provider migration with B1/B2's membership migration.
2. Use **Mailjet Free for the initial pilot**, with tracking disabled and delivery/limit tests before activation. The owner accepted this revised direction after comparing setup effort as well as sending cost. Keep SES as a possible higher-volume alternative; Scaleway and MailerSend are also reviewed below. Do not register AWS for the current email plan.
3. Keep pending work in a **transactional Neon outbox**, processed by a bounded Vercel function. Attempt urgent email immediately after committing the job, then use **Vercel Pro Cron every minute** to recover due work. Do not add a separate queue platform initially. This requires a technical hosting/capacity decision before live email, and increases database active time.
4. Use **`MyWavePlan <support@mywaveplan.com>`** for production email, as selected by the owner. No email service for the domain has been configured. A receiving mailbox is a separate setup requirement; Mailjet provides outgoing delivery, not that inbox.

B1 can proceed without an email account, subscription or DNS changes. B3 must not enable real signup until delivery, support replies, EU migration, policies and the other roadmap prerequisites pass. A3 does not certify the existing application as ready for public self-registration.

## Authentication: keep the foundation, complete its lifecycle

Reviewed [auth.js](../lib/auth.js), [auth-session.mjs](../lib/auth-session.mjs), [auth-store.mjs](../lib/auth-store.mjs), [login.js](../pages/api/auth/login.js), [request security](../lib/request-security.mjs) and [database schema](../db/schema.sql) at runtime revision `4f9d93fb64b5d4ccc046849d8eb9d795caa3857c`.

The current implementation has random server-side session identifiers stored as hashes, seven-day expiry, secure HTTP-only cookies, live account checks, revocation, password/status invalidation, shared login throttling and mutation-origin checks. Passwords use salted asynchronous scrypt and constant-time comparison. These are useful foundations; email verification, recovery and MFA are not implemented.

| Option | Assessment | Decision |
| --- | --- | --- |
| Existing accounts/sessions | Preserves user IDs, current protections and the accepted UI; no additional identity licence. We remain responsible for security maintenance and recovery. | Keep. Add capabilities through the staged work below. |
| Auth0 | Offers EU tenant localities and managed lifecycle features. Its published B2C Essentials example starts at US$35/month for 500 active users; B2B pricing and feature requirements differ. Migration, password compatibility and total costs need their own rehearsal. | Reserve alternative if the planned lifecycle cannot meet acceptance or security ownership becomes impractical. |
| Clerk | Managed authentication, but its published security page currently states US hosting with no regional residency selection. | Do not introduce it alongside the EU-first membership work. |

Sources checked 9 September: [Auth0 regions](https://auth0.com/docs/get-started/auth0-overview/create-tenants), [Auth0 pricing](https://auth0.com/pricing), [Clerk residency](https://clerk.com/security). An EU tenant does not by itself settle every support, log or subprocessor transfer. No external identity account was provisioned.

### Required changes and release boundaries

- **B1:** keep the existing user UUID as the identity anchor. Add memberships, independent roles and platform-authority records without changing password formats, live permissions or sessions. Do not mark legacy emails verified or infer school ownership. Report duplicate/ambiguous identity links.
- **B2:** remove the requirement that every non-platform user has an active primary school. Session validity follows the global user; school permissions come from current memberships and record relationships on every request. Keep existing username/email login and revocation protections. Rehearse school closure and combined instructor/admin access.
- **B3:** add purpose-bound, single-use verification/recovery challenges, controlled email change, resend limits, consistent responses and secure return links. Harden password storage and new-password policy as described below. No public signup until A8 and B6 are complete; A9 supplies locale handling.
- **B9:** enforce MFA for platform administrators before G1, with recent authentication for security and ownership actions. Use a maintained TOTP implementation with encrypted enrolment secrets, replay protection and hashed single-use recovery codes. Never implement cryptographic primitives ourselves. Email password recovery must not disable MFA or grant a fully authenticated privileged session. Enrolment, factor replacement and lost-factor recovery need their own tests and support procedure. Passkeys can follow without changing membership ownership.

**Password hardening is a recorded gap, not an implemented fix.** Current scrypt parameters are `N=16384, r=8, p=1`, with a 64 MiB memory ceiling. OWASP's listed configurations require more work, for example `N=131072, r=8, p=1`, or `N=16384, r=8, p=5`. B3 should benchmark the latter using the existing Node scrypt implementation, including concurrent login load, and meet a listed current baseline before rollout. Keep algorithm/parameter metadata versioned and bound accepted verification parameters. Preserve legacy verification, then rehash after successful authentication using an atomic comparison against the verified old hash. Test interaction with `auth_version`, password-change races and session issuance. Do not silently invalidate all sessions merely because of a storage upgrade. Never bulk-reset passwords to migrate the model. [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

For new or changed single-factor passwords, adopt a minimum of 15 characters, allow password-manager paste and long passphrases, and reject common/breached passwords through a reviewed privacy-preserving check. Preserve existing login compatibility. Do not expose an unchecked public exception for the shared demo account. [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

### Verification and recovery contract

Store a cryptographically random token's hash, purpose, user ID, bound normalised email, creation/expiry/consumption times and relevant account version. Proposed expiry defaults are 30 minutes for password recovery and 24 hours for verification; B4 defines invitation expiry separately. These are product defaults to verify, not supplier guarantees.

Consumption and the resulting state change must be atomic. Reject expiry, replay, wrong purpose/address, disabled/deleted users and stale requests. A GET from an email scanner must not consume the token or change the account. Complete the operation through an explicit protected action. Password recovery revokes existing sessions and returns to normal login, including MFA where required. Email changes require recent authentication, verification of the new address and notification to the old address.

Apply shared per-network and per-account throttles, resend cooldowns and global send limits. Avoid account enumeration through response text, status or obvious timing differences. Keep raw tokens out of logs, analytics, referrers and third-party assets. Use server-configured application origins and allowlisted relative return destinations. The same browser is not required to verify an email. Verification grants no school role; B4 still requires explicit invitation acceptance. [OWASP recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [email verification/change](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html)

## Transactional email provider

**Revised decision, 9 September:** Mailjet Free is the initial pilot choice. This replaces the earlier SES-first proposal. Mailjet's existing email console/API and free allowance appear more practical for this small pilot than introducing AWS solely for email. This is an engineering assessment, not a measured claim about superior inbox placement. Verify sender approval, actual account limits and delivery during B3 setup. No service has been registered or activated.

| Provider | Published starting terms | Assessment for MyWavePlan |
| --- | --- | --- |
| **Mailjet Free** | 6,000 emails/month, maximum 200/day; API/SMTP/webhooks. Starter is US$9/month for 8,000 with no daily cap. Personal data is stored in Germany and Belgium; API controls can disable opens/clicks. | **Initial pilot choice.** Suitable only while projected daily peaks leave headroom. Upgrade before the cap can delay account emails. No AWS setup required. |
| **Scaleway TEM Essential** | No monthly subscription; 300 emails/month per organisation included, then €0.25 per 1,000. Five domains and one webhook per domain. | Additional low-cost alternative to SES. API/SMTP, delivery reports and automatic blocklisting fit the basic use case. Verify exact data/backup coverage, tracking-free delivered content, initial sending quotas and event authentication before selecting it. No Essential-plan SLA is claimed. |
| **MailerSend** | Free 500/month with 100/day; Hobby US$7/month for 5,000. Free/Hobby each allow one sending domain; API-token and webhook limits differ. Its hosting statement identifies Belgium; domain tracking can be disabled. | Viable managed alternative, but the free tier is below our 3,000/month scenario and one-domain limits constrain staging separation. No clear reason to choose it over Mailjet for this pilot. |
| **Amazon SES, Ireland** | À la carte US$0.10 per 1,000 recipient emails, plus data/optional services. Requires AWS configuration and regional sending approval. | Retain as a possible higher-volume alternative. Low sending cost, more account/IAM/event configuration. **Not the current activation plan.** |
| Resend | Free 3,000/month, 100/day; Pro US$20/month for 50,000. Its GDPR page places stored message content/logs/account records in the US despite EU sending. | Convenient integration, but poorer fit for the preferred storage policy. |
| Brevo | Free 300/day; Starter from US$9/month for 5,000. Published database hosting is in the EU. | Its documented anonymous tracking still records opens/clicks. A satisfactory tracking-free low-tier setup was not established. |

Sources checked 9 September: [Mailjet pricing](https://www.mailjet.com/pricing/), [Mailjet storage](https://documentation.mailjet.com/hc/en-us/articles/360042712274-Where-is-my-personal-data-stored), [Mailjet tracking controls](https://dev.mailjet.com/docs/email-api/send-api-v3/send-api-v3-to-31), [Scaleway prices](https://www.scaleway.com/en/pricing/managed-services/), [Scaleway plan capabilities](https://www.scaleway.com/en/docs/transactional-email/how-to/manage-tem-plans/), [MailerSend pricing](https://www.mailersend.com/pricing), [MailerSend limits](https://www.mailersend.com/help/plans-features-and-limits), [MailerSend location](https://www.mailersend.com/legal/how-mailersend-stays-gdpr-compliant), [MailerSend tracking](https://www.mailersend.com/help/domain-tracking-options), [SES pricing](https://aws.amazon.com/ses/pricing/), [SES regions](https://docs.aws.amazon.com/ses/latest/dg/regions.html), [Resend pricing](https://resend.com/pricing), [Resend storage](https://resend.com/security/gdpr), [Brevo plans](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans), [Brevo storage](https://help.brevo.com/hc/en-us/articles/360001005510-Data-storage-location), [Brevo tracking](https://help.brevo.com/hc/en-us/articles/11643306229906-Can-I-anonymize-the-tracking-of-opens-and-clicks-for-my-emails). These are public terms, not guaranteed account entitlements. No comparative deliverability test has been run. EU storage does not settle every support/subprocessor transfer or recipients' mailbox location.

### Limits and delivery before enabling signup

Mailjet states that messages beyond its free daily quota may queue until the next day, with queued messages retained for up to three days. That behaviour is unsuitable for recovery links. Count all sends across staging/production and any manual activity, reserve sends against bounded environment budgets whose sum stays within the account allowance, alert well before exhaustion and verify provider-reported usage. An initial review threshold is 150/day or 5,000/month; it is an app warning threshold, not a supplier limit. Upgrade before projected peaks consume the remaining headroom. Free-tier availability does not override reliable signup requirements. [Mailjet daily-cap behaviour](https://documentation.mailjet.com/hc/en-us/articles/360043048393-What-is-this-200-emails-per-day-limit-on-free-accounts)

Do not keep submitting urgent messages into a provider queue known to be over quota. Pause affected new requests with a consistent service-status message while preserving login and existing accounts. Expired/superseded links must still fail safely if an already accepted email arrives late. A paid upgrade requires approval; there is no automatic cross-provider failover or silent purchase. Test out-of-quota and burst behaviour in B3 without sending unsolicited mail or exhausting a live account.

Use an application-owned `sendTransactionalEmail` adapter, with a Mailjet implementation and a local recording/test implementation. Keep versioned templates in the repository, plain-text alternatives and accessible HTML through A9's locale system. No marketing list synchronisation, campaigns or browser tracker are needed for account/booking email. Set `TrackOpens` and `TrackClicks` to `disabled`, check account defaults, then inspect received MIME/HTML for tracking pixels and rewritten links. Confirm any free-plan branding requirements for the actual API/template path; do not promise unbranded delivery merely from the API documentation. Marketing permission remains separate under B6/C5.

### Sender, receiving mailbox and DNS

| Setting | Proposed configuration |
| --- | --- |
| Production From and Reply-To | `MyWavePlan <support@mywaveplan.com>`, as requested by the owner. Enable Reply-To only when the address receives mail. |
| Staging From | `MyWavePlan staging <support@staging-mail.mywaveplan.com>`, separately verified and marked with an explicit test subject prefix. |
| Provider return/bounce domain | Use the provider's supported configuration. Add a dedicated subdomain only when the selected plan requires/supports it; no SES-specific `MAIL FROM` records are part of Mailjet setup. |
| Domain authentication | Apply the exact Mailjet-generated verification/DKIM records and documented SPF requirements. Review existing SPF/DMARC together with the receiving-mail provider. Verify alignment before tightening policy; never create multiple SPF records for one name. |
| Receiving support mail | Create a monitored `support@mywaveplan.com` mailbox. Mailjet outgoing delivery does not create a ready-to-use support inbox. |

The owner confirmed no domain email service exists. Prefer a small EU-hosted mailbox; forwarding is an alternative only after the owner specifies the destination and accepts its data location. Zoho Mail Lite is a candidate, with a published US$1/user/month annual-billing example for 5 GB. Its actual EU signup, contract and final invoice still need A4 review; it is not selected or purchased. Reserve €2/month for one small mailbox. [Mailbox pricing example](https://www.zoho.com/mail/zohomail-pricing.html)

Add records to the existing DNS zone after inspecting it. Do not move nameservers or replace website/Vercel records. The receiving provider's root MX and Mailjet's sending authentication have separate purposes. AWS and SES DNS records are not prerequisites for this plan.

### Activation and environment isolation

1. Before B3 integration, the owner creates or explicitly authorises an existing business Mailjet account, completes provider verification and enables available account security. Start Free if its verified capabilities and peak limits suit the test. Confirm the supplied business identity, `PAWEL PAPLINSKI`, tax number `PT311219217`, during signup. Do not put passwords, API secrets or billing details in chat or the repository. No AWS signup is requested.
2. A4/A8 review Mailjet's agreement/DPA, retention, EU storage and any support/subprocessor transfers. Set up the receiving mailbox independently. Verify the actual sender approval and generated DNS settings before delivery tests.
3. Separate production and staging using the primary account and a staging subaccount/API key where the actual entitlement allows it. Mailjet documents one additional subaccount on Free; validate this in the account. Verify senders separately, use distinct callback credentials and restrict each Vercel project's secrets. Application recipient allowlists enforce staging delivery; do not assume the provider has an IAM-style recipient restriction. No sending secrets in unrelated previews. Both Vercel projects use a production deployment target, so environment name alone cannot distinguish them. [Mailjet subaccounts](https://documentation.mailjet.com/hc/en-us/articles/360042561974-How-to-create-delete-a-subaccount-API-Key)
4. Default local tests to a recording adapter. Staging can send only to explicitly owner-approved test recipients. Account quotas may be shared; do not assume subaccounts duplicate the free allowance or fully isolate sender reputation. Keep job data, templates' application origins and event routing environment-specific.
5. Verify allowlisted delivery, authenticated callbacks, failures, quotas and incoming support replies on staging. Enable production only within its authorised release, then repeat affected journey checks. Keep a send kill switch, throttles and independently working operator alerts. Sender approval is not permission to contact unsolicited recipients.

Exact IDs, generated DNS records and approved test addresses belong in the implementation runbook. Provider choice remains replaceable through the adapter; activation is not part of this planning update.

## Durable background work

### Why a Neon outbox and Vercel worker

The business change and its pending job must commit in the same database transaction. A provider queue publish after commit can fail independently; a request callback or serverless in-memory timer cannot guarantee recovery. The database remains the job source of truth.

Use the existing deployment stack initially: an authenticated worker endpoint with a one-minute Pro cron trigger, plus an optional immediate bounded attempt after the transaction commits. Both paths claim the same persisted job. Cron only wakes the worker; retries, concurrency, expiry and monitoring are application responsibilities. Vercel Hobby's daily schedule and hourly timing window cannot meet this requirement. [Current cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

An external queue was considered. QStash has independent EU infrastructure and published free/usage-based tiers, but adds another processor and delivery mechanism; its optional production security package also needs a separate cost review. We do not need it for the first bounded transactional jobs. Reconsider an EU wake-up queue if measured polling costs or workflow complexity justify it, while preserving the database outbox and a reconciliation mechanism. [QStash regions](https://upstash.com/docs/qstash/howto/multi-region), [pricing](https://upstash.com/pricing/qstash)

### Generic job contract to implement in A6/B3

Names below are a target contract, not a migration. B1 should not prematurely create all these tables.

| Record | Required information |
| --- | --- |
| `job_outbox` | UUID, allowlisted job type, payload schema version, business object/user reference, unique business idempotency key, status, priority, creation/due/expiry times, attempt count, lease token/expiry, provider/message ID and sanitised error code. Index due pending work. |
| Sensitive delivery payload | Only the minimum recipient/render data. A raw verification/recovery link needed for a durable retry is an encrypted, short-lived payload with a versioned key outside Neon, not a plaintext token column. Keep the verification record hashed. Redact and erase the encrypted payload after completion or expiry. Include key recovery and old backup handling in A6/B8. |
| Provider event receipt | Provider/topic/environment, unique event identifier, associated job/message ID, event type and time. Deduplicate before applying state changes. Store only fields required for delivery, suppression and support. |

Claim due jobs atomically with row locking/`SKIP LOCKED` or an equivalent single-statement claim; never hold the SQL transaction open during a provider call. Use a bounded batch and execution time. Only the current lease holder can finish or reschedule a job. Expired leases recover abandoned work; request timeouts and lease durations must prevent overlapping sends where possible. Recheck user/address/business state and expiry before sending. Cancel obsolete invitations, deletion-related work and superseded recovery requests.

Persist retry scheduling with jitter and respect provider throttling/`Retry-After`. Start with six attempts and delays based on 1, 2, 5, 15 and 60 minutes, bounded by the job's expiry. These are defaults to test, not a reason to send an expired 30-minute reset link. Permanent recipient failures and configuration/authentication errors stop retrying and trigger the appropriate suppression or operational alert. Do not confuse provider approval/quota/configuration failures with transient outages.

**Exactly-once email delivery is not promised.** Use the opaque job ID for Mailjet message correlation and save returned IDs. `CustomID` is not by itself an idempotency guarantee. Mailjet documents recipient deduplication within `CustomCampaign` using `DeduplicateCampaign`; B3 must test its applicability and retention before relying on it for transactional retries. Never reuse a campaign key across different legitimate messages if it would suppress them. Disable uncontrolled SDK retries; ambiguous timeouts/crashes become `delivery_unknown`, reconciled through provider events/status rather than blindly resent. A user can request a new throttled recovery message. Confirmed jobs replay as no-ops and database business operations remain idempotent. [Mailjet deduplication contract](https://dev.mailjet.com/docs/email-api/send-api-v31/group-campaign)

Receive Mailjet operational events through a dedicated HTTPS callback with environment-specific Basic authentication, as documented by Mailjet. Compare credentials safely, redact callback credentials from diagnostic exports and logs, and do not treat possession of an unguessable URL as authentication. Validate message/environment associations and payload schema; deduplicate repeated event deliveries and handle late/out-of-order events. Do not invent SNS-style signatures that Mailjet does not supply. Test forged and cross-environment requests. Subscribe only to required delivery/failure events; hard bounces/complaints suppress further automated mail to that address. Retain minimal evidence. Provider acceptance/delivery is not proof that a human read the message. [Mailjet webhook contract](https://dev.mailjet.com/docs/email-api/webhooks/webhooks-overview)

Protect cron invocation with an environment-specific secret and constant-time comparison. Reject public/user-session invocation and avoid returning recipient information. Monitor due-job age, unknown sends, permanent failures, throttling, suppression and missed worker heartbeats. Proposed alert thresholds: urgent work overdue by five minutes, or no heartbeat for five minutes. These are operational targets, not a provider SLA. Use an independently working operator alert channel so an email-provider outage can still be reported.

Propose 30 days of minimal completed-job/event metadata, seven days for inspected failures and immediate sensitive-payload removal at completion/expiry. A4/B8 finalise record-specific retention and backup exceptions before enabling the service. Long-term financial records belong to their own retention policy, not to an email log.

Future booking expiry, refunds, deletion and reminders can use the same job contract. Payment deadlines and permission expiry must also be checked in the request/database path; a late worker cannot grant access or oversell a lesson. Do not refresh every forecast from cron merely because a worker exists.

## Cost and timing consequences

- Authentication adds no identity subscription, but development and security maintenance remain our responsibility.
- Mailjet Free adds **€0 outbound-email subscription** while the verified 6,000/month and 200/day limits suffice. Reserve **€2/month** for a support mailbox. If peak headroom requires Starter, its current published price is **US$9/month for 8,000 emails** with no daily cap, before tax/overages. Request approval before upgrading. SES and Scaleway remain usage-based alternatives; neither is activated.
- One-minute cron needs **Vercel Pro**, currently US$20/month for one deploying seat before additional usage. Use the existing team; do not buy separate base plans for staging and production. This is a technical prerequisite for live retry delivery even if L1's commercial trigger has not yet occurred.
- Continuous polling can keep both Neon endpoints awake. Two endpoints at 0.25 CU for 720 hours consume **360 CU-hours**, approximately **US$38.16 compute alone** at the published Launch rate. This replaces, rather than adds to, the earlier 80–200 CU-hour scenario. Storage, history, heavier compute and branches are extra. A7 must check effective Vercel-managed quotas and approve the measured budget; do not assume Neon Free will suffice.
- For the proposed small launch with both workers enabled and Mailjet Free, retain **€90–120/month before tax/payment fees** as a planning allowance. The component scenario is €91–111; Starter instead gives roughly €100–120, for which €100–130 leaves modest headroom. Database active time remains the main reason for the revised budget. This is not today’s bill or spending approval. Staging may have a documented disabled-sending schedule outside tests; production recovery must keep running.

Full calculations, alternative scenarios and exclusions are in [LAUNCH_COST_ESTIMATE.md](LAUNCH_COST_ESTIMATE.md). Avoid buying anything merely to complete B1's schema work. Before B3 provider-backed tests, settle A7 capacity/scheduling, Mailjet setup and approved recipients; complete A4/A8 and all signup gates before real onboarding.

## Owner actions and implementation acceptance

| When | Action required from the owner |
| --- | --- |
| A3 / B1 now | No account registration or purchase needed. Sender address and pending Mailjet/mailbox setup are recorded above. |
| Before B3 email integration | Create/authorise the business Mailjet account, complete sender verification and approve test recipients. No AWS signup is needed. Confirm any paid-plan decision only if tested limits require it. |
| A4 / before publishing support contact | Choose/activate the receiving mailbox or explicitly nominate a forwarding destination. Confirm who monitors `support@mywaveplan.com`. |
| A7 / before minute jobs | Approve the concrete Vercel/Neon plan and spending controls if the existing entitlement cannot support the tested requirements. No blanket provider account reconnection. |
| Before real registration | Confirm reviewed policies, sender approval, delivery/limit/support tests and the rehearsed EU migration. |

A6/B3/B9 acceptance must cover transaction rollback, concurrent claims, worker termination, stale leases, provider timeouts before/after acceptance, duplicate/out-of-order/forged events, exhausted quota, invalid recipients, old/superseded tokens, scanner GETs, recovery races, account deletion, MFA recovery and lost keys. Test staging isolation and the entire existing login/forecast/nearest-spot journey before production. Verify email readability on mobile and desktop and delivery to the owner-approved inboxes, with no tracking in the received message. Test actual incoming support replies separately.

A3 verification is limited to source/code review, cost arithmetic, document consistency and local links. There is no runtime release to test today. **Next: B1's additive membership migration**, starting with branch-capacity checks, identity/ownership reconciliation and a reversible rehearsal. B2 changes live authorisation afterwards; B3 supplies registration and email through this decision.
