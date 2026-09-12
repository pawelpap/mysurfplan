# MyWavePlan development plan

12 September maintenance follow-up: the forecast loading crash after browser-style translation has a confirmed reproduction and a rendering fix that preserves the current design. The generic error screen is replaced by a reload action for rendering failures. [Release evidence](archive/releases/RELEASE_2026-09-12_TRANSLATION_STABILITY.md). This does not complete A6 central error reporting or A9/B10 localisation.

Document role: **current product and delivery strategy**. The [implementation roadmap](IMPLEMENTATION_ROADMAP.md) owns task status, estimates and dependencies; the [handover](HANDOVER.md) owns the latest recorded runtime and next action. [Docs index](README.md).

Reviewed and rewritten: 7 September 2026. Implementation status updated: 10 September 2026. Expansion roadmap reviewed: 9 September 2026.

Status: the owner accepted the registration/identity design on 8 September and requested the delivery plan through launch. The [implementation roadmap](IMPLEMENTATION_ROADMAP.md) is now the canonical remaining task list, with stable IDs, S/M/L estimates, FE/BE/DB impact, dependencies, completion evidence and launch gates. The [accepted registration design](REGISTRATION_AND_MEMBERSHIP_PROPOSAL.md) specifies roles and user journeys. Prices, final policy values and provider purchases still require their recorded launch decisions. This update changes documentation only.

The [9 September expansion assessment](PRODUCT_EXPANSION_ASSESSMENT.md) adds student progress/cohort leaderboards, forecast verification, other surf service providers, key-custody partners, sponsorship and a web-to-native mobile path. Existing reviews and school/instructor rankings are refined rather than duplicated. These are conditional extensions, not additional core launch requirements.

Purchase timing updated at the owner's request: commercial-only licences and paid services move to roadmap L1, immediately before the first qualifying commercial launch or test, with time to configure and verify. A5 retains a lightweight permitted-use/attribution check; A7 retains technical capacity and recovery work. This does not declare all free pilots, staging deployments or the current public app exempt from provider terms.

Location and language scope updated 9 September: EU storage is the owner's preferred starting policy for the Portuguese market. A8 finalises the exact region and migration before real self-service onboarding. Localisation moves from later expansion to A9/B10 before G1: an accessible language switcher, English, European Portuguese and Spanish, with French optional. This is a planning update; no data has moved and no language UI has shipped.

The previous plan is retained in [the September archive](archive/plans/DEVELOPMENT_PLAN_ARCHIVE_2026-09-07.md); the [June archive](archive/plans/DEVELOPMENT_PLAN_ARCHIVE_2026-06.md) retains older detail. Their historical content is preserved, with archive notices and maintained links. The [handover](HANDOVER.md) links the latest release; [dated release records](archive/README.md#dated-release-evidence) preserve detailed verification. This plan describes future work rather than repeating the release history.

## Recommendation

Build a complete self-service journey next: someone discovers conditions, finds a suitable lesson, creates an account and books; a school creates its workspace, invites instructors and publishes lessons without platform-admin help.

Start with secure accounts and school permissions, then make that journey work. Introduce school subscriptions after schools can reach this useful outcome. Add online lesson payments next, then lesson packages. Keep the current forecast free for surfers while testing whether it brings schools bookings.

The owner approved F17’s [Conditions Figma proposal](CONDITIONS_UX_FIGMA_REVIEW.md) and approved F18 on staging and production. The [implementation contract](CONDITIONS_UX_IMPLEMENTATION.md) records the final refinements: spot cards for now in daylight or the next sunrise at night, five-minute batched summary caching, smaller mobile carousel cards, stable noon day tiles, linked surf/energy and tide detail charts with one time label, equal parameter weight and full mobile tile information. Production was promoted and verified on 10 September after the owner’s staging review. Forecast calculations and calibrations remain unchanged.

Among the new ideas, prioritise preserving forecast predictions for later evaluation and verified lesson feedback. Improve the installable mobile web experience alongside core delivery when capacity permits. Validate service listings and local sponsorship before committing to broader marketplaces, competitive rankings or store apps.

## Baseline and gaps

Latest fully verified application on staging and production: `7b3046b841e5c32a5f39e0acc9a28b6929a5865a`, promoted as `89652325fc80a7a76813ccdea3e93b7cdbd08f2b` with documentation. F18 completed on 10 September; [production evidence](archive/releases/RELEASE_2026-09-10_CONDITIONS_UX_PRODUCTION.md). The [handover](HANDOVER.md) owns deployment evidence and current limitations. Shared login limits, consistent safe login errors and origin protection for mutations remain deployed and verified. B2 activates global accounts, independent school capabilities and personal bookings/teaching while preserving sessions, forecasts, nearest-spot behaviour and calibrations. See [membership release](archive/releases/RELEASE_2026-09-09_MEMBERSHIP_AUTHORISATION.md), [request-security release](archive/releases/RELEASE_2026-09-08_REQUEST_SECURITY.md) and [session revocation release](archive/releases/RELEASE_2026-09-07_SESSION_REVOCATION.md).

Completed data review and production promotion, 7 September: 16 local spot calibrations revised, Praia da Torre added and generic São Pedro removed. Both environments now have matching spots, configurations and disposable test lesson data. All calibration changes use existing database parameters. Model and live checks passed; the owner approved production after staging review. Exact settings, research and limitations are in [Local spot calibration review](archive/calibration/2026-09-07-local-review/README.md). Continue validating the provisional coefficients against local observations. Surfline session data work is deferred at the owner's request. A1’s tenant/privacy audit and A2’s dependency/security cleanup were completed on 9 September. A3’s [authentication, email and jobs decision](AUTH_EMAIL_AND_JOBS_DECISION.md) is complete as a planning task. B1/B2 are deployed and verified; F17 is approved; F18 is deployed and verified on staging and production. B3 account/email self-service remains pending. The owner’s B2 UI feedback is recorded in [account and lifecycle follow-up](ACCOUNT_AND_LIFECYCLE_UX_FOLLOWUP.md).

| Area | Current position from code and project documentation | Implication |
| --- | --- | --- |
| Forecasts | 17 seeded spots, 16 days, generic versioned database calibration, tides/daylight, swell components, energy/power, water temperature, experience levels and lesson conditions | Maintain accuracy and freshness; use this as the acquisition entry point |
| Design | Task-oriented screens, mobile layouts, quality colours, device/light/dark appearance and nearest-spot selection | Reuse existing components and visual language |
| Identity | Global accounts, independent school memberships/roles, personal bookings and teaching; platform-created accounts | Complete self-registration/invitations and clearer account/membership forms in B3/B4 |
| Sessions | Seven-day database-backed sessions, hashed tokens, secure cookies, current account/role/school checks and single/global logout are deployed | Login abuse and CSRF controls are deployed; A1 school boundaries and response privacy are verified; complete broader privacy/account controls before self-registration |
| Booking | B2 identity-linked personal bookings across existing school contexts, separate staff booking and tested capacity locking | C1–C3 add public discovery and eligible cross-school joining |
| Commerce | No implemented plan, subscription, payment or package-credit domain | Establish a common model before adding payment buttons |
| Privacy | Legal page currently covers data licences; no complete consent, privacy-notice or erasure workflow | Build privacy controls alongside onboarding |
| Media and measurement | Photo URL fields exist; no managed upload lifecycle or GA4/GTM consent implementation found | Add object storage and consent-first measurement |
| Mobile delivery | Standalone manifest, browser/home-screen icons and iPhone metadata exist; no offline/service-worker or push implementation found | Extend the installable web app first; native store delivery is conditional M3/M4 work |

Code reviewed: [authentication](../lib/auth.js), [user creation](../pages/api/users/index.js), [booking](../pages/api/lessons/[id]/book.js), [schema](../db/schema.sql), package versions and public/legal routes. This baseline planning review is supplemented by the completed, bounded [A1 access/privacy audit](ACCESS_CONTROL.md). Broader launch security and privacy work remains in the roadmap.

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

Later revenue options are local sponsored placements and provider services. Test direct sponsorship with a fixed placement fee after actual audience and advertiser demand exist; R1/R2 keep it separate from forecast scores and organic rankings. General ad networks, targeting and an ad-free paid tier are deferred. Provider fees/commissions need their own category economics and payment decision; they are not part of the initial school offer.

Starting operating budget after A3: [€90–120/month before tax and payment fees](LAUNCH_COST_ESTIMATE.md), including both minute workers, outbound email and one support mailbox. About €50 remains a minimal forecast-only scenario if suitable free tiers suffice; it does not cover the new registration service. A7 settles scheduling, database active-time and recovery costs before live jobs. One-time professional work, domain renewal and fiscal invoicing remain outside this estimate. Purchase timing stays L1 for commercial-only costs; required technical upgrades happen earlier when needed.

## Delivery order

Each phase consists of small staging releases. The [implementation roadmap](IMPLEMENTATION_ROADMAP.md) provides the estimated backlog: G1 is a controlled self-service/pay-at-school pilot; G2 adds paid school software; G3 adds online individual lesson payments. Packages, reviews and leaderboards remain listed as subsequent extensions. Payment design can start early; live payments depend on reliable accounts and booking. Re-estimate substantial tasks after the audit/provider decisions.

### Phase 0: secure the foundation and define launch responsibilities

Outcome: existing users and schools can safely support self-service flows.

- [x] Released to staging and production: require a production signing secret of at least 32 bytes, remove the production development-secret fallback, use Secure/HttpOnly cookies, enforce seven-day expiry and reject malformed/tampered cookies. Release `729489e`; staging verified, then production explicitly approved and verified.
- [x] Add revocable sessions and current server-side account/role/school checks. Deployed and verified on staging and production: single/global logout, password/status invalidation, disabled/deleted-account rejection and live single-school permissions. Multi-school membership remains in Phase 1.
- [x] Add shared login rate limiting, safe errors, reduced account-enumeration differences and CSRF/origin protection for mutations. Deployed and verified on both environments, 8 September.
- [x] Complete A1 school-access/privacy fixes and demo-isolation checks; remove playground routes. Deployed and verified on both environments, 9 September. [Permission matrix](ACCESS_CONTROL.md).
- [x] A3: complete the [authentication/email/jobs decision](AUTH_EMAIL_AND_JOBS_DECISION.md). Retain accounts/sessions; use Mailjet Free for the initial pilot, a Neon outbox and a Pro minute worker. The owner selected `support@mywaveplan.com`. No email service or receiving mailbox is configured; no activation was performed. AWS signup is not needed. SES, Scaleway and MailerSend remain assessed alternatives.
- [ ] B3/B9: implement password work-factor/policy hardening, compatible rehash, verification/recovery abuse controls and platform-admin MFA before G1. Password recovery must not bypass MFA. A6/B3 implement and test durable delivery and the support inbox; A7 settles required capacity first.
- [x] Complete A2 dependency/security baseline and Contentful cleanup. Next.js 16.3.4, React 19.2.8 and Neon driver 1.1.0 are verified on both environments; zero known audit findings. Pages Router and the accepted design are preserved. [Dependency baseline](DEPENDENCY_BASELINE.md).
- [ ] Confirm operator/contact details, controller/processor responsibilities, hosting regions, subprocessors and contracts. Review retention, minors, consumer terms, VAT and invoicing with Portuguese legal/accounting support.
- [ ] A5: perform a lightweight check of permitted development/evaluation use, attribution, caching/archive rights and forecast/tide/weather API limits. Record commercial-use triggers for L1. Keep technical cost controls, including weighted API usage; do not purchase commercial-only access at this preparation step.
- [ ] Establish backups/restore checks, redacted monitoring and an incident/support process. Use synthetic/anonymised staging data; do not routinely copy production personal data there.
- [ ] A7: resolve technical capacity, branch lifecycle and sufficient tested recovery. The [read-only infrastructure review](INFRASTRUCTURE_CAPACITY_AND_UPGRADES.md) confirmed Hobby/Free and 10/10 Neon branch slots; resolve capacity before another migration rehearsal. Purchase a paid tier only when the documented technical/operational need arises. Vercel's commercial-only upgrade moves to L1; Neon Launch is conditional on recovery/capacity needs, not automatic at G1.
- [ ] A8: use EU storage as the preferred launch target, decide the exact region before provisioning, and complete a rehearsed staging/production migration before real public registration or school onboarding. The last review recorded Neon in AWS us-east-1. Cover database, backups/restore copies, media, runtime, logs and external processors; record exceptions and disposal of old copies. Upgrading a plan does not move data.
- [ ] A9: build shared translation catalogues, locale formatting, an accessible desktop/mobile language selector and personal/device preferences before new registration/discovery screens. Support English, European Portuguese (`pt-PT`) and Spanish; prepare optional French. Match the browser initially and preserve explicit choices, with English fallback. Language does not change school timezone, currency or forecast values.

Done when: expired/revoked/deleted-user sessions are rejected; cross-school access tests pass; production rejects the development secret; demo access cannot reach real customer data; restore and upgrade checks pass; legal/licensing launch gates have a named owner.

### Phase 1: self-service accounts, onboarding and privacy controls

- [ ] B3/C7: retire temporary public Demo student access before real self-service onboarding. Remove the entry points and dedicated test identity/sessions without affecting the owner, teststudent, school or forecasts. [Demo lifecycle and cleanup](PUBLIC_STUDENT_DEMO.md).

Depends on Phase 0 session and tenant controls. This is the first substantial product release to build next.

- [x] Owner accepted the registration model and permission matrix, 8 September: [accepted design](REGISTRATION_AND_MEMBERSHIP_PROPOSAL.md). B1/B2 identity and capabilities are deployed; B3–B5 implement self-registration, invitations and school flows.
- [x] B1: add `school_memberships`, independent `membership_roles`, platform assignments and owner/invitation storage. Backfill proven roles and retain source IDs, credentials, sessions and history. The transactional bridge mirrors current edits. [Reconciliation and schema](MEMBERSHIP_DATA_MODEL.md).
- [x] B2: activate global identity, no-school login, several memberships and combined administrator/instructor roles. Retire the bridge and old constraints; verify sessions, school closure, personal bookings and teaching.
- [ ] B3/B4/B5/B8/C4: complete the accepted [account and lifecycle UI follow-up](ACCOUNT_AND_LIFECYCLE_UX_FOLLOWUP.md), including school-independent account creation, a membership overview and clearer removal, closure and erasure actions.
- [ ] B4/B5: resolve explicit instructor/customer claims and legacy ownership through verified flows. B1 reports unclaimed records without guessing links; do not merge people by matching names or silently claim a school.
- [ ] Build verified-email sign-up, password recovery, profile editing and invitation acceptance. Logout everywhere is already available in My profile. Keep telephone optional and existing username login working.
- [ ] Let a new school owner create a draft workspace before checkout, set timezone/spots/contact details, accept explicit owner authority, invite staff and publish a first lesson through a short checklist. Add the configured trial/billing step when commercial access ships. Verify authority before claiming an existing listing; do not infer ownership from payment or an old admin role.
- [ ] Let instructors self-register and request/accept affiliation. Choosing “instructor” must not grant access to a school's records. A solo instructor can operate as a school business after the same verification.
- [ ] Let surfers register independently. Proposed change to the older plan: a verified user may book an eligible public lesson without prior school-admin approval; staff membership still requires approval. Create a school customer/student link when needed; retain invitation-only lessons where configured.
- [ ] Publish reviewed privacy/terms documents and record versioned acceptance/notice delivery. Add optional marketing consent, history and withdrawal; implement cookie choice before enabling analytics.
- [ ] Add photo uploads to object storage, data export and account deletion. Transfer school ownership or close the school properly before deleting its sole owner.
- [ ] Set the initial age policy: adult self-registration; guardian-managed children only after the required booking, consent and safeguarding flow exists. Do not silently allow unrestricted child accounts.
- [ ] B10: complete and review English, pt-PT and Spanish across the pilot journeys, including forecasts, onboarding, school/lesson work, errors, transactional emails and published legal documents. Split this L task by journey and finish before G1; French is optional. Keep proper spot names and user-authored text unless translations are supplied. Verify switching mid-flow, persistence and mobile text expansion. New features thereafter include every enabled language.

Done when: a surfer, instructor and school owner can each onboard without platform-admin help; recovery works; one user accesses two authorised schools and no others; invitation abuse tests pass; existing accounts/bookings survive migration; photo/deletion flows work on mobile and desktop; refusing optional consent does not block registration.

### Phase 2: forecast-to-lesson discovery and reliable booking

Depends on Phase 1 identity; public discovery design can start earlier.

- [ ] Add “Find a lesson” from the chosen spot/day/time. Preserve this context through search and registration. Keep Conditions first/default unless an explicit deep link requests another task.
- [ ] Make forecasts, public school profiles and lesson browsing available without login, with shareable spot/day links. Ask for an account when booking or saving personal preferences. Apply A5's permitted-use/attribution checks and technical caching/rate controls; complete L1 before publication or testing that constitutes commercial use. Build and run permitted QA before purchasing commercial-only access.
- [ ] Show skill level, lesson conditions, school/instructor, total price, capacity, duration, meeting point and cancellation terms. Search by spot/date/level; show useful alternatives when no lesson exists.
- [ ] Build a public school page and bookable schedule. Add attendance and assigned-instructor access. Support transactional confirmations, cancellations, weather rescheduling and calendar links.
- [ ] Prove capacity and duplicate-booking behaviour under concurrent requests. Add idempotent reservations and explicit booking/attendance states before paid checkout.
- [ ] Define customer cancellation, school cancellation, weather and minimum-attendance policies. Keep an audit trail; forecast scores must not automatically certify a lesson as safe.
- [ ] Roadmap C5/C6: implement cookie/tracking consent, GTM, GA4, Search Console, dataLayer events, key-event/funnel reporting and tracking verification. Include forecast, signup, school activation and booking events; add subscription/purchase events with D4/E4. Validate consent, deduplication, PII/token exclusions and staging/demo separation. Set up public sitemap/canonical URLs and indexing protection for private/staging content.

Done when: a new surfer moves from a forecast to a confirmed lesson across school boundaries; concurrency cannot oversell or duplicate confirmation; each role sees only appropriate information; denying consent sends no analytics traffic; mobile search, booking and no-results paths work.

The initial pilot may use clearly disclosed pay-at-school lessons. Do not present these as paid online. Gather activation evidence before charging subscriptions.

### Commercial-use checkpoint: before the first qualifying launch or test

Roadmap L1 activates the required forecast/hosting and other commercial-use-only services at the latest point that still allows configuration and verification before the triggering activity. Record scope, terms, exact costs and approval; reuse existing covered subscriptions. This can be before the G1 school pilot, or earlier if a deployed demonstration/promotion already qualifies. Recheck coverage before G2, G3, sponsorship and vendor pilots.

Open-Meteo allows free evaluation/prototyping but distinguishes commercial hosted-API use. Vercel's commercial definition can include promotion before revenue. Check actual activity, not just whether it is called staging or whether Stripe is live. The [provider timing review](INFRASTRUCTURE_CAPACITY_AND_UPGRADES.md#commercial-activation-checkpoint) records the sources and distinctions. Commercial-only procurement is separate from coding dependencies; a technical/security/recovery requirement can still justify earlier spending.

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

- [x] F17/F18: Conditions design reviewed in Figma, implemented and verified on staging and production on 10 September. Preserve all forecast parameters, meaningful experience levels, colour coding and mobile parity. Spot cards need bounded cached summaries; photos are optional. The [design brief](CONDITIONS_UX_REVIEW_PROPOSAL.md) records Piotr's suggestions and the assessment. F18 is complete; further conditions improvements remain separately scoped. It does not add a launch gate.

- [ ] F4/F5: collect feedback on the lesson, school and instructor as distinct subjects from verified attendees. Start privately; introduce public reviews with a separate publication choice, moderation, reporting, reply and appeal controls. Show counts/date coverage; route cancellation complaints separately.
- [ ] F6: consider school/instructor rankings only with enough verified feedback. School ranking requires school-admin opt-in; each instructor separately opts in personally. Defaults are off and withdrawal is available. School approval cannot override a person's choice; review employment-related consent validity.
- [ ] Publish comparable cohort criteria, minimum sample/freshness rules and small-sample adjustment. Prevent review manipulation, paid placement in organic rankings and unsafe incentives. New providers are unranked, not automatically poor.
- [ ] F12/F13: add private instructor-assessed student progress, followed by optional adult school/course leaderboards if useful. Version the skill rubric, support corrections and explicit cross-school sharing. Do not rank students by spending, raw lesson count or wave size. Child participation needs F11 and a separate visibility review.
- [ ] F16: request lesson/conditions feedback and instructor progress updates through short contextual in-app pop-ups/cards. Use verified eligibility, actual-session confirmation where needed, complete/later/dismiss states, frequency caps and optional-prompt preferences. Ship each prompt with its form; do not interrupt booking/payment or assume a forecast view means someone surfed. Keep response content out of analytics.
- [ ] Test Surfer Plus after repeat free use and willingness to pay are demonstrated. Use the same entitlement engine for personal plans if justified.
- [ ] F8: extend to additional markets according to demand after A9/B10 deliver the initial English/pt-PT/Spanish UI. Add optional French here if deferred. Review country/currency/payment/tide support separately from translation; keep timezone, spot models, tide provenance and currency explicit.
- [ ] F14: begin bounded immutable forecast archiving early within A5's permitted evaluation/archive scope and technical limits. Commercial-only access is activated through L1 if that work requires it, not assumed necessary for every prototype. Record issued/provider/retrieved/valid timestamps and input/model/calibration versions; do not rebuild supposed historical predictions from newer data.
- [ ] F9/F15: collect actual surf observations and assess numerical errors, false-good/false-flat cases and coverage by spot/horizon. Compare matched quantities, preserve source/observer confidence, evaluate calibration candidates on held-out dates and promote through staging. Another forecast service is a comparator, not ground truth. Keep Surfline session import deferred and do not add artificial probabilities to tiles.

Done when each selected extension meets its roadmap evidence: verified feedback and visibility/moderation work; progress records remain private by default; forecast validation uses preserved predictions and independent observations; paid/geographic expansion has demand evidence and an understood operating cost.

### Conditional extensions: local services, sponsorship and mobile apps

The [expansion assessment](PRODUCT_EXPANSION_ASSESSMENT.md) records the detailed rationale. These streams follow evidence and capacity, not a requirement to finish all of Phase 6 first.

- [ ] V1/V2: validate a local pilot, then add provider profiles, business-scoped roles, service categories, spot-based discovery and enquiries. Schools may also offer other services; restaurants and repair shops do not need a fake school identity. Reuse global accounts while keeping business/customer access separate.
- [ ] V3–V6: select rental inventory/returns, equipment sales/fulfilment, shaping/repair quotes or photographer/videographer workflows based on demand. Start with enquiries/pay-at-provider; add category-specific payment/refund responsibilities before online charging. Keep images/videos outside Neon.
- [ ] V7/V8: evaluate staffed key-custody partners, then pilot capacity, check-in/receipt/verified collection only after storage, hours, responsibility and lost-token/key recovery procedures are agreed and tested.
- [ ] R1/R2: test a small clearly labelled local sponsorship offer, with platform-admin review/scheduling, first-party creative and contextual spot/region placement. Preserve forecast readability; no payment effect on model output, organic rankings or private school workspaces. Advertising tracking needs its own reviewed purposes and choices.
- [ ] M1/M2: improve home-screen installation guidance, weak-connectivity behaviour, safe cache/update handling and real-device journeys; add opt-in web push for lesson reminders and later F7 forecast alerts. Cached forecasts show their age; bookings/billing remain online.
- [ ] M3/M4: assess native iOS/Android delivery from pilot evidence, then choose architecture and estimate smaller releases. Reuse server APIs, authorisation and calculations. Review store billing/privacy rules for physical services versus digital subscriptions/media before submission; retain the web school console.

Done when the selected pilot demonstrates useful demand and each published capability has its own permissions, operating process, measurement and release evidence. A directory is not a completed rental/payment/custody marketplace, and a home-screen icon is not a store app.

## Architecture and privacy direction

The [Commercial and privacy architecture](COMMERCIAL_AND_PRIVACY_ARCHITECTURE.md) contains the proposed schema, payment flows, consent records, retention controls and event contract. It is a design proposal, not a migration ready to apply.

Keep one application with clear identity, booking, billing, catalogue, media and privacy modules. No microservice rewrite is needed. Use Neon for relational records/metadata, object storage for images and Stripe for payment collection. Enforce permissions and entitlements on the server.

Use Stripe Billing for platform subscriptions and Connect for school lesson payments. Charge type affects fund flows and dispute/refund liability, so choose it explicitly. Prices and limits belong in database configuration; feature definitions, supported operations and validation remain in code. New amounts require new Stripe Price objects. [Stripe charge types](https://docs.stripe.com/connect/charges), [Stripe price management](https://docs.stripe.com/products-prices/manage-prices)

Proposed operator identity, supplied by the owner: **PAWEL PAPLINSKI, tax number PT311219217**. Confirm legal form, address, privacy contact and VAT/invoicing treatment before publishing documents. This information alone does not establish compliance.

Document purposes and lawful bases per processing activity. Terms acceptance and privacy-notice acknowledgement are separate from consent. Core account/booking processing should use the appropriate contractual or other justified basis; optional analytics, marketing and public visibility need separate controls. Consent must be freely given, specific, informed and withdrawable. [EDPB guidance](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en)

Use consent-first analytics: no GTM/GA requests before opt-in, equally accessible accept/reject controls and a persistent settings link. Start with basic Consent Mode and advertising disabled. The CNPD identifies analytics cookies as requiring consent; a banner/Consent Mode is only one part of compliance. [CNPD guidance](https://www.cnpd.pt/media/x2zdus50/nota-informativa-cnpd_cookies_20210625.pdf), [Google consent modes](https://developers.google.com/tag-platform/security/concepts/consent-mode)

Deletion, withdrawal, export and retention are Phase 1 requirements. Financial/legal retention exceptions need documented purposes and restricted access. Publish the reviewed storage policy/subprocessor list and make deletion propagate to images, caches and restore procedures.

## The next implementation brief

F18 is complete on staging and production. Continue with B3 self-registration, verification and recovery after its privacy, EU, email and localisation prerequisites are resolved. See the [implementation contract](CONDITIONS_UX_IMPLEMENTATION.md) and [handover](HANDOVER.md). B2 authorisation is already deployed on both environments; do not repeat its migration.

The next core feature is B3 account/email self-service, after A4/B6 policy decisions, A6/A7 email and job readiness, A8 EU migration and authorised A9 localisation foundations. A3 selected Mailjet Free and a generic outbox contract; neither the provider nor the support mailbox is activated. No AWS signup is needed. Localisation remains plan-only until authorised.


10 September follow-up: compact tile metadata rows, upper weather icons and mobile-menu focus improvements are complete on staging and production after owner approval. Both environments passed 14 API and nine browser groups. [Production evidence](archive/releases/RELEASE_2026-09-10_TILE_PARAMETERS_PRODUCTION.md).
