# Commercial and privacy architecture proposal

7 September 2026; expansion boundaries added 9 September. Supporting design for the [development plan](DEVELOPMENT_PLAN.md).

Status: the identity/membership design was accepted on 8 September; A3’s authentication/email/jobs direction was documented on 9 September. Commercial/policy choices and provider activation remain pending. Names describe intended domains, not existing tables or final migrations. Confirm provider choices, policies and responsibilities before implementation. This document is neither a published privacy notice nor confirmation of legal compliance.

## 1. Identity, permissions and commercial access

The [accepted registration and membership design](REGISTRATION_AND_MEMBERSHIP_PROPOSAL.md), dated 8 September, provides the detailed target model, invitation/ownership rules, permission matrix and migration path. The [implementation roadmap](IMPLEMENTATION_ROADMAP.md) records delivery, dependencies and launch gates. Its membership and role tables replace the earlier `user_school_roles` shorthand. School drafts precede checkout; subscriptions unlock school features and do not grant staff roles.

The [A3 decision](AUTH_EMAIL_AND_JOBS_DECISION.md) retains current authentication, with lifecycle/password hardening and MFA still to implement. It selects Mailjet Free for initial outgoing transactional email and a Neon outbox with a Vercel minute worker. The owner-selected support address needs a receiving mailbox. A4/A8 must review processor agreements, regional data coverage and retention before activation. The Mailjet production domain is now validated with SPF/DKIM passing; mailbox setup, app delivery integration and tests remain pending. See the current [email setup record](AUTH_EMAIL_AND_JOBS_DECISION.md#confirmed-service-setup-10-september-2026).

Keep a global user separate from school membership and billing. An existing user may surf at several schools, coach at one and administer another. A school customer/student record must not automatically grant staff access.

| Domain | Proposed records and important fields |
| --- | --- |
| Identity | `users`; revocable `sessions`; hashed verification/recovery tokens with expiry and single use |
| School membership | `school_memberships(user_id, school_id, status)` plus `membership_roles(membership_id, role)`; independent administrator/instructor roles, separate owner reference and expiring invitations |
| Platform authority | Separate platform-admin assignment; no public sign-up path can set it |
| Student/coach linkage | School-scoped student and coach records linked to global users; explicit invitation/verified linking of existing records |
| Billing owner | `billing_accounts(id, school_id, user_id, provider_customer_id)`; exactly one owner scope, school or user |
| Plan catalogue | `plans`, immutable `plan_versions`, `plan_prices`; audience, currency, interval, amount in minor units, tax behaviour, effective dates and status |
| Entitlements | `feature_definitions`, `plan_entitlements`, timed `entitlement_overrides`, `usage_counters`; typed values, unit, scope and reset period |
| Subscription | `subscriptions`; billing account, plan/price version, provider IDs, status, trial/end dates and reconciliation time |
| Audit | Actor, action, object/version, previous/new values, timestamp and reason; redact credentials and personal content |

Access requires all relevant conditions: authenticated identity, authorised school/record scope, role permission, commercial entitlement and resource state. Hiding a button is not enforcement. Platform-admin permission to edit calibration remains independent of a subscription.

Examples of registered feature keys: `lessons.publish` (boolean), `staff.active_limit` (non-negative integer or explicit unlimited), `media.storage_bytes` (quota), `reports.advanced` (boolean), `forecast.alerts` (boolean). Feature keys and their enforcement live in code; approved values and assignments live in the database. Do not put executable expressions or arbitrary SQL in plan configuration.

All unlimited values must be explicit, never inferred from a missing key. Unknown keys/invalid types fail validation. Count quota use in the relevant transaction, including concurrent creation. Reads of existing commitments, refunds, billing cancellation, export and deletion remain available when an account is over a limit or its trial has ended.

The admin console must preview customer impact, distinguish a draft from a published plan and log changes. Updating a price produces a new application price version and provider Price ID; existing customers stay on their recorded price unless an explicit migration policy applies. Stripe price amounts cannot be edited in place. [Stripe price management](https://docs.stripe.com/products-prices/manage-prices)

Use the application catalogue as the plan-authoring source and map it to Stripe. Reconcile external billing changes; do not create two independently editable catalogues with conflicting authority. Cache entitlement decisions briefly and invalidate on membership/subscription changes. Fail closed for new paid operations when required state is unavailable, while retaining access to existing commitments.

## 2. Two payment flows

### Platform subscription

School → Stripe Billing/Checkout → MyWavePlan's platform account.

The school purchases software access. MyWavePlan is responsible for its own subscription offer, cancellation, billing support and applicable tax/invoicing. `billing_accounts` map schools to platform Stripe Customers. The application derives effective access from recorded subscription state and agreed grace policies.

Use verified subscription/payment events and reconciliation to maintain state. Do not grant paid access just because the browser returns to a success URL. Cancellation normally ends access at the recorded paid-period end; any immediate cancellation/refund option follows published policy. [Stripe subscription events](https://docs.stripe.com/billing/subscriptions/webhooks)

### Lesson sale

Surfer → school-connected checkout → the school's connected payment account.

Recommended starting model: the school is the lesson merchant; MyWavePlan supplies booking software. Evaluate **direct charges** under Stripe Connect for that model. The exact account/controller configuration determines onboarding, fees, account access and liability. Current Stripe guidance cautions against direct charges with legacy Express/Custom account configurations; do not select these from an old integration example. Compare the current supported configuration with destination charges before recording the decision. Direct charges do not justify a blanket claim that MyWavePlan has no liability. [Stripe charge types](https://docs.stripe.com/connect/charges)

Use Stripe-hosted onboarding so bank and identity verification documents are not copied into Neon. Record `school_payment_accounts(school_id, provider_account_id, onboarding_status, charges_enabled, payouts_enabled, requirements_status)`. Check capability changes and restrictions, not only onboarding completion. Only the authorised school owner can change payout configuration through the provider's secure flow.

Customers/payment objects created within connected accounts must be scoped by that account. Never reuse a platform subscription Customer ID as if it belonged to a school account. Store provider account ID alongside payment object IDs and verify school mapping for every event.

Confirm with legal/accounting support: merchant identity shown to students, contractual responsibilities, refunds/disputes, negative balances, payout timing, tax collection and invoices. An automatically generated payment receipt must not be assumed sufficient for Portuguese fiscal invoicing.

Current indicative standard EEA card processing is 1.5% + €0.25: about €0.85 on a €40 payment. This is not an all-in estimate; Billing/Connect, other cards/currencies, refunds/disputes and tax services can add costs. Verify the selected configuration's actual fees before setting margins or advertising prices. [Stripe Portugal pricing](https://stripe.com/en-pt/pricing)

## 3. Orders, reservations and package credits

| Record | Responsibility |
| --- | --- |
| `school_products` / `school_product_versions` | Single lesson/package, school, currency, tax treatment, price, eligibility, credit quantity, validity and cancellation terms |
| `orders` / `order_items` | Immutable purchased price/terms snapshot; purchaser, school, currency and totals |
| `booking_holds` | Lesson, seat count, owner, expiry, checkout reference and state |
| `payments` / `refunds` | Provider account/object IDs, amount, currency, state and reconciliation timestamps |
| `payment_events` | Unique provider/account/event ID, processing outcome and retry metadata; retain only needed payload fields |
| `package_accounts` / `package_ledger` | Owner and school scope; signed credit entries with reason, booking/order reference, idempotency key and expiry |
| `booking_events` / attendance | Changes to booking and attendance, independently of financial state |

Recommended state separation:

- Booking: held, confirmed, cancelled, expired. Attendance: pending, attended, no-show.
- Payment: pending, requires action, processing, succeeded, failed; refunds/disputes recorded separately so a partially refunded success remains understandable.
- Subscription: provider lifecycle plus the application's explicit trial/grace/access policy.
- Package: purchased credits, reserved credits, redeemed credits, released/expired/refunded credits, derived from the ledger.

The server recalculates order totals from the selected product version. Never trust a client amount or school ID. Reserve capacity transactionally before opening checkout, expire holds reliably, and atomically consume a valid hold on payment success. On late payment, either reacquire capacity safely or follow a documented recovery/refund path; do not silently oversell. Persist a uniquely keyed confirmation job with the business transaction. Delivery follows A3’s retry and uncertain-send policy; exactly-once email delivery is not guaranteed.

Verify webhook signatures against the raw body, deduplicate event IDs, handle retries and retrieve authoritative provider state when necessary. Stripe does not guarantee event order, so timestamp comparisons alone are not a reliable processing strategy. A scheduled reconciliation job should detect missing events and unmatched money. [Stripe webhook guidance](https://docs.stripe.com/webhooks)

Version cancellation/refund rules and snapshot them on purchase. Distinguish student cancellation, school/weather cancellation, no-show and rescheduling. Define who can approve a refund and log it. Changing a product or policy must not rewrite historical orders.

Packages are rights to lessons at one school, not a platform currency. Reserve a credit when booking; release or consume it according to the agreed cancellation/attendance policy. Decide before sale whether expiry is based on booking date or lesson date, whether a package can be extended and how partial use affects refunds. Do not debit again on repeated webhook/booking requests. Keep purchased credits usable if the school downgrades its software plan, subject to the underlying lesson agreement.

## 4. Privacy, consent and account lifecycle

Operator details supplied by the owner: **PAWEL PAPLINSKI; tax number PT311219217**. Registered self-employed activity in Portugal was confirmed by the owner on 10 September. On 12 September the owner supplied the correspondence address, retained in the local private privacy draft, and selected **support@mywaveplan.com** for support/privacy requests. The mailbox must be active before publication. Registration/VAT evidence and fiscal duties remain to review; do not describe MyWavePlan as a separate incorporated company.

A4 preparation now has a [personal-data specification and live inventory](PRIVACY_DATA_INVENTORY.md), [unpublished document drafts](PRIVACY_DOCUMENT_DRAFTS.md) and [completed EU migration and recovery](EU_DATA_MIGRATION_PLAN.md). These own the current detailed findings and open review points. The owner confirmed an adult-only initial pilot and requested [guardian bookings and optional later 16–17 accounts](CHILDREN_AND_GUARDIAN_BOOKINGS.md) in F11. No new data fields, policies or registration flows were deployed by this audit.

A natural person can be a controller under GDPR Article 4(7); incorporation is not a prerequisite. If the activity is in the owner's own name, identify Pawel Paplinski, operating MyWavePlan, for the processing whose purposes and means he determines. Business registration does not establish GDPR compliance or make him controller for every school processing activity. Map actual roles per purpose: platform account/security processing may be under the operator's control, while some school records may be processed on a school's instructions. Resolve independent or joint control where applicable instead of applying a blanket label. [GDPR, Articles 4, 13, 26 and 28](https://eur-lex.europa.eu/eli/reg/2016/679/oj), [EDPB controller/processor guidance](https://www.edpb.europa.eu/system/files/2023-10/edpb_guidelines_202007_controllerprocessor_final_pt.pdf).

### A4/B6 documentation and implementation scope

This is a planned deliverable set, not a published legal notice or a completed compliance review. Retain the existing task IDs and launch gates.

| Deliverable | Roadmap / affected layers | Acceptance |
| --- | --- | --- |
| Internal processing inventory and retention schedule | A4, with A8 location evidence; documents/Ops | For each purpose record data categories, people affected, lawful basis, controller/processor role, recipients, storage/processing locations and transfers, retention trigger/period, deletion method and responsible owner. Cover backups, logs, email, browser location and future media. Confirm Article 30 record-keeping applicability; maintain the inventory regardless. Do not invent statutory retention periods. |
| Public privacy notice and operator information | A4 drafts/review; B6 FE | Identify the verified operator and contact route. Explain processing, recipients/transfers, retention, rights, how to request them and the right to complain to CNPD. Include Article 13/14 information as applicable. Make reviewed documents accessible before login and link them from registration and account/privacy areas; publish only descriptions supported by actual system behaviour. |
| Platform terms, school data-processing agreement and processor register | A4 review; B6/B4/B5 FE, BE, DB where acceptance is needed | Define platform/school responsibilities and Article 28 terms where the platform acts as processor. Record provider agreements/subprocessors, instructions, security, assistance, incident reporting, return/deletion and any transfer safeguards. Record the authorised school representative and exact accepted agreement version. Assess Article 26 arrangements only where joint control actually applies. |
| Document versions and optional preferences | B6 with B3, C5 and B10; FE, BE, DB | Keep version, language, effective date and minimal acceptance/notice-delivery evidence. Terms acceptance is separate from privacy-notice delivery and optional consent. No blanket required consent to all processing. Support withdrawal of optional choices and reviewed translations. C5 supplies the cookie notice/banner before optional tracking is enabled. |
| Procedures backed by working controls | B8, A6 and A8; FE, BE, DB, Ops | Implement identity-checked rights requests, export/correction/erasure, justified retention exceptions and school-role-aware handling. Apply retention/deletion to live data and restored backups, verify provider-copy expiry, and document incident handling. A legal document alone does not fulfil these controls. |

A4 first establishes verified facts and produces drafts for review. B6 publishes the reviewed versions and implements evidence/preferences; B3 must not open real registration until its existing privacy, EU and email gates pass. The owner must confirm missing business/contact facts; this planning update neither changes runtime data nor authorises publication of unfinished legal documents.

Create a processing inventory: purpose, fields, lawful basis, controller/processor role, recipients, retention, location, access and deletion mechanism. The platform and schools may have different roles for account, teaching, billing and analytics data; document these per purpose and execute the appropriate agreements. EU hosting alone does not settle international-transfer questions.

The owner's 9 September preference is EU storage for the Portuguese launch. A8 chooses the exact region before provisioning and completes the rehearsed move before real registration/onboarding. Extend the inventory to backups, exports, media/derivatives, logs and each provider's storage, processing and support access. Record any non-EU transfer and its safeguards; publish the actual arrangement, not an unverified blanket EU-only claim. See the [region and migration plan](INFRASTRUCTURE_CAPACITY_AND_UPGRADES.md#region-and-environment-decision) and [European Commission transfer guidance](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/rules-international-data-transfers_en).

### Language and locale preferences

Roadmap A9 establishes translation catalogues, a locale resolver and a language switcher; B10 delivers English, European Portuguese (`pt-PT`) and Spanish before the pilot, with optional French. A nullable global user `preferred_locale` and a minimal device preference are independent of school membership, location and analytics consent. Explicit selection takes priority over browser inference; preserve it through login, registration, invitation/recovery links and transactional emails. The initial browser match falls back to English. Resolve account/device conflicts explicitly, preserving saved choices.

Translate UI messages, forecast/skill labels, API error presentation, emails and reviewed published policy documents. Store locale-independent codes and numeric values; translate their presentation through shared catalogues. Keep exact document language/version acceptance evidence and do not silently substitute an unreviewed legal translation. Switching language does not change the school/spot timezone, price currency, teaching language, booking eligibility or underlying forecast. School-authored descriptions and proper spot names remain unchanged unless separate translations exist. Adding another interface language does not activate another country or payment market. Later billing, consent-banner and expansion features must support every enabled language.

### Separate records for separate choices

| Record / control | Proposed content |
| --- | --- |
| `legal_document_versions` | Document type, language, immutable text/hash, publication/effective dates |
| `user_legal_acceptances` | User, document version, acceptance/delivery type, timestamp and source |
| `consent_events` | Subject or browser reference, purpose, grant/deny/withdraw, notice version, timestamp, source and minimal evidence |
| `privacy_preferences` | Current derived preference; retain change history without storing unnecessary fingerprint/IP data |
| `visibility_preferences` | School/person, public profile/review/ranking purpose, own authorised decision, visibility and withdrawal timestamp |
| `privacy_requests` | Export/erasure request, identity verification, status, deadlines, completion and justified exceptions |

Record mandatory terms acceptance separately from privacy-notice delivery. Do not require a generic “consent to all data processing” checkbox to obtain an account. Optional marketing, analytics and public ranking choices must be separate, default off and withdrawable. A school admin cannot provide an instructor's personal consent; assess whether consent is freely given in an employment relationship. [EDPB lawful-processing guidance](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en)

Publish a reviewed privacy notice, terms, cookie notice, storage/retention policy, subprocessor list and school data-processing terms. Provide a support/privacy route. Review minors/guardian identity and safeguarding before child registration; avoid collecting medical details or children's photos in the initial adult pilot.

### Proposed retention controls

These are engineering targets to validate against contracts and law, not statements of current configuration or statutory retention periods.

| Data | Proposed treatment |
| --- | --- |
| Unverified registrations | Delete after 30 days without verification; verification/reset tokens expire much sooner and are single-use |
| Active profiles and photos | Retain while needed for the service; deletion immediately hides the profile and revokes sessions; queued deletion removes unneeded personal data/media |
| Operational/security logs | Start with a 30-day target; longer retention only for a documented incident or purpose; redact secrets and minimise identifiers |
| GA4 user/event-level data | Start with the shortest suitable configured retention, proposed two months; document aggregate-report behaviour separately. [Google retention settings](https://support.google.com/analytics/answer/7667196?hl=en_SG&ref_topic=9303569) |
| Consent/acceptance evidence | Retain only the minimal evidence for an agreed, documented accountability/claims period; do not keep unlimited raw interaction logs |
| Orders, invoices, refunds and disputes | Retain only the required records for the period confirmed by the accountant/legal adviser; restrict access; erase unrelated profile data |
| Backups and processor copies | Record each actual retention/expiry schedule and deletion capability before publishing the policy; maintain deletion tombstones for any restore |
| Orphaned/replaced uploads | Remove on a scheduled cleanup after a short recovery window; expire temporary uploads automatically |

Deletion must handle outstanding bookings, refunds and school ownership without blocking a valid erasure request indefinitely. Explain any record-specific legal exception; pseudonymisation alone is not erasure. Export must include the user's data without exposing classmates or staff notes they are not entitled to receive. Track GDPR requests against the one-month response requirement and document applicable extensions/exceptions. [GDPR Articles 12, 13 and 17](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)

Test deletion across Neon, object storage, generated public images, caches, email/payment providers and restore procedures. Document what each provider retains independently. Maintain a breach assessment/notification procedure and restrict administrative access to privacy requests.

## 5. Image storage

Store file metadata and ownership in Neon, never image blobs/base64. Proposed `media_assets`: owner user/school, private object key, purpose, detected content type, byte size, dimensions, status, visibility, created/deleted timestamps. Business records reference the media ID.

Choose an EU-configured object store after checking DPA, access controls, cost and deletion behaviour. Cloudflare R2 with an EU jurisdiction restriction is a candidate. Its location hints are only best effort; jurisdiction restrictions provide the stronger storage-location guarantee. This does not, by itself, establish complete GDPR compliance. [R2 data location](https://developers.cloudflare.com/r2/reference/data-location/)

Use short-lived signed upload/download URLs, server-side ownership checks, upload quotas and size/dimension limits. Decode/re-encode images, strip EXIF/location metadata and reject unsupported/active content. Generate appropriately sized thumbnails; do not serve originals in small cards. Keep originals private. Publish derivatives only for an explicitly public profile and purge them when visibility is withdrawn. Support mobile camera formats through a defined conversion path; test orientation and slow uploads.

## 6. Consent-first measurement and discoverability

Build the consent UI outside GTM so loading it does not depend on a tracking tag. Remember a strictly necessary choice locally and record evidence appropriately. Accept/reject must be equally easy; allow granular settings and later withdrawal. Initially leave advertising disabled.

Choose basic Consent Mode: block GTM/GA requests until analytics opt-in. Do not choose advanced mode's pre-consent cookieless pings for the initial implementation. Withdrawal must stop future collection and remove applicable identifiers; never replay events collected before permission. Test the network/cookie state for first visit, rejection, acceptance, withdrawal, reload and SPA navigation. [Google consent modes](https://developers.google.com/tag-platform/security/concepts/consent-mode)

Create a small, versioned dataLayer contract. Only emit analytics payloads through a consent-gated helper; keep transactional application events separate.

| Event | Trigger and useful non-personal properties |
| --- | --- |
| `forecast_view` / `spot_selected` | Forecast displayed or spot changed; public spot ID, forecast horizon, entry point |
| `lesson_search` / `view_item` | Search submitted / lesson detail shown; public spot ID, result count, public lesson/product ID, entry point |
| `sign_up` | Verified account completed; coarse account journey, authentication method |
| `school_created` / `lesson_published` | New school workspace / first or subsequent published lesson; first-action flag |
| `begin_checkout` | Checkout started; item type, currency and value |
| `booking_confirmed` | Confirmed booking observed; online/pay-at-school/package category, no personal fields |
| `purchase` | A verified successful transaction shown to a consented user; opaque transaction ID, currency, value and item category |
| `subscription_started` | First paid subscription activation observed with consent; plan version and trial-converted flag |

Prevent repeated SPA renders and confirmation-page reloads from double-counting transactions. Use an opaque analytics transaction reference rather than an identifier granting access to an order. Do not sum booking confirmations and purchases as separate revenue. Renewals and all authoritative financial reporting come from the payment ledger; do not bypass declined analytics consent by sending server-side marketing events.

Exclude email, name, telephone, free-text search/comments, precise browser coordinates, reset/invitation tokens and sensitive URL parameters. Start without advertising signals or cross-device User-ID. Sanitise automatic page/location/referrer capture too. Google's PII restrictions do not mean every permitted analytics identifier is outside GDPR. [Google analytics data guidance](https://support.google.com/analytics/answer/6366371?hl=en)

Set up GTM/GA4 properties under the operator's authorised account, with separate staging/test data and controlled publishing access. Define internal/demo traffic exclusion and document event owners. No account connection or provider provisioning is authorised by this planning document.

Use Search Console DNS verification independently of GA4. Publish sitemaps and canonical URLs for public spot/school pages; exclude private routes and keep staging access-controlled/noindex. Public forecast pages can reduce sign-up friction; apply A5's permitted-use/attribution checks and cache/rate protection. L1 activates paid commercial access only before the first publication/test requiring it. Keep full account/booking actions authenticated. [Search Console verification](https://support.google.com/webmasters/answer/9008080?hl=en)

## 7. Decision and verification gates

Commercial-only provider purchases are deferred to roadmap L1 immediately before the first qualifying activity, with enough time for setup and verification. A5 keeps the early terms/attribution/technical compatibility check; A7 handles genuine capacity/security/recovery needs when they arise. Review current deployment and proposed tests against provider terms; free pilots or staging are not automatically exempt. Record each service's trigger, scope, approved budget and activation evidence. Recheck existing coverage for new revenue models rather than purchasing duplicate plans. See [provider timing](INFRASTRUCTURE_CAPACITY_AND_UPGRADES.md#commercial-activation-checkpoint).

The [small-launch budget](LAUNCH_COST_ESTIMATE.md) separates monthly hosting/data/email costs from Stripe processing, Billing and configuration-dependent Connect fees. It does not choose the final merchant model, invoicing integration or tax treatment, and does not authorise purchases.

Before paid activation: agree school price/trial/grace; merchant and Connect configuration; dispute/refund/negative-balance responsibilities; tax/invoices; consumer terms and renewal/cancellation wording; data licence and provider budget. Confirm countries/currencies supported for the first pilot while keeping the schema extensible.

Before public onboarding: verify session and tenant isolation, ownership/invite handling, optional consent, deletion/export, email delivery, demo isolation, media permissions and the age/guardian policy. Existing users must not lose their records or silently gain school access.

Before broader launch: run sandbox failure/concurrency/replay tests; owner-approved controlled live payment/refund checks; mobile/desktop accessibility review; support/reconciliation drills; forecast cost/freshness monitoring. Keep staging and production credentials, webhooks, records and storage separate. Follow the staging-first approval workflow in the development plan.

## 8. Boundaries for later product extensions

The [expansion assessment](PRODUCT_EXPANSION_ASSESSMENT.md) and roadmap F/V/R/M describe conditional follow-up work. They preserve the accepted global-account and school-membership implementation; they do not add a vendor-role migration to the next release.

- Feedback about a provider, instructor assessment of a student and leaderboard participation are separate records and visibility purposes. One global account can author eligible feedback without being staff. School access does not grant cross-school progress-note access or permission to publish someone's rank.
- In-app feedback flows use subject-linked prompt state and server eligibility, with bounded templates/triggers, postponement, dismissal, completion, expiry and frequency limits. Operational deduplication is separate from optional analytics; a prompt view does not prove attendance, grant marketing consent or authorise publishing the response. Reuse completion state before any later cross-channel reminder.
- Forecast archive/evaluation records need immutable issued/valid timestamps, provider/model/calibration provenance and observation quality. Keep large snapshots/media in object storage where appropriate. A historical performance metric is separate from a live forecast score or probability.
- Provider expansion requires a business entity/capability model, with schools as an optional relationship and scoped owner/staff authority. V2 must decide any generalisation/migration before vendor commerce. The initial school/personal billing scope above remains the launch model; non-school business billing needs an explicit extension, not an unrelated user's billing account or a fictitious school.
- Reuse order/payment modules with the actual supplier and category-specific fulfilment/refund rules. Rentals, physical sales, custom work, digital media and key custody cannot be treated as identical lesson bookings. No consumer-to-consumer sales or multi-seller cart is implied.
- Sponsored placements belong to a separate platform-managed campaign domain. Record context, creative, dates and commercial terms; never use payment as a forecast or organic-ranking input. Advertising remains disabled in the initial C6 setup. Any later optional advertising measurement extends the consent/event contract explicitly, with no private booking/progress/GPS data shared with advertisers.
- Mobile clients use the same server permissions, spot calculation and entitlement domains. A native release needs its own secure session lifecycle and store-specific payment classification. Physical service checkout, digital subscriptions/downloads and in-app advertiser purchases require separate review. Cache only deliberately permitted data; do not create offline private-data access merely by adding a service worker.

Each extension must add its retention/deletion/export, moderation/support, consented event and operational monitoring requirements before release. Names in the assessment remain design concepts, not executable schema or approval for provider purchases.
