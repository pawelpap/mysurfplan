# MyWavePlan development plan

11 November 2026. B4 staff invitations and team administration are released on staging and production. Application source hashes match; staging has no cron and production retains its ten-minute email worker. The next build is B5 draft-school creation and onboarding. See the [release record](archive/releases/RELEASE_2026-11-11_STAFF_INVITATIONS.md) and [current handover](HANDOVER.md). Older dated release/status notes are historical.

## Current B5 work

All three B5 stages are authorised for incremental staging implementation and Astra verification. Its [implementation record](SCHOOL_ONBOARDING.md) tracks the private-draft scope and evidence. After every stage passes, run integrated automated and Astra browser/security/migration checks, then present prepared accounts/data and a concise acceptance checklist for the owner’s complete staging review. No B5 production promotion is permitted before that review and explicit approval. B7 storage provisioning belongs to stage 2, after current-state and cost-control checks; production remains B4.

## Recommendation

The proposed [B5 release plan](B5_RELEASE_PLAN.md) splits delivery into school creation/text settings, branding/publication and personal profile photos with B7 media, then explicit claiming/ownership transfer. First create the draft and accountable owner atomically, with a setup checklist, name/description, timezone, contacts, website/social links, operating spots and school-processing acceptance. Keep draft, publication and pilot/trial access separate. Uploads and subscriptions do not block this first release. Release 1 implementation/staging is now authorised; storage provisioning, later releases and production promotion retain their separate approvals.

The wider goal remains a self-service forecast-to-lesson journey. Complete school setup and reliable bookings before paid school subscriptions, then online lesson payments. Preserve the free surfer forecast.

The owner approved F17’s [Conditions Figma proposal](CONDITIONS_UX_FIGMA_REVIEW.md) and approved F18 on staging and production. The [implementation contract](CONDITIONS_UX_IMPLEMENTATION.md) records the final refinements: spot cards for now in daylight or the next sunrise at night, five-minute batched summary caching, smaller mobile carousel cards, production’s 10 September noon day tiles, linked surf/energy and tide detail charts with one time label, equal parameter weight and full mobile tile information. Production was promoted and verified on 10 September after the owner’s staging review. That 10 September UX release did not change calculations or calibrations; the separately approved 17 September release supersedes its tile timing and adds database calibration changes.

Among the new ideas, prioritise preserving forecast predictions for later evaluation and verified lesson feedback. Improve the installable mobile web experience alongside core delivery when capacity permits. Validate service listings and local sponsorship before committing to broader marketplaces, competitive rankings or store apps.

## Baseline and gaps

The Caparica/São Pedro comparison is closed: the separate investigation explained the differences and verified both environments without a justified code/calibration change; the owner confirmed resolution on 16 September. [Report and disposition](archive/calibration/2026-09-15-four-spots/README.md). F19 remains broader planned research and does not block onboarding.

A new 17 September São Pedro review concerns Saturday 19 September. Surfline and our GFS inputs differ in swell bearing, height and partition ordering. The owner authorised a provisional assumption-based calibration for both breaks: Bico/Bafureira in both environments now admit a broader sheltered GFS direction range, retaining raw bearings and distinct break rules. [Exact settings, replay, live verification and remaining uncertainty](archive/calibration/SAO_PEDRO_DIRECTION_REVIEW_2026-09-17.md). This does not reopen the earlier comparison or establish measured accuracy. The owner subsequently approved production; both environments now use these revisions. [Production release and verification](archive/releases/RELEASE_2026-09-17_FORECAST_PRODUCTION.md).

Historical baseline: on 16 September both live domains and GitHub deployment branches were verified at documentation commit `04d9c9a8ba15e06406ceae6101154cc391719a34`, containing runtime `e6cfee77ee0517950107d0f01a76b7e0f900373f` from the [13 September typography release](archive/releases/RELEASE_2026-09-13_EMAIL_TYPOGRAPHY.md). Both environments now contain the approved 17 September small-wave/window and São Pedro release described above. The [handover](HANDOVER.md) owns current deployment IDs and verification limits. B2 global accounts/memberships, F18 Conditions, the translation fix, temporary public demo, A8 Frankfurt migration and the disabled email foundation are delivered. That dated snapshot is superseded by the November account, localisation, legal-publication and invitation releases.

Completed targeted calibration review, 10 September: Praia Grande and Praia Pequena are revision 4 in both databases. Generic period-suitability parameters temper short-period quality without changing wave heights, energy or experience limits. Live verification passed on both environments. The [review and evidence](archive/calibration/2026-09-10-grande-pequena/README.md) records remaining Surfline differences; F19 covers coastal weather sampling and residual quality assessment. This does not change the agreed onboarding sequence.

The separately authorised [neighbouring Sintra follow-up](archive/calibration/2026-09-10-sintra-neighbours/README.md) extended that period-quality adjustment to Adraga, Praia das Maçãs, Magoito and São Julião on 10 September. Their other coefficients remain local. Both environments passed verification; F19 remains open for the wider source/model investigation.

Completed data review and production promotion, 7 September: 16 local spot calibrations revised, Praia da Torre added and generic São Pedro removed. That release matched spot/configuration and disposable lesson data; the later B2/A8 cleanup removed operational fixtures. The current handover owns the latest recorded inventory. All calibration changes use existing database parameters. Model and live checks passed; the owner approved production after staging review. Exact settings, research and limitations are in [Local spot calibration review](archive/calibration/2026-09-07-local-review/README.md). Continue validating the provisional coefficients against local observations. Surfline session data work is deferred at the owner's request. A1’s tenant/privacy audit and A2’s dependency/security cleanup were completed on 9 September. A3’s [authentication, email and jobs decision](AUTH_EMAIL_AND_JOBS_DECISION.md) is complete as a planning task. B1/B2 are deployed and verified; F17 is approved; F18 is deployed and verified on staging and production. Core B3 account/email self-service was released on 4 November; school onboarding remains B5. The owner’s B2 UI feedback is recorded in [account and lifecycle follow-up](ACCOUNT_AND_LIFECYCLE_UX_FOLLOWUP.md).

| Area | Current position from code and project documentation | Implication |
| --- | --- | --- |
| Forecasts | Eighteen active spots, 16-day forecast, versioned calibration, tides/daylight, swell components and experience scoring | Preserve behaviour and validate accuracy through F19 |
| Design | Task-oriented screens, mobile layouts, quality colours, device/light/dark appearance and nearest-spot selection | Reuse existing components and visual language |
| Identity | Global accounts, verified signup/recovery, independent memberships and staff invitations are released | Build B5 school onboarding and preserve role boundaries |
| Sessions | Seven-day database-backed sessions, hashed tokens, secure cookies, current account/role/school checks and single/global logout are deployed | Login abuse and CSRF controls are deployed; A1 school boundaries and response privacy are verified; complete broader privacy/account controls before self-registration |
| Booking | B2 identity-linked personal bookings across existing school contexts, separate staff booking and tested capacity locking | C1–C3 add public discovery and eligible cross-school joining |
| Commerce | No implemented plan, subscription, payment or package-credit domain | Establish a common model before adding payment buttons |
| Privacy | Versioned notices/terms, acceptance evidence, account closure intake and necessary storage disclosures are live; optional tracking is off | B5 school-processing acceptance and B8 erasure/export remain |
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

Conservative operating budget after A3: [€90–120/month before tax and payment fees](LAUNCH_COST_ESTIMATE.md), assuming both minute workers, outbound email and one support mailbox. The intended activation schedules production only, with staging off outside tests; measure that workload through A7. About €50 remains a minimal forecast-only scenario if suitable free tiers suffice; it does not cover the new registration service. A7 settles scheduling, database active-time and recovery costs before live jobs. One-time professional work, domain renewal and fiscal invoicing remain outside this estimate. Purchase timing stays L1 for commercial-only costs; required technical upgrades happen earlier when needed.

## Delivery order

Each phase consists of small staging releases. The [implementation roadmap](IMPLEMENTATION_ROADMAP.md) provides the estimated backlog: G1 is a controlled self-service/pay-at-school pilot; G2 adds paid school software; G3 adds online individual lesson payments. Packages, reviews and leaderboards remain listed as subsequent extensions. Payment design can start early; live payments depend on reliable accounts and booking. Re-estimate substantial tasks after the audit/provider decisions.

### Phase 0: secure the foundation and define launch responsibilities

Outcome: existing users and schools can safely support self-service flows.

- [x] Released to staging and production: require a production signing secret of at least 32 bytes, remove the production development-secret fallback, use Secure/HttpOnly cookies, enforce seven-day expiry and reject malformed/tampered cookies. Release `729489e`; staging verified, then production explicitly approved and verified.
- [x] Add revocable sessions and current server-side account/role/school checks. Deployed and verified on staging and production: single/global logout, password/status invalidation, disabled/deleted-account rejection and live single-school permissions. Multi-school capability was subsequently delivered by B2 in Phase 1.
- [x] Add shared login rate limiting, safe errors, reduced account-enumeration differences and CSRF/origin protection for mutations. Deployed and verified on both environments, 8 September.
- [x] Complete A1 school-access/privacy fixes and demo-isolation checks; remove playground routes. Deployed and verified on both environments, 9 September. [Permission matrix](ACCESS_CONTROL.md).
- [x] A3: complete the [authentication/email/jobs decision](AUTH_EMAIL_AND_JOBS_DECISION.md). Retain accounts/sessions; use Mailjet Free initially, a Neon outbox and a minute worker subject to verified Vercel plan/capacity. Mailjet domain validation and SPF/DKIM passed on 10 September; app credentials, staging isolation, limits and delivery still require A6/A7 tests. On 13 September, Zoho Mail Lite replaced the home.pl receiving-mail proposal. Pawel/Support delivery, replies, Mac setup and DMARC monitoring are verified. Vercel retains DNS/app hosting and GoDaddy retains registration. B3 still requires actual application email flows. AWS signup is not needed.
- [x] B3 account verification/recovery and password-policy/work-factor changes are released.
- [ ] B9 application MFA and sensitive-action recovery remain before G1.
- [x] Complete A2 dependency/security baseline and Contentful cleanup. Next.js 16.3.4, React 19.2.8 and Neon driver 1.1.0 are verified on both environments; zero known audit findings. Pages Router and the accepted design are preserved. [Dependency baseline](DEPENDENCY_BASELINE.md).
- [ ] A4/B6: confirm the owner's Portuguese self-employed operator details and processing roles; prepare and review the privacy notice, platform terms, school data-processing agreement, internal processing/retention inventory and provider register. Publish accessible legal pages and implement version/language evidence and optional preferences through B6; retention and rights controls remain B8/A6/A8. [Detailed deliverables](COMMERCIAL_AND_PRIVACY_ARCHITECTURE.md#a4b6-documentation-and-implementation-scope). Review minors, VAT and invoicing with Portuguese legal/accounting support. Business registration alone does not establish GDPR compliance.
- [ ] A5: perform a lightweight check of permitted development/evaluation use, attribution, caching/archive rights and forecast/tide/weather API limits. Record commercial-use triggers for L1. Keep technical cost controls, including weighted API usage; do not purchase commercial-only access at this preparation step.
- [ ] A6: establish backups/restore checks, redacted server and browser error monitoring and an incident/support process. Include central browser crash reports with release/browser context, privacy controls and tested alerts when securing operations and maintenance. [Browser reporting scope, added 12 September](IMPLEMENTATION_ROADMAP.md#a6-browser-error-reporting-note-12-september-2026). Use synthetic/anonymised staging data; do not routinely copy production personal data there.
- [ ] A7: complete operational capacity and lifecycle planning. Neon is Launch, Vercel Pro was recorded active on 6 October; A8 left four EU branches with five-minute compute suspension and tested seven-day recovery history. Measure use and resolve minute-worker capacity before email rollout. The US$20 notification is not a cap. Commercial-only upgrades remain L1; no automatic plan purchase.
- [x] A8: migrate staging and production databases and Vercel functions to Frankfurt, test restore/session continuity and app behaviour, remove unused legacy tables and retire the old US project/Vercel resource. Completed 12 September with owner-approved same-day disposal. [A8 release evidence](archive/releases/RELEASE_2026-09-12_EU_MIGRATION.md). Ongoing processor/legal review remains A4 and operational jobs remain A6/B8.
- [ ] A9: build shared translation catalogues, locale formatting, an accessible desktop/mobile language selector and personal/device preferences before new registration/discovery screens. Support English, European Portuguese (`pt-PT`) and Spanish; prepare optional French. Match the browser initially and preserve explicit choices, with English fallback. Language does not change school timezone, currency or forecast values.

Done when: expired/revoked/deleted-user sessions are rejected; cross-school access tests pass; production rejects the development secret; demo access cannot reach real customer data; restore and upgrade checks pass; legal/licensing launch gates have a named owner.

### Phase 1: self-service accounts, onboarding and privacy controls

Outcome: a person can use one account across schools, with explicit authority for each school.

- [x] Global identity, independent memberships and school-scoped permissions are deployed through B1/B2.
- [x] Core B3 registration, email verification, recovery, password change and personal profile flows are released. Eligible self-closure is live; full export/erasure remains B8. Remaining operator-created-account wording is tracked separately in the account/lifecycle follow-up.
- [x] B4 invitations, independent roles, team management, explicit instructor claims and membership overview are released and independently verified on staging and production.
- [ ] B5 next: atomically create a draft school and its owner membership, add basic settings/contact/timezone/spots, and separate setup/activation from public publication. Publish the school-processing agreement and record authorised acceptance before independent schools onboard.
- [ ] Follow the [B5 release sequence](B5_RELEASE_PLAN.md): design School settings, public presentation and a lesson-email preview coherently in Figma before branding implementation. Add save draft, preview, explicit publish, reset defaults and shared versioned branding for later C2/C4 journeys. Include personal profile photo upload/crop/replace/remove, personal ownership checks and lifecycle cleanup in this second release; these photos do not wait for claims, transfers or commerce. Then handle explicit claiming and atomic transfer with verified acceptance/recent authentication. Keep closure controls clear and full erasure/retention in B8. Never infer ownership from an email domain, old role or payment.
- [ ] B7 before uploaded branding: separate Frankfurt Vercel Blob stores, private originals, published derivatives, validated uploads, quotas and cleanup. Basic draft-school setup can proceed first.
- [ ] B8/B9: finish export, erasure, retention/restore execution and application MFA/sensitive-action recovery.
- [ ] B10: continue full journey verification in every enabled language as school and lesson flows ship. Shared foundations and existing account/invitation emails already support English, European Portuguese, Spanish and French.

The initial pilot remains adult-only. Optional tracking stays off until C5/C6; G1 still needs its remaining school, booking and operational acceptance evidence.

### Phase 2: forecast-to-lesson discovery and reliable booking

Depends on Phase 1 identity; public discovery design can start earlier.

- [ ] Add “Find a lesson” from the chosen spot/day/time. Preserve this context through search and registration. Keep Conditions first/default unless an explicit deep link requests another task.
- [ ] Make forecasts, public school profiles and lesson browsing available without login, with shareable spot/day links. Ask for an account when booking or saving personal preferences. Apply A5's permitted-use/attribution checks and technical caching/rate controls; complete L1 before publication or testing that constitutes commercial use. Build and run permitted QA before purchasing commercial-only access.
- [ ] Show skill level, lesson conditions, school/instructor, total price, capacity, duration, meeting point and cancellation terms. Search by spot/date/level; show useful alternatives when no lesson exists.
- [ ] C2: build a branded public school page and bookable schedule, using shared school settings for logo, cover/gallery, description, contacts and limited section choices. Keep the MyWavePlan layout, booking journey and required disclosures coherent on desktop/mobile.
- [ ] C4: add attendance and assigned-instructor access, confirmations, cancellations, weather rescheduling, reminders and calendar links. Let school admins customise bounded email copy and branding with a preview, while the app owns booking facts, sender authentication and required notices. Reuse the shared email shell/outbox; registration/security emails remain platform-owned.
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
- [ ] F14, partial on staging: bounded immutable sampling is implemented on 17 September; fixed-lead coverage, monitoring and storage strategy remain open. Continue forecast archiving within A5's permitted evaluation/archive scope and technical limits. Commercial-only access is activated through L1 if that work requires it, not assumed necessary for every prototype. Record issued/provider/retrieved/valid timestamps and input/model/calibration versions; do not rebuild supposed historical predictions from newer data.
- [ ] F9/F15: collect actual surf observations and assess numerical errors, false-good/false-flat cases and coverage by spot/horizon. Compare matched quantities, preserve source/observer confidence, evaluate calibration candidates on held-out dates and promote through staging. Another forecast service is a comparator, not ground truth. Keep Surfline session import deferred and do not add artificial probabilities to tiles.
- [ ] F19: implement the owner's [accepted shared-model and weather-sampling review](IMPLEMENTATION_ROADMAP.md#f19-accepted-scope-10-september-2026). Audit all spot settings, validate configurable coastal weather sampling and review period/size/wind/wind-sea interactions across representative beaches. Keep local coefficients in the database; no universal period cut-off or copying Grande/Pequena's provisional weights across the catalogue. Validate against observations before wider rollout. The 17 September trial implements a bounded staging subset; the broader review and production approval remain open.

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

Keep one application with clear identity, booking, billing, catalogue, media and privacy modules. No microservice rewrite is needed. Use Neon for relational records/metadata, Vercel Blob in Frankfurt for images and Stripe for payment collection. Enforce permissions and entitlements on the server.

Use Stripe Billing for platform subscriptions and Connect for school lesson payments. Charge type affects fund flows and dispute/refund liability, so choose it explicitly. Prices and limits belong in database configuration; feature definitions, supported operations and validation remain in code. New amounts require new Stripe Price objects. [Stripe charge types](https://docs.stripe.com/connect/charges), [Stripe price management](https://docs.stripe.com/products-prices/manage-prices)

Operator identity belongs in the reviewed legal publications. Keep unpublished tax, address and other private details in ignored drafts, without duplicating them in the development plan. Complete legal/provider review and applicable VAT/invoicing decisions before publishing the relevant documents. Recorded identity alone does not establish compliance.

Document purposes and lawful bases per processing activity. Terms acceptance and privacy-notice acknowledgement are separate from consent. Core account/booking processing should use the appropriate contractual or other justified basis; optional analytics, marketing and public visibility need separate controls. Consent must be freely given, specific, informed and withdrawable. [EDPB guidance](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en)

Use consent-first analytics: no GTM/GA requests before opt-in, equally accessible accept/reject controls and a persistent settings link. Start with basic Consent Mode and advertising disabled. The CNPD identifies analytics cookies as requiring consent; a banner/Consent Mode is only one part of compliance. [CNPD guidance](https://www.cnpd.pt/media/x2zdus50/nota-informativa-cnpd_cookies_20210625.pdf), [Google consent modes](https://developers.google.com/tag-platform/security/concepts/consent-mode)

Deletion, withdrawal, export and retention are Phase 1 requirements. Financial/legal retention exceptions need documented purposes and restricted access. Publish the reviewed storage policy/subprocessor list and make deletion propagate to images, caches and restore procedures.

## The next implementation brief

When B5 implementation is authorised, begin with release 1 of the [B5 release plan](B5_RELEASE_PLAN.md). Create the draft and owner membership atomically, add text settings and a setup checklist, and record authorised school-processing acceptance before independent schools join. Design branding/publication with B7 media as release 2; explicit claiming/ownership transfer is release 3. Demo Surf School remains unclaimed. Verify the currently unprovisioned-by-plan storage selection before any action.

Use GPT-6.1 Sol at High reasoning and normal speed, with Astra 6 High at normal speed for ownership design and independent authorisation/migration review. Prepare and verify staging before a separately authorised production release. Preserve current source parity, school boundaries, email languages and cleanup requirements.

## Legal implementation update, 6 October 2026

A4/B6 now have complete staging text in the intended privacy/terms/school-processing routes, versioned agreement evidence, separate server-side privacy delivery and disabled optional purposes. Poppins fonts are self-hosted. Production publication and wider legal/retention/provider controls remain open, so these tasks remain partial. [Implementation contract and gates](LEGAL_IMPLEMENTATION.md).

The owner-confirmed future tracking stack is Google Analytics 4 (GA4), Meta Pixel, LinkedIn Insight Tag, Google Ads and Microsoft Clarity. C5/C6 must use purpose-specific choices, provider role/transfer verification and actual withdrawal/masking tests. These are planned tools, not current recipients. No activation, paid subscription, registration or full localisation is included in this staging release.
