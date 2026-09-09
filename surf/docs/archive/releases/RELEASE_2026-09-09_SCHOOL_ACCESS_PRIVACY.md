# School access and response privacy release

Dated evidence, 9 September 2026. [Current handover](../../HANDOVER.md) · [Current access rules](../../ACCESS_CONTROL.md) · [Roadmap](../../IMPLEMENTATION_ROADMAP.md).

## Released change

A1 is complete for the existing single-school account model. Students receive their own attendee record and instructor names/IDs. SQL filters private lesson data before it leaves the database and restricts instructors to assigned lessons. Same-school, active-person joins exclude inconsistent foreign-school relationships. School-admin user filters and mutations enforce the session school and cannot grant platform authority. Booking names for students come from the session; a legacy student record linked to another user cannot be claimed through email.

The public school directory retains its published business contact email for the Contact school link. Public schedules retain times, places, instructor names and aggregate availability. Internal school timestamps and private contact details are excluded. Database errors no longer return SQL/connection details. Old `/test/*` playground pages are removed. Existing authorised management, booking and forecast flows remain available. No visual redesign was necessary to accommodate the response changes.

The release also saves the requested documentation organisation, current roadmap and accepted planning references. Historical plans, handovers, releases and calibration evidence are retained under archive; the docs index and concise handover identify the current documents.

## Deployments

Runtime commit: `9c96b5fc76f51153f6081da62b9ee788915b04e7`.

| Environment | Deployment | Verified custom domain |
| --- | --- | --- |
| Staging | `dpl_81dZvnSnJuEY4awz6dsccEhLPtg1` | [staging.mywaveplan.com](https://staging.mywaveplan.com) |
| Production | `dpl_3rByNTGo2PX76qZciHCXLTA4gKwc` | [mywaveplan.com](https://mywaveplan.com) |

Both deployments reached READY from their respective `staging` and `main` Git branches. Production followed successful staging access and responsive checks, under the owner's conditional release authorisation. The owner then requested an additional nearest-location check while the production build was already in progress. That build completed before it could be paused. This timing was reported, and the additional location checks subsequently passed on both environments. Documentation-only follow-up commits do not change the runtime implementation above.

No database schema migration, whole-database synchronisation, calibration change, account reset or provider-setting change was required. Existing staging and production databases remain independent. No new Neon branch was created and no existing branch was deleted.

## Verification

- 81 Node regression tests passed, including four new access/privacy tests. Forecast calculation, calibration, energy, water temperature, tides, time handling, theme, session and request-security tests remain green.
- Production-mode Next.js build passed. Removed playground routes are absent from the build and return 404 on both domains.
- The [real API/database release script](../../../scripts/check-school-access-release.mjs) passed 12 scenarios on isolated rehearsal branch `br-morning-glade-adu8v769`, staging and production. Scenarios cover anonymous requests; two-school filter/ID tampering; platform-only operations; assigned/unassigned instructors; own-student booking; private/public payload fields; deliberately inconsistent legacy links; malformed inputs; lesson edit/cancel/rebook; shared demo forecasts; health/login and removed routes.
- Disposable fixtures used two schools and eight accounts per run. Cleanup uses exact recorded IDs and unique run names, runs after failures as well as success, and leaves normal expiring login counters intact. Post-release checks in each deployed database found five active users, seven active schools, 17 active spots, zero remaining A1 test schools/users and zero cross-school instructor/booking relationships. These counts matched the pre-test baseline.
- The real staging student UI passed login, Conditions, Lessons, lesson details/conditions and mobile navigation checks. At 390 px, page width matched the viewport without horizontal overflow. No browser runtime errors were reported. School/spot administration controls were absent for the student.
- Independent browser tests on staging and production used simulated Bico and Praia Grande coordinates, at 1440 px and 390 px. Each fresh visit automatically selected the nearest spot. All 17 options matched an independently computed distance order. A–Z switching, retrying Nearest to me, preserving manual Carcavelos selection and prioritising an explicit Bico link all passed. Staging's denied-location path displayed the explanatory fallback and A–Z order. The first automation session's conflicting viewport controls were replaced with one independent runner before accepting the result. Real-device GPS accuracy was not measured.
- Error/fatal runtime log queries returned no matching entries for each runtime deployment during the verification window. This is a bounded release check, not a claim that future errors are impossible.

Temporary browser sessions/tabs, viewport overrides and the local rehearsal server are cleaned up after verification. User-opened Chrome/Surfline tabs are preserved. Private connection/session files are not committed.

## Limits and next task

This is a bounded access/privacy repair, not the full launch security or GDPR programme. Current accounts still have one school and one role. School admins still manage school-bound account credentials/status; independent owner/admin/instructor memberships and global personal identity remain B1/B2. Email matching remains only for unlinked legacy attendee records. Those records and database relationship constraints must be reconciled during the planned membership migration. Booking-concurrency improvements remain C3. Demo records must remain separate from real customer operational records.

A2 is next: review Next.js 14.2.3 and dependencies, choose a supported security baseline and release a separately tested compatible upgrade. A3's authentication decision and A8's EU location decision can proceed alongside it. Localisation and EU migration were not implemented in A1.

## Rollback

The previous Git revision is `62ef1a795b24ba77e46d86bee6d2c097e23ee24d`. Its staging deployment was `dpl_5SBHYyFtCxmqShbJWZX6KAtEoss4`; production was `dpl_DewzRvnTGzJKbsZxcMPhiJNH5QW9`. Verify those targets before any rollback. There is no schema change to reverse; never restore a database as part of this code rollback. Rolling back reintroduces the privacy gaps and test routes, so prefer a bounded forward fix unless service recovery requires rollback.
