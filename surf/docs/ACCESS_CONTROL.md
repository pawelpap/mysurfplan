# School access and response privacy

Maintained reference for A1, 9 September 2026. [Docs index](README.md) · [Roadmap](IMPLEMENTATION_ROADMAP.md) · [Accepted future membership model](REGISTRATION_AND_MEMBERSHIP_PROPOSAL.md).

## Current account model

The deployed account model has one school per non-platform user. Every private request reads the current database-backed session. Browser-selected school IDs, slugs, roles and email addresses cannot grant authority. Legacy `admin` and `platform_admin` are global roles; `school_admin` is scoped to its school. Surf spot/calibration administration requires `platform_admin` explicitly.

The A1 release repaired the existing model. B1 now adds [membership, ownership and invitation storage](MEMBERSHIP_DATA_MODEL.md), while live authorisation remains unchanged. B2 will use global identity and independent roles; B3–B5 will implement registration and invitation/ownership flows. A school admin can still manage school-bound user credentials/status under the current design; this must change before global multi-school accounts are introduced.

## Current route permissions

| Route | Anonymous | Student | Instructor (`coach`) | School admin | Platform admin |
| --- | --- | --- | --- | --- | --- |
| `GET /api/schools` | Public directory | Public directory | Public directory | Public directory | Public directory |
| School creation/deletion and `/api/schools/[id]` | Denied | Denied | Denied | Denied | Allowed |
| `/api/users` and `/api/users/[id]` | Denied | Denied | Denied | Own school only; no platform-role grants | All schools |
| `GET /api/coaches?school=` | Denied | Own school names/IDs | Own school names/IDs | Own school operational contacts | Selected school contacts |
| Coach creation/deletion | Denied | Denied | Denied | Own school | Allowed |
| `GET /api/lessons?school=` | Denied | Own school lessons; own attendee record only | Assigned lessons and required attendee roster | Own school lessons/rosters | Selected school |
| Lesson creation/edit/deletion and instructor assignment | Denied | Denied | Denied | Own school and instructors | Allowed |
| Booking/cancellation | Denied | Own identity, own school | Assigned lesson in own school | Own school | Allowed |
| `GET /api/public/lessons` | Public future schedule | Same public data | Same public data | Same public data | Same public data |
| `GET /api/spots`, `GET /api/conditions` | Denied | Allowed | Allowed | Allowed | Allowed |
| Spot writes and `/api/calibration` | Denied | Denied | Denied | Denied | Allowed for `platform_admin` |
| Lesson conditions | Denied | Own school | Assigned lesson in own school | Own school | Allowed |
| `/api/auth/session` | Null session | Own session/logout | Own session/logout | Own session/logout | Own session/logout |
| `/api/auth/login` | Rate-limited credentials | Same | Same | Same | Same |
| `/api/auth/bootstrap` | Deployment token plus empty-user-database prerequisite | Same prerequisite | Same prerequisite | Same prerequisite | Same prerequisite |
| `/api/health` | Connectivity status only | Same | Same | Same | Same |
| `/test/coaches`, `/test/lessons`, `/test/schools` | 404 | 404 | 404 | 404 | 404 |

The current instructor booking API permits limited operational booking actions on assigned lessons. The present UI exposes roster modification to administrators; this release does not add new instructor controls. B1 can represent independent administrator/instructor combinations in storage; enabling them in runtime/UI remains a B2 acceptance case.

All mutations retain origin verification. Authenticated responses use `private, no-store`. A foreign user ID is indistinguishable from a missing user (404); explicit foreign-school requests return 403. Malformed identifiers return validation errors. Database failure details are kept out of HTTP responses.

## Data returned

- Public school directory: ID, name, slug and the published business contact email used by the public “Contact school” link. No internal timestamps or personal account contacts.
- Public schedule: lesson ID/time/duration, meeting point, surf spot/timezone, level, capacity and aggregate availability, instructor IDs/names. No attendee roster, personal emails or account fields.
- Private lesson list: instructor IDs/names for every role. School admins use the separately authorised instructor/people directory for contact details.
- Students: attendee rows are filtered in SQL to their verified user link, or an unlinked legacy record matching their session email. Another linked user's record cannot be claimed through a matching email. Booking names come from the session for student requests.
- Instructors: SQL selects only assigned lessons, with same-school, active instructor links. Required attendee details are available for those lessons only.
- Joins exclude deleted or foreign-school people even if an inconsistent legacy relationship exists. B1 preserves explicit instructor/customer links and reports incompatible ones; B2 must enforce the new membership relationship at cutover. Aggregate availability still follows the existing booking statistics view.

The shared `teststudent` account has student rights in Demo Surf School. Tests verify that it cannot reach another school's private lessons, people or booking operations, or administer spots. Keep real customer operational records in their own schools. Public school schedules remain intentionally accessible.

## Verification and maintenance

[Unit tests](../tests/school-access.test.mjs) exercise filters, response projections, input validation and safe database errors. [Release checks](../scripts/check-school-access-release.mjs) exercise real login, two test schools, platform/school admins, assigned/unassigned instructors, multiple students, ID/filter tampering, inconsistent legacy links, booking/edit/cancel/rebook, public payloads, demo forecasts and removed routes.

The release script requires an explicit environment and a private connection file whose Neon branch has been verified. It creates uniquely named disposable schools/accounts and deletes only its exact fixtures in `finally`. It retains a private cleanup manifest if cleanup fails. Login counters expire normally. Rehearsal uses the existing isolated branch `br-morning-glade-adu8v769`; no existing branch is deleted to make space.

Run regression tests and build before staging. Repeat deployed API checks and desktop/mobile checks on staging, then production when authorised. Record release IDs, results and any limits in [HANDOVER.md](HANDOVER.md). Forecast calculations, spot calibrations and presentation are outside A1's changes.
