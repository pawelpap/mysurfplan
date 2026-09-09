# Product expansion assessment

9 September 2026. Planning review requested by the owner. This evaluates the new feature ideas, including advertising and mobile apps, and adds them to the [implementation roadmap](IMPLEMENTATION_ROADMAP.md). These are recommendations and conditional backlog entries, not released features or approval to purchase services. The accepted registration model and G1–G3 launch sequence remain unchanged.

## Recommended priority

Finish the secure self-service forecast-to-lesson journey first. Start preserving forecast evidence early, add verified feedback and student progress after lessons are running, then test a small local services directory and sponsorship offer. Build leaderboards only after useful participation exists. Improve the installable web app before funding separate store apps.

| Idea | Assessment and first useful version | Priority / task references |
| --- | --- | --- |
| Forecast accuracy | Strong fit with the existing product. Archive issued predictions, collect real observations and evaluate by spot/horizon. | Begin collection early: F14; observations F9, evaluation F15 |
| Conditions-page clarity | [Piotr's feedback and design brief](CONDITIONS_UX_REVIEW_PROPOSAL.md): calendar weeks, concise tiles, spot cards, icons and a conditions chart. Preserve the parameter set and current visual language. | F17 Figma/owner review first, then F18 approved implementation; future work, not a launch prerequisite |
| Lesson, school and instructor ratings | Helps students choose and schools improve. Separate these subjects and require verified attendance. | After reliable attendance: F4/F5, already planned and now clarified |
| Student leaderboards | Progress is useful; competition is optional. Start with private progress records, then opt-in course/school cohorts if students want them. | F12 before F13; no public global ranking at launch |
| School/instructor leaderboards | Potential discovery aid, but a raw average rewards tiny samples and is easy to manipulate. | F6 after enough verified public feedback; already planned |
| In-app feedback prompts | Makes feedback part of the journey. Use short dismissible pop-ups/cards after eligible activity, with a later option and frequency limits. | F16 incrementally with lesson feedback F4, conditions F9 and progress F12 |
| Rentals, shops, shapers, repairs and camera operators | Fits the spot-to-surfing journey, but each transaction type needs a different workflow. Start with provider profiles and enquiries. | V1/V2 pilot; select V3–V6 based on demand |
| Partners holding car keys | Useful local convenience, with a physical handover that software alone cannot guarantee. | V7 discovery; V8 only after a workable staffed pilot is agreed |
| Advertising | Possible secondary revenue. Begin with a limited direct local sponsorship offer and measure its value. | R1/R2 after audience and commercial-use readiness |
| Mobile apps | Strong mobile experience matters now. Store distribution is a separate investment with ongoing release/support work. | Installable web M1, push M2, native decision M3 and conditional build M4 |

The roadmap holds S/M/L estimates, Design/FE/BE/DB/Ops/Business impact, dependencies and acceptance evidence. The extension list is a set of options to validate, not an expanded minimum launch scope. The [current handover](HANDOVER.md) identifies the next development task; this assessment does not set a separate delivery sequence.

## Ratings, reviews and student progress

Use three separate concepts: a student's feedback about a lesson/provider, an instructor's assessment of a student's progress, and a leaderboard calculated from eligible evidence. They have different authors, permissions and visibility.

F4/F5 collect one response per verified attended lesson with separate lesson, school and instructor dimensions. A session with two instructors needs explicit subject selection; do not attribute one instructor's feedback to everyone assigned. Link school aggregates to the school at the time of the lesson. Do not turn every scheduled lesson instance into a permanent public ranking page: show individual feedback in its context and aggregate repeated offerings only when they are comparable. Cancellations and service complaints need a support route even though they are not attended-lesson ratings.

Start with private feedback. Public publication is a separate choice with report, reply, appeal and moderation controls. Explain sample counts and date coverage. Provider subscriptions cannot remove negative reviews or improve an organic score. Define handling for staff/self-reviews, duplicates, coercion and suspicious patterns before publication. Privacy and review visibility need their own reviewed policy; consent to appear in a leaderboard is not consent to all public content about someone.

F12 gives each student a private progress record based on a versioned rubric: for example paddling, controlled take-off, board control and understanding priority rules. An instructor records evidence in the lesson context; the student can see and request correction. These records are not professional certifications. A student may authorise sharing selected progress with another school; that school does not inherit all prior private notes.

F13 is optional. Pilot small adult course/cohort leaderboards for progress relative to starting level, with comparable assessment opportunities and capped points for milestones. Publish the criteria before the period starts and audit teacher changes. Avoid ranking students by money spent, raw lesson count, largest wave or time in dangerous conditions. Private progress remains available without joining. No public child leaderboard is proposed; any later child participation depends on F11 and a separate privacy review.

For F6, compare schools/instructors in relevant locations and lesson contexts. Use minimum evidence, recency and a documented small-sample adjustment before ordering results. New or sparsely reviewed providers should be unranked rather than labelled poor. Explain the method, permit ties and test whether the order is stable under a few new reviews. Choose thresholds from observed pilot data before public ranking, rather than inventing an authoritative score now. School publication and each instructor's personal opt-in are separate, default off and withdrawable.

Conceptual records: subject-linked `lesson_feedback`, moderation/appeal events, versioned skill rubrics and `student_assessments`, leaderboard definitions/periods and explicit participation records. Keep private narrative notes out of public aggregates and analytics. Final tables belong to each implementation task, not a migration in this document.

## In-app prompts and feedback journeys

F16 adds a small shared prompt system so useful feedback is requested at the right moment. It includes short pop-ups as requested, alongside persistent cards/inbox items when an interruption is inappropriate. Ship each flow with its underlying form rather than building a general marketing automation product first.

| Trigger | Suggested journey | Eligibility and stop rule |
| --- | --- | --- |
| Lesson finished and attendance confirmed | “How was your lesson?” opens brief lesson/school/instructor feedback; public publication remains a separate choice | Actual attendee only, after the lesson ends and a configured delay; stop after submission, expiry or decline. Never ask someone to rate a cancelled lesson as attended. |
| User confirms a recent surf session, or returns to a recently viewed spot after the relevant time | First ask “Did you surf here?” if attendance is unknown, then “How were the conditions?” with spot/time confirmation | Viewing a forecast or sharing device location is not proof of surfing. Accept actual observations within a defined recent window; no request to rate future conditions. Show the observation form before the forecast comparison to limit anchoring. |
| Instructor completes lesson attendance | Offer “Update student progress” for eligible attendees using F12's rubric | Assigned instructor/current school authority only; no duplicate assessment and no access to other schools' private notes. |

Start with a single eligible prompt at a natural break or next visit. Keep the forecast view, tide interaction, lesson booking, payment, account recovery and destructive confirmations free of interruptions. The popup must have an obvious dismiss action, “Later” and an accessible route to the form; check keyboard focus, screen readers, mobile sizing and dark/light modes. Closing cannot silently submit or publish feedback.

Persist per-user/subject state: eligible, shown, postponed, dismissed, completed or expired, with the prompt version and next eligible time. Recheck authorisation and completion on the server when displaying or submitting; concurrent devices must not produce duplicate feedback or repeated prompts. Define account-wide frequency caps, a cooldown and a maximum reminder count before release. Platform admins may tune approved templates/delays within bounded rules; no arbitrary executable workflow or unmoderated school-wide pop-up broadcasting in the first version.

Offer a preference to stop optional feedback prompts while keeping feedback forms available. Review the purpose and retention of prompt records under B6/A4; do not bundle feedback with marketing consent. Operational state prevents repetition even when analytics is declined. Consented analytics may measure display, dismissal, start and completion, but must exclude answers, student names and free text. Coordinate prompt completion with any later M2 notification so a person who has responded is not chased again; email/push feedback campaigns are not automatically enabled by this task.

Evaluate completion, dismissal, repeated interruption and observation coverage. Ask on poor/flat days too, and compare prompted with volunteered responses to identify selection bias. Do not reward positive ratings, higher surf scores or favourable answers. Private responses are never republished automatically and feedback refusal must not affect access, booking or ranking eligibility.

## Assessing forecasting accuracy

Forecast verification compares predictions with observations. ECMWF describes pointwise measures such as mean absolute error and explains why spatial/time matching matters. This supports the measurement approach; it does not validate our local surf model. [ECMWF verification overview](https://www.ecmwf.int/en/about/media-centre/science-blog/2023/verifying-high-resolution-forecasts)

The minimum useful sequence is:

1. **Preserve what was predicted.** F14 stores immutable issued predictions before the valid time, including provider run time when supplied, retrieval time, forecast issue/valid time, spot/configuration/algorithm versions, raw input provenance and predicted local outputs. Record cache age so an old provider run is not mistaken for a fresh one. Use fixed sampling windows across lead times, independent of which spots users open. Choose cadence and retention after A5's permitted-use/attribution/limit check; commercial-only access moves to L1 when the activity requires it. Archive gaps stay gaps.
2. **Collect comparable observations.** F9 records spot/break, time window, observed wave-height definition/range, surf quality, wind/tide where supported, observer/source and confidence. Distinguish an offshore buoy from breaking-wave estimates on the beach and preserve tide datum and direction conventions. Gather poor and flat days as well as good sessions. Structured instructor observations are useful but subjective; check agreement between observers. Collect an observation before showing the predicted score where practical to reduce anchoring.
3. **Evaluate held-out evidence.** F15 reports signed bias and absolute error for comparable numerical values, circular error for directions, range coverage together with width, and false-good/false-flat classifications. Separate provider-input error from local conversion error where matched measurements permit. Group by spot, forecast horizon, swell sector and tide regime; show counts, missingness, date coverage and uncertainty. A forecast range is not automatically a statistical confidence interval.
4. **Test calibration changes.** Compare the current and candidate local model on the same archived inputs, with persistence and a generic/unadjusted model as useful baselines where available. Separate tuning dates from evaluation dates. Check improvements across conditions, retain individual break behaviour and promote database calibration versions through staging review. Do not optimise one Tuesday at the expense of other regimes.

Store searchable metadata in Neon and larger compressed snapshots in object storage where useful, under a documented retention budget. Concepts include `forecast_issues`, forecast sample objects, `surf_observations`, versioned evaluation runs and calibration trial results. Observation identities/photos require the account/media privacy lifecycle; retain anonymised measurement evidence only where the reviewed policy permits.

The first dashboard is internal. Publish historical performance only once data are sufficiently representative, with the method and sample coverage. Comparing with Surfline/Windguru can reveal differences but cannot establish ground truth. Surfline session import remains deferred until the owner provides an export. Do not add a probability or replacement “long-range” label to day tiles; the owner previously rejected these without a defensible method.

## Other businesses and local services

V1 should establish which service produces real enquiries in the existing region. V2 can then add a Nearby services entry from a spot, with category, location/service area, opening hours, contact/enquiry and clear provider identity. Keep this separate from the forecast parameter panel and preserve the task-oriented design. Start with a few invited businesses and manually reviewed listings; do not build every category's checkout first.

Keep one global personal account. Providers need business-scoped staff roles, not a new global vendor user type. A school may also rent boards or offer repairs; a restaurant holding keys is not a surf school. At V2, design a generic business entity/profile and capability relationship with an optional school link, with migration/ownership rules if existing organisations are generalised. B1/B2 should keep identity/permission interfaces extensible, but must not take on an unused marketplace rewrite now. Never grant school teaching/student access from a vendor category or payment.

The first directory supports enquiries and pay-at-provider. Subsequent operational differences are material:

- Rentals need individual units or capacity, sizes, time slots, collection/return and agreed damage/deposit handling.
- Equipment sales need stock/variants, fulfilment, returns and seller responsibilities. Begin with businesses, not peer-to-peer resale or a multi-seller cart.
- Shapers/repairers need request photos, quotes, acceptance, turnaround and job status. Custom deposits and staged payments are a separate financial increment.
- Photographers/videographers need a session request, agreement on deliverables/usage, subject visibility and private delivery. Use object storage or authorised external delivery links, not video blobs in Neon. A digital-download store would need a separate scope/payment review.

Reuse product/order/media/payment capabilities where they fit. Scope financial records to the actual supplying business and recheck merchant onboarding, invoicing/refunds and category obligations before taking payment. Existing Connect school support does not by itself make every marketplace category ready. Consider a provider subscription or enquiry fee only after demand; disclose any paid placement separately from organic order.

For key custody, validate the physical procedure before writing the booking flow: named partner staff, opening hours covering collection, secure storage, receipt/token matching, lost-token/key recovery, emergencies, responsibility and incident support. V8 can record capacity, check-in, collection and exceptions with restricted access. A token should not reveal a car's location or registration publicly. Do not collect full car/key details without a defined need. A listed restaurant is not a guarantee of secure custody; the pilot must test the actual service.

## Advertising and sponsorship

Advertising is worth testing after repeat use exists, but revenue depends on the real audience and advertiser demand. Start with a small fixed-fee local sponsorship, for example a board-repair business on relevant spot pages. Use a clearly labelled Sponsored card in a reserved area outside forecast metrics, booking controls and organic rankings. Keep paid school workspaces free of display ads initially. Avoid pop-ups, interstitials and auto-playing media.

R1 validates the offer, commercial forecast rights, price and economics. Do not estimate revenue from unmeasured traffic or promise impressions in a fixed placement pilot. R2 adds platform-admin campaign review, permitted categories, creative assets, destination URL, selected public spot/region, start/end dates and pause controls. Use the spot being viewed as context; do not send precise device location or private lesson/progress records to advertisers.

Prepare the feature and run permitted tests before buying commercial-only services. L1 activates any missing commercial entitlement immediately before the first qualifying promotional test/campaign, with time to verify it. Apply the same rule to provider pilots and mobile releases; actual technical/operational constraints can require earlier paid access.

Serve first-party creative assets and start without third-party ad SDKs, retargeting or audience profiles. Consent for analytics does not authorise unrelated advertising tracking. Review each proposed storage/measurement purpose; CNPD specifically identifies analytics cookies as requiring consent. Existing C5/C6 controls remain the starting point, not blanket permission for an ad network. [CNPD cookie guidance](https://www.cnpd.pt/media/x2zdus50/nota-informativa-cnpd_cookies_20210625.pdf)

Report eligible audience, consented views/clicks with their coverage, enquiries and page-performance impact. Declare bot/demo filtering and attribution limits. Campaign sales/invoices are platform records; an advertiser cannot buy better surf scores, recommendations or review scores. A later programmatic network, self-service campaign checkout or paid ad-free tier requires its own evidence and implementation decision. No advertiser accounts or purchases are created by this plan.

## Mobile: web first, native when justified

The repository already has a [standalone manifest and icons](../public/manifest.webmanifest) and [iPhone home-screen metadata](../pages/_document.js). This is an installable web foundation, not an App Store app. No service-worker/offline or push implementation was found in the reviewed source. Keep current mobile/desktop forecast parity and extend the web experience in M1/M2.

M1 covers installation guidance shown at an appropriate moment, installed-state handling, login/deep links, update recovery and unreliable connectivity. Begin offline support with an explanatory fallback and a bounded last-saved public forecast showing its fetch/valid time. It must never appear fresh while disconnected. Keep private rosters, authentication, bookings and billing out of general-purpose offline caches; offline attendance editing requires a separate conflict/privacy design.

M2 adds permission-based lesson reminders/reschedule notifications, and forecast alerts once F7 exists. A user action should trigger the permission request, with per-device settings, quiet hours, deduplication, expiry and removal on logout/revocation as appropriate. Do not include private roster or payment details on a lock screen. Web push already works for home-screen web apps on iPhone/iPad from iOS/iPadOS 16.4, so push alone does not force a native build. Delivery/support vary by device and must be checked; retain transactional email as a fallback. [WebKit web push guidance](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

Use pilot evidence for M3: repeat mobile use, installation friction, missed reminders, requests for store distribution and needs the web version cannot meet adequately. Do not invent a universal user-count threshold. Compare continuing with the web app, a hybrid client and a shared iOS/Android app; select technology after a prototype and maintenance estimate. A native app could focus first on surfers/instructors checking conditions, bookings and reminders, while the full school console remains on the web.

M4 reuses the backend, spot calculations, permissions and entitlement rules. Client screens may need a different implementation; do not promise full web UI reuse. Add a deliberate mobile session/token lifecycle, deep links, secure device storage, account deletion, push preferences, accessibility and real-device testing. Split the L programme into smaller estimated releases once scope is known.

Before store delivery, recheck review and billing rules per country/store. Apple requires utility beyond a repackaged website; physical services and digital features have different payment treatment. Google likewise distinguishes physical goods/services from paid digital functionality and offers region-specific programmes. In-person surf lessons/rentals, digital Surfer Plus, digital photo downloads and in-app advertising purchases must be classified separately. Do not assume existing Stripe web checkout can be copied everywhere. [Apple review guidelines, sections 3.1 and 4.2](https://developer.apple.com/app-store/review/guidelines/), [Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)

None of these additions changes the immediate order: foundation, self-service onboarding, forecast-to-lesson booking, school subscriptions, then online lesson payments. Collect forecast evidence and improve mobile delivery alongside that sequence when capacity permits.
