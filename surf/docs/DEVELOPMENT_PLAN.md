# MyWavePlan development plan

Reviewed and rewritten: 7 September 2026.

Status: proposed roadmap saved for discussion and implementation planning. The owner requested this review, not implementation or deployment of the new features. Prices, policies and provider choices below are recommendations, not live configuration or approved expenditure.

The previous plan is preserved unchanged in [the September archive](DEVELOPMENT_PLAN_ARCHIVE_2026-09-07.md); the [June archive](DEVELOPMENT_PLAN_ARCHIVE_2026-06.md) retains older detail. Release evidence belongs in [handover](HANDOVER.md) and dated release notes. This plan describes future work rather than repeating the release history.

## Recommendation

Build a complete self-service journey next: someone discovers conditions, finds a suitable lesson, creates an account and books; a school creates its workspace, invites instructors and publishes lessons without platform-admin help.

Start with secure accounts and school permissions, then make that journey work. Introduce school subscriptions after schools can reach this useful outcome. Add online lesson payments next, then lesson packages. Keep the current forecast free for surfers while testing whether it brings schools bookings.

The forecasts and visual direction are now a product baseline the owner is happy with. Preserve them. The next work should improve the service around them, not start another visual redesign.

## Baseline and gaps

Current application revision on staging and production: `aa695a964c362e53712a5990a305ee2174e6d818`, the 7 September revocable-session release. Staging passed before the owner-authorised production deployment; both environments passed API and desktop/mobile checks. Expiry/cookie hardening was released earlier as `729489e`. The accepted forecast model and design are preserved. See [session revocation release](RELEASE_2026-09-07_SESSION_REVOCATION.md).

| Area | Current position from code and project documentation | Implication |
| --- | --- | --- |
| Forecasts | 17 seeded spots, 16 days, generic versioned database calibration, tides/daylight, swell components, energy/power, water temperature, experience levels and lesson conditions | Maintain accuracy and freshness; use this as the acquisition entry point |
| Design | Task-oriented screens, mobile layouts, quality colours, device/light/dark appearance and nearest-spot selection | Reuse existing components and visual language |
| Identity | One primary school and one role on a user; admin-created accounts | A surfer cannot yet use one independent account naturally across schools |
| Sessions | Seven-day database-backed sessions, hashed tokens, secure cookies, current account/role/school checks and single/global logout are deployed | Complete abuse, CSRF and tenant/privacy controls before self-registration |
| Booking | Capacity checks and SQL locking exist; cross-school student booking is constrained by the current identity model | Prove concurrency and privacy, then support discovery-to-booking across schools |
| Commerce | No implemented plan, subscription, payment or package-credit domain | Establish a common model before adding payment buttons |
| Privacy | Legal page currently covers data licences; no complete consent, privacy-notice or erasure workflow | Build privacy controls alongside onboarding |
| Media and measurement | Photo URL fields exist; no managed upload lifecycle or GA4/GTM consent implementation found | Add object storage and consent-first measurement |

Code reviewed: [authentication](../lib/auth.js), [user creation](../pages/api/users/index.js), [booking](../pages/api/lessons/[id]/book.js), [schema](../db/schema.sql), package versions and public/legal routes. This is a planning review, not a completed security audit.

## Proposed commercial model

Charge schools first. A useful free surfer product can bring repeat use and bookings. Restricting the existing forecast now would make that growth loop harder to establish before we know what users value.

| Audience / offer | Recommended initial access | Revenue proposal |
| --- | --- | --- |
| Surfer | Current 16-day forecast and all current parameters; find/book lessons, manage own bookings and profile | Free; lesson charges remain separate |
| Instructor | Own profile, school invitations and assigned lessons/attendance | Free personal account; management capabilities depend on the school's plan |
| School listing | Public profile, spot information and enquiry link; ability to start a trial | Free; no permanent free management tier initially |
| School trial | 30 days of shipped management features, starting when the owner activates the workspace | No card required; one trial per genuine school |
| School paid plan | Lesson, instructor and booking management, public bookable schedule and operational reporting; payments/packages when released | Test **€39 per school per month**; confirm VAT presentation before publication |
| Optional Surfer Plus, later | Alerts, saved preferences, favourites across devices, spot comparisons and planning tools | Test willingness to pay first; **€3.99/month** is an experiment candidate, not a launch commitment |

These prices are hypotheses, not researched market benchmarks. Validate the offer through 5–10 school conversations and a pilot of 3–5 schools. Compare willingness to pay, time saved, booking volume and cost to serve before fixing prices or annual contracts.

Do not charge separately for instructors at launch. Avoid per-student charges and many tiers until schools demonstrate a need. Keep forecast safety information and required experience available to everyone. Paid access must not imply greater forecast certainty when it uses the same model and data.

At trial expiry/downgrade, stop new paid-plan activity but preserve existing bookings, lesson fulfilment, cancellation/refund tools, required records and export. Never cancel a student's lesson because the school's subscription expires. Agree the grace period before billing goes live.

Initially propose **no additional MyWavePlan percentage on lesson sales**, with processor costs clearly assigned and disclosed. Revisit this after measuring support, payment and acquisition costs. A booking fee or Growth plan needs a separate decision. Do not advertise unimplemented features as part of a paid plan.

## Delivery order

Each phase consists of small staging releases. Payment design can be written early; live payments depend on reliable accounts and booking. Effort estimates should follow the identity and payment design decisions, not precede them.

### Phase 0: secure the foundation and define launch responsibilities

Outcome: existing users and schools can safely support self-service flows.

- [x] Released to staging and production: require a production signing secret of at least 32 bytes, remove the production development-secret fallback, use Secure/HttpOnly cookies, enforce seven-day expiry and reject malformed/tampered cookies. Release `729489e`; staging verified, then production explicitly approved and verified.
- [x] Add revocable sessions and current server-side account/role/school checks. Deployed and verified on staging and production: single/global logout, password/status invalidation, disabled/deleted-account rejection and live single-school permissions. Multi-school membership remains in Phase 1.
- [ ] Add login/recovery rate limiting, safe errors, enumeration protection and CSRF/origin protection for mutations. Require platform-admin MFA before commercial operation; assess the authentication implementation and migration first.
- [ ] Audit tenant boundaries, instructor/student privacy and public playground routes. Remove `/test/*` production routes. Isolate the shared demo from real customer bookings, payments and private data.
- [ ] Review Next.js 14.2.3 and dependencies against supported security releases; plan a tested upgrade without making a router rewrite a prerequisite.
- [ ] Confirm operator/contact details, controller/processor responsibilities, hosting regions, subprocessors and contracts. Review retention, minors, consumer terms, VAT and invoicing with Portuguese legal/accounting support.
- [ ] Verify commercial rights and costs for all forecast/tide/weather sources, including attribution and caching. Open-Meteo's free hosted API is restricted to non-commercial use; confirm the appropriate service before commercial launch. Budget weighted API usage, not just HTTP request count. [Open-Meteo pricing](https://open-meteo.com/en/pricing)
- [ ] Establish backups/restore checks, redacted monitoring and an incident/support process. Use synthetic/anonymised staging data; do not routinely copy production personal data there.

Done when: expired/revoked/deleted-user sessions are rejected; cross-school access tests pass; production rejects the development secret; demo access cannot reach real customer data; restore and upgrade checks pass; legal/licensing launch gates have a named owner.

### Phase 1: self-service accounts, onboarding and privacy controls

Depends on Phase 0 session and tenant controls. This is the first substantial product release to build next.

- [ ] Introduce global user identity plus `user_school_roles` memberships. One user can be a surfer and coach and work with several schools. Keep platform-admin authority separate.
- [ ] Migrate users, student/coach records and memberships without losing IDs, lessons or booking history. Link coach records to users. Do not merge people by matching names or silently claim an existing school.
- [ ] Build verified-email sign-up, password recovery, profile editing and invitation acceptance. Logout everywhere is already available in My profile. Keep telephone optional and existing username login working.
- [ ] Let a new school owner create a draft workspace, set timezone/spots/contact details, invite staff and publish a first lesson through a short checklist. Verify ownership before claiming an existing listing.
- [ ] Let instructors self-register and request/accept affiliation. Choosing “instructor” must not grant access to a school's records. A solo instructor can operate as a school business after the same verification.
- [ ] Let surfers register independently. Proposed change to the older plan: a verified user may book an eligible public lesson without prior school-admin approval; staff membership still requires approval. Create a school customer/student link when needed; retain invitation-only lessons where configured.
- [ ] Publish reviewed privacy/terms documents and record versioned acceptance/notice delivery. Add optional marketing consent, history and withdrawal; implement cookie choice before enabling analytics.
- [ ] Add photo uploads to object storage, data export and account deletion. Transfer school ownership or close the school properly before deleting its sole owner.
- [ ] Set the initial age policy: adult self-registration; guardian-managed children only after the required booking, consent and safeguarding flow exists. Do not silently allow unrestricted child accounts.

Done when: a surfer, instructor and school owner can each onboard without platform-admin help; recovery works; one user accesses two authorised schools and no others; invitation abuse tests pass; existing accounts/bookings survive migration; photo/deletion flows work on mobile and desktop; refusing optional consent does not block registration.

### Phase 2: forecast-to-lesson discovery and reliable booking

Depends on Phase 1 identity; public discovery design can start earlier.

- [ ] Add “Find a lesson” from the chosen spot/day/time. Preserve this context through search and registration. Keep Conditions first/default unless an explicit deep link requests another task.
- [ ] Make forecasts, public school profiles and lesson browsing available without login, with shareable spot/day links. Ask for an account when booking or saving personal preferences. Apply the licensing, caching, rate and cost controls from Phase 0 before public access.
- [ ] Show skill level, lesson conditions, school/instructor, total price, capacity, duration, meeting point and cancellation terms. Search by spot/date/level; show useful alternatives when no lesson exists.
- [ ] Build a public school page and bookable schedule. Add attendance and assigned-instructor access. Support transactional confirmations, cancellations, weather rescheduling and calendar links.
- [ ] Prove capacity and duplicate-booking behaviour under concurrent requests. Add idempotent reservations and explicit booking/attendance states before paid checkout.
- [ ] Define customer cancellation, school cancellation, weather and minimum-attendance policies. Keep an audit trail; forecast scores must not automatically certify a lesson as safe.
- [ ] Add consent-controlled GA4/GTM and the event contract in the architecture note. Set up Search Console, public sitemap/canonical URLs and indexing protection for private/staging content.

Done when: a new surfer moves from a forecast to a confirmed lesson across school boundaries; concurrency cannot oversell or duplicate confirmation; each role sees only appropriate information; denying consent sends no analytics traffic; mobile search, booking and no-results paths work.

The initial pilot may use clearly disclosed pay-at-school lessons. Do not present these as paid online. Gather activation evidence before charging subscriptions.

### Phase 3: configurable plans and school subscriptions

Depends on usable school onboarding and booking. Establish the entitlement schema earlier where needed; build the full pricing console here.

- [ ] Add versioned plans/prices, trial policies, feature flags and usage limits for school or personal billing accounts. Separate role permissions from paid entitlements and enforce both through APIs.
- [ ] Build platform-admin-only plan draft/publish/archive screens: typed values, currencies, intervals, effective dates, change previews, grandfathering/migration policy and audited overrides. Do not change existing prices silently.
- [ ] Integrate Stripe Billing and hosted Checkout/customer portal for MyWavePlan subscriptions. Show plan, renewal, invoices, cancellation and payment-recovery state in School settings.
- [ ] Persist subscription state from verified events and reconcile it. Define trial expiry, grace, failed payment, period-end cancellation, downgrade and restoration.
- [ ] Explain reached limits and the exact upgrade price without blocking existing student commitments or privacy/account rights.

Done when: an admin publishes a plan without a code change; API calls cannot bypass limits; a school can trial, subscribe, recover payment and cancel; duplicate/out-of-order events cannot corrupt access; price changes have explicit customer impact; legal/invoicing gates pass before live charging.

### Phase 4: online payments for individual lessons

Depends on reliable booking and a confirmed merchant/payment architecture. This is separate from charging schools for software.

- [ ] Use Stripe Connect to onboard schools for lesson payments. Proposed model: the school sells/supplies the lesson; MyWavePlan sells software. Confirm merchant, dispute, refund, tax and negative-balance responsibilities before choosing charge/account configuration.
- [ ] Add a school product catalogue with single lessons first: currency, price/tax treatment, eligibility and cancellation policy. Snapshot purchased terms and price on each order.
- [ ] Implement seat holds, expiry and atomic booking confirmation after trusted payment confirmation. Handle abandoned checkout, delayed payment and payment arriving after the hold expires.
- [ ] Add receipts/invoice references, partial/full refunds, school cancellation, disputes, payout status and support tools. Keep booking status separate from payment status; do not store card details.
- [ ] Reconcile transactions, orders and refunds. Test connected-account isolation and webhook retries/signatures. Start with supported card methods; add local methods after handling their asynchronous behaviour.

Done when: sandbox purchase/refund/dispute scenarios pass; competing checkouts cannot oversell; a charged student has a confirmed booking or a defined recovery/refund path; money and receipts belong to the right school; the owner approves a controlled live-money pilot and its limits.

### Phase 5: packages and school operations

Depends on settled single-lesson payment behaviour.

- [ ] Let schools configure products such as 1 lesson or 5 lessons, with their own price, eligible lesson types, validity and terms. Changes create new product versions.
- [ ] Add a school-scoped credit ledger for purchase, reservation, use, release, expiry and refund. Show balance/history to both surfer and school. Prevent duplicate/concurrent spending.
- [ ] Agree unused/part-used refund and weather-reschedule rules before sale. No cross-school wallet, transferable money balance or stored payment value initially.
- [ ] Add waitlists, reminders, recurring lesson creation and occupancy/revenue reporting according to pilot demand. Separate lesson sales, platform revenue and outstanding package credits.

Done when: package purchase/use works across eligible lessons; cancellation restores the right credit; concurrent redemption and partial-refund tests pass; every balance is explainable from its ledger.

### Phase 6: feedback, retention and measured expansion

- [ ] Collect post-lesson feedback on the lesson, school and instructor only from verified attendees. Start privately; introduce public reviews after moderation, reporting, reply and dispute processes work.
- [ ] Consider rankings only with enough verified feedback. School ranking requires school-admin opt-in; each instructor separately opts in personally. Defaults are off and withdrawal is available. School approval cannot override a person's choice; review employment-related consent validity.
- [ ] Publish ranking criteria, minimum sample and freshness rules. Prevent review manipulation, paid placement in organic rankings and unsafe incentives. Leaderboards are not a launch requirement.
- [ ] Test Surfer Plus after repeat free use and willingness to pay are demonstrated. Use the same entitlement engine for personal plans if justified.
- [ ] Add Portuguese alongside English, then regions/currencies according to demand. Keep timezone, spot models, tide provenance and currency explicit.
- [ ] Capture structured observations of actual surf conditions with calibration-version provenance. Validate changes across dates/spots before release.

Done when: reviews require completed attendance; visibility/withdrawal and moderation work; paid/geographic expansion has evidence of demand and an understood operating cost.

## Architecture and privacy direction

The [Commercial and privacy architecture](COMMERCIAL_AND_PRIVACY_ARCHITECTURE.md) contains the proposed schema, payment flows, consent records, retention controls and event contract. It is a design proposal, not a migration ready to apply.

Keep one application with clear identity, booking, billing, catalogue, media and privacy modules. No microservice rewrite is needed. Use Neon for relational records/metadata, object storage for images and Stripe for payment collection. Enforce permissions and entitlements on the server.

Use Stripe Billing for platform subscriptions and Connect for school lesson payments. Charge type affects fund flows and dispute/refund liability, so choose it explicitly. Prices and limits belong in database configuration; feature definitions, supported operations and validation remain in code. New amounts require new Stripe Price objects. [Stripe charge types](https://docs.stripe.com/connect/charges), [Stripe price management](https://docs.stripe.com/products-prices/manage-prices)

Proposed operator identity, supplied by the owner: **PAWEL PAPLINSKI, tax number PT311219217**. Confirm legal form, address, privacy contact and VAT/invoicing treatment before publishing documents. This information alone does not establish compliance.

Document purposes and lawful bases per processing activity. Terms acceptance and privacy-notice acknowledgement are separate from consent. Core account/booking processing should use the appropriate contractual or other justified basis; optional analytics, marketing and public visibility need separate controls. Consent must be freely given, specific, informed and withdrawable. [EDPB guidance](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en)

Use consent-first analytics: no GTM/GA requests before opt-in, equally accessible accept/reject controls and a persistent settings link. Start with basic Consent Mode and advertising disabled. The CNPD identifies analytics cookies as requiring consent; a banner/Consent Mode is only one part of compliance. [CNPD guidance](https://www.cnpd.pt/media/x2zdus50/nota-informativa-cnpd_cookies_20210625.pdf), [Google consent modes](https://developers.google.com/tag-platform/security/concepts/consent-mode)

Deletion, withdrawal, export and retention are Phase 1 requirements. Financial/legal retention exceptions need documented purposes and restricted access. Publish the reviewed storage policy/subprocessor list and make deletion propagate to images, caches and restore procedures.

## The next implementation brief

**Next bounded task: protect login and state-changing requests.** Session expiry and revocation are complete. Add shared server-side login rate limiting, consistent safe errors and protection against account enumeration; apply CSRF/origin checks to all authenticated mutations. Keep the existing username login and test account working. Test denied requests, recovery after rate limits and authorised desktop/mobile flows on staging before production.

Then:

1. Audit tenant boundaries and instructor/student privacy, remove production playground routes and isolate the shared demo. Review supported Next.js/dependency security upgrades.
2. Write the authentication/identity decision and permission matrix; rehearse an additive migration to global users and multi-school memberships, preserving student/coach links.
3. Add independent surfer sign-up, email verification and password recovery.
4. Add school creation and staff invitations, with safe claiming of existing records.
5. Add privacy/terms version records and separate optional choices; media and deletion follow within the same onboarding phase.

Acceptance scenario: an existing school retains lessons/bookings; a new person verifies their address and joins the authorised role through invitation; one account can use two authorised schools and no others; revocation takes effect immediately; refusing optional consent still allows account use. Next, connect this account to forecast-led discovery and booking.

Decisions to resolve before the relevant launch: legal contacts/policies; authentication/email provider; adult/guardian scope; trial/grace and final price; merchant/Connect liability; VAT/invoicing provider; commercial forecast licence/budget; media retention/provider. None prevents saving/reviewing this roadmap.

## Validation, rollout and measures

- Rehearse additive migrations with representative anonymised data, reconcile records/links and document rollback. Never copy a full staging database over production to release a feature.
- Test permissions, state transitions, concurrency and money; reuse forecast regressions. Review complete desktop/mobile journeys, dark/light modes, keyboard access and errors. Include a physical iPhone check before broad onboarding release where available.
- Use separate staging payment credentials, webhooks and media storage; keep demo/test transactions out of live financial and product metrics.
- Standing workflow: deploy to staging, verify, tell the owner it is ready and wait for approval before production. Explicit authorisation for both environments applies only to that change. After production, test and update handover, release notes and this plan.
- Pilot before scaling acquisition. Measure first lesson published, first confirmed/attended booking, repeat bookings, trial-to-paid conversion, active paying schools, cancellation/refund rate and cost per active school. Establish baselines before targets; show consented analytics coverage rather than treating it as all users.
- Maintain forecast freshness/error rate, capacity errors, reconciliation exceptions and support response time. Reassess after the onboarding/booking pilot and first billing cycle, not arbitrary calendar dates.

## Deferred deliberately

Native mobile apps, a cross-school wallet, automatic forecast-based lesson cancellation, paid rankings, a large tariff matrix and broad marketplace expansion are not prerequisites. The current home-screen experience is sufficient for the next stages. Revisit these only when user evidence justifies the operating cost.
