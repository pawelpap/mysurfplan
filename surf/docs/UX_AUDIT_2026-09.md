# MyWavePlan UX and development audit

Reviewed on 5 September 2026. Scope: repository source and plans, authenticated production and staging workspaces, public school schedules, Figma designs, GitHub configuration, Vercel projects and Neon schemas. This is a product and code review, not a penetration test.

## Main finding

The app mixes finding, creating and editing records on the same page. Users must work out which part of the screen belongs to their current task. The strongest improvement is to give each task a distinct screen with a clear heading, one primary action and a route that survives reload and browser navigation.

The existing Figma board already described more focused screens than the implementation. The September proposal makes this separation explicit. The user has chosen the running staging app as the place to review the proposal.

## Observed UX problems and the staging response

| Finding in the previous app | Consequence | September proposal |
| --- | --- | --- |
| Large Add lesson form above the schedule; first lesson automatically selected with its details alongside the list | Users cannot scan a schedule without navigating around unrelated controls | List first; separate Add lesson, lesson details, Edit lesson, Assign instructors and Bookings screens |
| Historical lessons appear first | An old lesson looks like today's operational priority | Upcoming by default; separate Past view sorted most recent first |
| People creation and profile editing appear together | Unclear whether fields create someone or change the selected person | Searchable list, explicit person details, separate create and edit forms |
| School selector at the bottom, using slugs | Users may work in the wrong school without noticing | Human-readable school selector near the top and repeated school context above the content |
| Screen selection only in component state | Reload and browser Back lose the workflow | Query-based routes preserving school, view, record and lesson period |
| Weak form labels and crowded layouts on small screens | Harder keyboard use and mobile entry | Associated labels, visible focus, single-column forms, mobile navigation with Escape and focus handling |
| Operator credentials can autofill the create-user form | Risk of accidentally creating an account with the wrong details | Account creation has explicit field labels and new-password autocomplete |
| Public schedule can include old lessons; booking links lose the chosen lesson after login | Students must find the lesson again or try to book an expired session | Future-only public API, full/past states and a login return route to the chosen lesson |
| Fake forecast values and placeholder actions appear operational | Users cannot distinguish available functions from concepts | Remove the mock conditions screen, TBC lesson badges and inactive upload controls from this proposal |
| “Attendance” is actually a list of bookings | The label promises a capability the database does not have | Call the existing task Bookings. Real attendance remains a planned feature |
| Lesson core details and capacity cannot be edited | Owners cannot correct a meeting point, time or class size | Validated lesson update API and a dedicated edit form |

## Screen map

- Lessons: browse Upcoming or Past; students also have My bookings. Search by meeting point or instructor and filter by level.
- Lesson details: read the date, time, duration, meeting point, level, booking count and instructors.
- Edit lesson: update the core details and capacity.
- Assign instructors: select instructors for that lesson.
- Lesson bookings: inspect the register. Admins can add and cancel bookings through separate actions.
- People: find login accounts by name, email and role; open details, then edit or deactivate.
- Schools: platform admin list, details, creation and editing. Open a school's lesson schedule or public page.
- My profile: inspect account details. Admins can reach their account editor; self-service for other roles remains planned.
- Public schedule: choose a future lesson, review it and log in to book using an existing school account.
- Login: email and password, with a preserved return destination and honest help for account creation/reset.

No calendar, metrics dashboard, fake forecast, payment interface or registration form is being presented as implemented.

## Access and deployment readiness

| Resource | Result |
| --- | --- |
| Local project and GitHub | Read access verified; repository `pawelpap/mysurfplan`; GitHub push permission confirmed |
| Vercel | Both projects accessible; root directory `surf`; staging project's production branch is `staging`, production project's is `main` |
| Neon | Staging and production branches accessible; core schema inspected using read-only queries; staging connection available for development |
| Figma | Existing designs readable and editable; September page marked CURRENT and June page marked ARCHIVE |
| Live app | Production and staging login tested with the account supplied by the user; public schedule checked on desktop and at 390 px width |

The staging Neon branch was shown as idle/archived before access, but SQL and the application worked. This is not evidence of a broken database.

Figma file: https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ

- Current: `CURRENT - Task-oriented UX - September 2026` (page `309:2`).
- Previous: `ARCHIVE - Previous app design - June 2026` (page `20:2`).
- The Figma page is a design reference. Staging is the working proposal and review target.

## Remaining functional and security work

These findings should be addressed before expanding real customer use. They are not all fixed by a UI proposal.

1. **Instructor accounts are not linked to teaching profiles.** Creating a user with role `coach` does not create or link a `coaches.user_id` record. The inspected production coaches had no user links. Assigned-lesson visibility depends on this link. Add a migration/repair workflow and atomic account/profile synchronisation.
2. **Authentication needs hardening.** The code permits a development fallback secret in any environment, does not enforce session age on the server, does not set Secure on HTTPS cookies, and does not revoke existing sessions when an account/password/role changes. Configuration values were not exposed in this report. Review the real configuration and add explicit server-side enforcement, rate limiting and session revocation.
3. **Attendance is absent.** The schema stores booked/cancelled bookings, not attendance states. Design present/absent/no-show rules and instructor permissions before implementation. The old booking API also permits assigned instructors to create and cancel bookings, contrary to the documented attendance-only direction; the proposal hides these admin controls for instructors, but API permission changes still need a dedicated pass.
4. **Student registration and school memberships are absent.** Existing students can log in and book within their current school. Immediate registration, membership requests and school approval are still required.
5. **Booking integrity needs concurrent integration tests.** The existing booking query checks capacity and uses a lock, but a UI check is not proof of correctness under simultaneous requests. Verify duplicate booking, reactivation, simultaneous last-place bookings and concurrent capacity changes.
6. **Profile work remains.** Self-service editing for all roles, secure image upload/storage and password reset delivery are not implemented. Session profile values may remain old until the next login after an admin edit.
7. **Privacy needs a wider endpoint review.** This proposal filters student lesson attendees to the signed-in student and removes instructor emails from public lesson responses. Authenticated coach directory responses and all other role-specific data need a separate minimisation review.
8. **Forecasts and payments require real integrations.** Choose sources, spot models, refresh rules and failure states for conditions. Payment requirements should include cancellation/refund policies before UI work.
9. **Other technical debt remains.** Public test playground routes, broad API error details, cache headers and full API integration tests need cleanup. The proposal replaces the runtime Tailwind CDN with local CSS and declares the Neon dependency directly.

## Verification record

- Baseline production build passed before changes.
- Six focused validation tests cover dates, duration, capacity, instructor IDs, lesson availability and login return destinations.
- The final application build passed with Node.js 22 and was deployed to staging as `5c7e944`. Desktop and mobile browser checks passed for the illustrated login and principal admin lesson, booking and person-editing tasks. Public schedule filtering passed without browser errors. Detailed results and coverage limits are recorded in DEVELOPMENT_PLAN.md.
- The staging label has been removed. The original surf illustration and logo are restored in the responsive login design. Mobile navigation, lists and forms were checked at 390 × 844.
- Production data was inspected through aggregate/schema reads. Proposal testing uses staging; no production mutation or deployment is authorised before user review.


## Conditions presentation review, 6 September 2026

The current Conditions screen was reviewed against the workspace design and the owner's requirement to preserve all forecast parameters with equal visual emphasis.

| Finding | Change in the staging candidate |
| --- | --- |
| Desktop hours lack mobile's swell components, estimated power and assessment reasons | One shared detail component, opened by the desktop time/chevron or mobile hour summary. All available partitions remain visible within the expanded hour. |
| Time selection sits below the values it controls | Move the interactive tide graph before the selected-time metrics. Keep keyboard and touch operation, daylight events and tide extremes. Include gusts and tide stage/trend. |
| The selected spot name and instructions are repeated | Keep the labelled selector and compact location/timezone context. Remove the duplicate heading and instructional banner. Retain explicit midday labels and the selected time. |
| Supporting information uses several boxes and repeated explanations | Use unfilled disclosure rows for swell details and a single forecast guide. Keep actionable assessment reasons, missing-data notices and forecast uncertainty. |
| The native select arrow sits against the field edge | Use a 14 px chevron inset and reserve 42 px on the right, retaining the native picker and keyboard behaviour. |
| Priority-based spot order is difficult to scan | Sort the shared API list alphabetically, ignoring accents and case. The lesson and forecast selectors use the same ordering. |
| Spot configuration needs an explicit role boundary | Platform admins alone see the controls and editor. Direct editor URLs deny other roles. Verify the separate API guards for writes, settings and history. |

Retain the existing Poppins typography, sea-colour actions, neutral surfaces, border radii and spacing language. Quality, experience, energy and water remain visually consistent with the other metrics. Selection/focus styling identifies interactive state. No forecast formula or spot calibration changes are part of this review.

The candidate is for staging review. Production promotion requires the owner's explicit approval after testing.
