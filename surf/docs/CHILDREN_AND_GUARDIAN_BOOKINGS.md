# Children’s lessons and guardian bookings

12 September 2026. **F11 roadmap design, not implemented.** The owner confirmed adult-only accounts for the initial pilot, while asking to plan children’s lessons and consider accounts for ages 16–17. Do not enable minor registration or booking through an adult-only checkbox.

## Recommended release order

1. **Initial G1 pilot:** adult accounts, booking for adult participants. The eligibility rule must apply to staff booking-on-behalf too. A school offering children’s lessons outside MyWavePlan can still join the adult pilot; do not advertise those classes as bookable here until supported.
2. **F11 guardian bookings:** an adult account books for a child with a private participant record. No child email or login required. Deliver this early after stable adult booking, before promoting MyWavePlan as supporting children’s lessons. If a chosen pilot school needs child bookings on day one, F11 becomes a launch prerequisite for that school.
3. **Optional F11 teen account stage:** ages 16–17 may have their own forecast/preferences account and controlled access to their own lesson details. Guardian authority for booking/payment is separately checked. This is not approved for the first pilot. Reassess support needs, age assurance and applicable countries before enabling.

This is a product policy recommendation, not a claim that GDPR requires all users to be 18. Portugal’s Law 58/2019 Article 16 sets 13 for the specific consent-based online-services situation; that does not establish general contractual capacity or remove safeguards for minors. Review local contract, safeguarding and school-insurance requirements before the child flow launches. [Portuguese law](https://diariodarepublica.pt/dr/detalhe/lei/58-2019-123815982), [EDPB children’s safeguards](https://www.edpb.europa.eu/topics/key-gdpr-concepts/children_en).

## Parent booking journey

The adult signs in, selects a class and chooses “For me” or “For my child”. For a new child, collect their name, the minimum age information needed for the class and a structured surf level if relevant. Show the school, lesson, participant, authorised collection arrangements and cancellation terms before confirmation. Record guardian authority and versioned school participation approval. The adult receives confirmations and manages changes and payment.

One parent booking two children consumes two seats. Show a clear per-participant price, capacity and cancellation result. A mixed adult/child family booking must identify every attendee; paying for a group must not grant access to unrelated participants’ profiles.

School administrators see the roster and required guardian contact. Assigned instructors see only the participants and safety/contact details needed for their session. Neither role gets a child’s activity at another school. Private notes must not become public reviews or marketing data.

## Data model direction

Use participant records independently of login accounts. The existing `students.user_id` assumes a school customer link; do not put the parent’s user ID or email on multiple child student records and treat them as the same person. Migrate deliberately while preserving existing adult bookings.

| Proposed record | Purpose and boundaries |
| --- | --- |
| `participants` | Person attending a lesson: opaque ID, name, minimal age evidence, optional account link and lifecycle status. An adult account can be linked to its own participant; a child participant may have no account |
| `guardian_relationships` | Adult account ↔ participant, relationship/authority assertion, verification method/status/time and revocation. Multiple guardians require a verified invitation, not matching surnames or emails |
| `school_participants` | Scoped link to the school’s existing customer record, permitted school data and notice version. A school sees only participants linked to its own legitimate bookings |
| Booking purchaser and attendees | Separate `booked_by_user_id` from `participant_id`; a group/order has attendee bookings or a join table with independently capacity-counted attendees. Enforce duplicate/seat checks transactionally |
| `participant_permissions` | Guardian participation approval, scope/school/activity, policy version, time, expiry/withdrawal where applicable; media permission is a distinct optional record |
| Lesson eligibility | Reviewed min/max age, participant type, ability requirement, staffing/guardian-presence rules. Evaluate age for the lesson date, not just today |
| Emergency / authorised collection contact | Minimum name/contact and authority needed for that booking/course; restricted access and short retention. Reuse the guardian contact where sufficient |

Names and age band/age-at-session confirmation are the default minimum. Collect an exact birth date only if reviewed eligibility or insurance rules actually require it. Any age evidence has an as-of date and source; reconfirm when it no longer resolves a class boundary. Do not silently promote someone to an adult account from stale age-band data. Final age-assurance design belongs to F11 review.

Child email, phone, home address, national ID, passport, gender and public photo are not required by default. Do not use generic free-text notes for medical records. If a school needs health/safety information, define the minimum separately, assess the legal basis including special-category conditions, access and retention, and review insurance obligations. A blanket guardian checkbox is not sufficient for every purpose.

## Permissions and safeguarding

- Separate guardian authority, contractual participation approval, privacy-notice delivery and optional media/publication consent. Do not make a photo waiver necessary to book.
- Public search displays class information and capacity only. No child names, attendee lists, exact personal schedules, public child profiles or child leaderboards.
- No direct adult-to-child messaging in the initial child release. Operational messages go to the guardian; future teen messaging needs a separate safeguarding design.
- Guardian A cannot claim a participant or view Guardian B’s details just by knowing a name/email. A disputed relationship restricts sensitive changes and follows a support process; no automatic transfer of authority.
- A teen’s account does not automatically give a guardian access to all private account activity. Define child/guardian rights and school operational access separately, with review for age, maturity and applicable law.
- Withdrawal, cancelled permission or an expired relationship cannot leave an unnoticed active booking. Revalidate before relevant booking/attendance actions and notify the authorised adult/school of the operational effect.
- At adulthood, use a secure participant claim and review inherited guardian access. Retain required historical booking evidence without continuing unnecessary guardian control.
- Guardian account deletion must resolve dependent participants and future bookings through a reviewed process. Do not cascade-delete another person’s records or keep them indefinitely by default.

## Delivery slices and estimates

F11 remains one L-sized roadmap item, delivered in bounded releases:

| Slice | Effort | Touches | Prerequisites / acceptance |
| --- | --- | --- | --- |
| Policy and school discovery | M | Business, Ops, Design | A4/B6, pilot-school interview; age/guardian/safety/insurance rules, role split, retention and DPIA screening reviewed |
| Participant/guardian foundation | L | BE, DB | B2/B8/C3; schema migration, scoped authority, no fake emails, existing adult bookings preserved |
| Guardian booking and school roster | L | FE, BE, DB | C3/C4; children’s class filters, multiple attendees, capacity, cancellation, attendance and private school views; pay-at-school works without Stripe |
| Optional 16–17 accounts | M | FE, BE, DB, Ops | Separately approved scope; B3/B6/B8, age-appropriate notices, restricted capabilities and verified participant/guardian links |
| Online family payments, if enabled | M | FE, BE, DB | E4/E5; adult payer, price/cancellation per attendee, partial refunds and no overselling |

Re-estimate with real schools. Minimum tests include unauthorised claims, cross-family/cross-school reads, expired/revoked guardian links, age boundaries on the lesson date, concurrent last-seat bookings, two-child capacity, cancellation/refund scope, permission withdrawal, account erasure and transition to adulthood. Test mobile booking and access-denied/empty states. Child photos/rankings remain disabled unless separately reviewed and authorised.
