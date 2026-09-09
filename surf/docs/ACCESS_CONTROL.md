# School access and response privacy

Maintained A1/B2 reference, 9 September 2026. [Docs index](README.md) · [Roadmap](IMPLEMENTATION_ROADMAP.md) · [Membership runtime](MEMBERSHIP_AUTHORISATION.md).

## Current account model

Every private request reads the current database-backed global identity and school relationships. Active memberships have independent administrator/instructor roles; ownership and platform authority are separate. Browser-selected school IDs, roles and email addresses cannot grant access. The B1 compatibility bridge is retired and historical user role/school fields no longer grant staff authority. New accounts may have no school.

A suspended or removed membership affects staff access at that school. It does not disable the person's global login, personal bookings or another school's membership. Closed/deleted schools grant no operational capability, including to platform operators through normal school routes. Explicitly linked personal booking history remains accessible when the school closes. Soft-removed lessons are excluded from normal lists.

School administrators manage school access and operational records. Only platform administrators can manage global accounts, credentials, email or global status. Account disabling/deactivation revokes sessions. Ownership and self-demotion protections are enforced in the database, not just in the interface.

## Current route permissions

| Route/action | Required authority and scope |
| --- | --- |
| `GET /api/schools` | Public directory with business details only. |
| School creation/edit/removal | Platform administrator. Future owner setup/closure is B5/B8. |
| `/api/users`, `/api/users/[id]` | Platform administrator only. Own global deactivation/demotion and disabling an active owner are protected. |
| `/api/memberships` | Administrator/owner of the selected open school, or platform administrator. Existing access may change; only the platform can add an unaffiliated account until B4 invitations. |
| `GET /api/coaches?school=` | Valid school context; ordinary personal/instructor views return names/IDs. School/platform administrators can see operational contacts. |
| Instructor record creation/removal | Administrator of that open school or platform administrator. |
| `GET /api/lessons?school=` | Valid open-school context. Ordinary personal accounts see their own attendee details; instructors see assigned lessons/rosters; school administrators see school lessons/rosters. Combined roles retain both capabilities. |
| `GET /api/lessons?scope=bookings` | Signed-in person's explicitly linked bookings across schools, including closed-school history. |
| `GET /api/lessons?scope=teaching` | Active instructor memberships plus explicit assigned instructor records across open schools. |
| Lesson creation/edit/removal and instructor assignment | Administrator of the selected open school or platform administrator; instructors must belong to that school. |
| Personal booking/cancellation | Identity derived from the signed-in user. Current booking requires an eligible open-school context; own cancellation remains possible after school closure. |
| Staff booking-on-behalf/cancellation | Explicit `onBehalf` operation; school/platform administrator or active assigned instructor. The current roster-editing UI remains administrator-only. |
| Lesson conditions | Own explicitly linked booking, otherwise valid school context; an instructor-only role also requires assignment. |
| `GET /api/public/lessons` | Public future schedule for a published/open school; no attendee data. |
| `GET /api/spots`, `GET /api/conditions` | Signed-in global account; no school required. |
| Spot writes and `/api/calibration` | Platform administrator only. |
| `/api/auth/session` | Own session, single-session logout or own global logout; anonymous callers get a null session. |
| `/api/auth/login` | Rate-limited credentials, compatible existing username/email login. |
| `/api/auth/bootstrap` | Deployment token and empty-user-database prerequisite, checked transactionally; not enabled as public signup. |
| `/api/health` | Public connectivity status only. |
| Former `/test/*` pages | 404. |

All mutations retain origin verification. Authenticated responses use `private, no-store`. Resource IDs and school context are checked on the server. Malformed identifiers receive safe validation errors; raw database details do not enter HTTP responses.

## Data and booking identity

Public school/schedule payloads include published business contact details, instructor names and aggregate availability. They do not contain personal credentials, instructor email or attendee rosters. School membership payloads contain names, roles, status and owner indication, without email, login timestamps or global account status.

Personal attendee access requires an explicit `students.user_id` link. Email-only legacy claims have been removed. Self-booking derives identity and account details server-side and reuses the customer record for that school even after an email change. An unclaimed conflicting record requires the future verified B4 claim flow. Separate locked capacity checks prevent simultaneous bookings exceeding a lesson's capacity; repeated personal booking is idempotent.

The owner authorised a one-off test-data cleanup after B2. Both environments retain the owner’s platform account, `teststudent`, Demo Surf School and its explicitly linked customer record, with no disposable lessons or extra people. The shared account remains a personal/student account with no staff/platform authority. This cleanup is not a general account-erasure feature.

## Verification and maintenance

[Capability tests](../tests/membership-access.test.mjs), [database checks](../scripts/check-membership-authority-schema.mjs), [deployed API checks](../scripts/check-membership-release.mjs) and [browser checks](../scripts/check-membership-browser.mjs) cover B2. The older A1/B1 release scripts exercise the retired authority model and must not be used against an activated B2 database.

The current release runner requires an explicit verified environment, creates uniquely identified fixtures and removes them in `finally`. It also revokes its own shared-account test sessions. Browser contexts are isolated and closed. Record deployments, checks, cleanup and limitations in the [handover](HANDOVER.md). Existing deactivation/removal controls and the remaining UI work are documented in the [account/lifecycle follow-up](ACCOUNT_AND_LIFECYCLE_UX_FOLLOWUP.md).
