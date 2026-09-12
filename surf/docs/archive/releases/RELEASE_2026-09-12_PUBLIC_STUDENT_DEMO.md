# Temporary public student demo release

12 September 2026. The owner requested empty-field login to a student demo on staging and production and documentation for its eventual removal.

Application commit: `c7ee2c1f9b026d10030caac38834c2291f1877d9`.

| Environment | Verified application deployment | Demo user ID |
| --- | --- | --- |
| Staging | `dpl_7crYgxgPqSNh48FmeMtfjZSMfu7H` | `03685b30-abe4-4b8c-9604-2ccacdae4af6` |
| Production | `dpl_FincCWU95xFjopfSv5wSrriLt6d3` | `28f3e70e-4ed9-471d-b04c-c1d767db918c` |

Both empty fields and Try the demo enter a dedicated student account and open Conditions. The explicit button ignores unwanted autofill. The demo has full forecast access, with read-only API restrictions and no staff/platform authority. Normal passwords and the original teststudent account are unchanged. Partial/invalid credentials do not become demo access. Login inputs now disable autocorrection/capitalisation, and editing clears stale form errors.

Migration `20260912_public_demo` has SHA-256 `9584c326b97822575a0df521e1aaf4d2eac088ab2cbb32c3af1956c91447bbc5`. Full rollback rehearsals and application checks passed on both databases before application. Rehearsal fixtures/sessions were rolled back. The migration preserved existing accounts, customer rows and spot configuration. Each environment now has three active accounts and the same 17 active spots; no forecast calibration or algorithm changed.

## Verification

- All 108 unit/regression tests passed; Node.js 22.23.2 lint and production build passed. The existing avatar-image lint warning remains. No application dependency changed.
- Seven live API groups passed on each environment: secure empty-field login; separate visitor sessions and caller role/identity rejection; 17 spots/16 forecast days; private/staff and mutation denial; per-device logout and global-demo-logout denial; invalid/partial credentials and cross-origin denial; normal teststudent password login.
- Isolated Chrome desktop and mobile contexts passed on both domains: blank form submit, partial validation, demo button despite unwanted autofill, student-only navigation, forecast/calendar/charts, menu, no horizontal overflow, logout and no page errors. Login screenshots were visually reviewed in desktop light and mobile dark mode. Production mobile forecast rendering was also reviewed.
- The first production mobile browser run timed out after 30 seconds waiting for the forecast heading. That run did not capture enough evidence to identify its exact cause. The repeat used a 70-second forecast wait to cover the route's 60-second API budget, captured diagnostics on failure, and passed both contexts. This is not proof that a particular network/provider caused the first timeout.
- Available error/fatal runtime-log scans returned no matches on both verified deployments. This does not capture historical browser errors; A6 browser reporting remains planned. Physical Android/iPhone devices and automatic translation were not tested in this release.
- Live checks revoked their own temporary sessions; all test browser contexts/processes closed. Existing owner browser sessions were not used or replaced by the isolated tests.

Later commits add verification scripts and documentation only; verify application-tree equality when identifying the final deployment. No repeat of the full suite is needed solely for a documentation-only build.

## Recovery and retirement

[Demo lifecycle and exact cleanup scope](../../PUBLIC_STUDENT_DEMO.md) is the maintained reference. Disable Demo student first to stop new and existing public sessions. Before rolling application code back to the preceding release, disable this account because the old code lacks the extra demo read-only checks. The additive schema can remain during rollback. Remove the UI/entry path and dedicated records later through the documented retirement sequence, preserving the owner, teststudent, school and surf spots. This is tracked with B3/C7 readiness.
