# Email jobs foundation, 13 September 2026

Status: deployed and verified on staging and production. Runtime commit `dca3869fb7b31a46d68fd22114693d3e9fac37b5`. Sending and scheduling remain disabled by owner decision until registration readiness.

Scope: additive queue schema, bounded worker, untracked Mailjet adapter, authenticated/deduplicated callbacks, quotas, encrypted payloads and branded Support email shell. There are no changes to existing app UI, forecasts, login/session rules or business records. The only allowed template is an operator delivery check; B3 registration is not implemented by this release.

Verification so far: 13 real PostgreSQL queue scenarios passed on the isolated Frankfurt rehearsal branch. Temporary fixtures were removed and no external email was sent. All 119 automated regression tests and the final production build passed. The only lint warning is the existing image-element warning in `components/workspace/ui.js`.

Migration ID: `20260913_email_outbox`. Checksum: `d5322fee60dc5eec5d6a7dec722be6647b65b44ccf7183c6f65da187163614a8`. Migration DDL rollback was tested before applying to rehearsal, staging and production. Separate database environment bindings are intentional.

Outstanding activation: Mailjet API credentials are absent from both live Vercel projects; staging sender/subaccount isolation and actual account quota require verification. Real inbox rendering/delivery, authenticated provider callbacks, independent operational alerts, key recovery/retention review and minute scheduling remain before real registration. The owner will upgrade Vercel when registration needs the worker. This release does not complete the broader A6/A7 milestones.

See the [operations and activation runbook](../../EMAIL_JOBS_RUNBOOK.md).

## Live verification

- Staging deployment `dpl_BAKTMhC2iHidDW5218NRpEqEcC6P` and production deployment `dpl_8wAgSP1wRoLWpiau2CxYxcfa4WVt` are Ready, with the correct domains and `fra1` functions. Both are built from the same runtime commit.
- Each environment passed seven API test groups: empty-field student demo access, independent sessions, 17 spots/16-day forecast, staff/private and mutation denial, logout isolation, invalid/cross-origin login denial, and normal teststudent login. Test sessions were revoked.
- All three new endpoints return `503 email_disabled`; existing health returns 200. Both databases contain zero jobs and 17 active spots; environment bindings are deliberately different. No existing business records were changed by the additive migration.
- Staging Conditions was checked in the browser at desktop and 430 × 932 viewport sizes. Tiles, colour coding, charts and mobile menu remain as before. Chrome nearest-distance ordering was verified after reload; the in-app browser correctly falls back to A–Z when location is denied. No precise location was added to logs/docs.
- Production Conditions loaded its forecast, surf/energy and tide charts and water temperature in the browser with no captured console errors.
- The shared email template includes the existing public logo, escaped copy, plain text and disabled tracking. Actual received Mailjet email rendering/delivery is not yet verified. Browser policy blocked opening the local HTML preview, so no workaround was used or visual email-client pass claimed.

Next task: A4/B6 legal pages and versioned acceptance, then A9/B3 prerequisites and registration. C5 cookie/analytics consent must precede C6 tracking; optional tags remain disabled. This release changes no legal text or consent flow.
