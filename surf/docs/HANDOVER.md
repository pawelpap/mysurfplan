# MyWavePlan handover

Updated 6 September 2026. This file records the current handover; dated release notes retain earlier deployment history.

## Current candidate

Conditions presentation and desktop/mobile hourly parity, prepared on `codex/task-oriented-staging` for review at https://staging.mywaveplan.com. The owner must test this candidate and explicitly approve production before promotion. Approval of previous releases is not approval of this one.

Production currently runs `1938804611fb66c1a70db919b0f48fe6cdb1f5fa`, Vercel deployment `dpl_2vqrj9acaPkMH33Mn2TLtAZuBHRG`. It already includes generic database calibration, offshore energy density in kJ/m², estimated power in kW/m and water temperature in °C. Keep these measures; the owner declined a speculative conversion to Surfline's kJ scale.

Candidate changes:

- Uniform presentation of quality, experience and physical parameters, including the earlier staging-only equal-emphasis proposal.
- Desktop hours expand from the time/chevron button. Mobile hours expand from the summary. Both use the same details component, including all available swell partitions, energy, power, water, gusts, tide, weather and reasons.
- Tide/time selection precedes selected-time values. First light, sunrise, sunset, last light and tide extremes remain available. Selected-time gusts and tide stage/trend are visible.
- Less repeated wording and fewer nested boxes. Swell components and the forecast guide use unfilled disclosure rows. Missing data, forecast uncertainty and assessment reasons are retained.
- Native dropdown chevrons have an inset. The shared spot-list API sorts names alphabetically, ignoring case and accents, with deterministic ties. Conditions and lesson selectors consume this list. The obsolete priority field is removed from the editor; stored priorities are preserved.
- Spot editing and calibration settings/history remain platform-admin-only. Direct editor URLs show a denial to other roles, and API write protection remains enforced independently of the UI.

No migration, calibration change, forecast-model change or business-record copy is required for this candidate. The forecast response continues to include the calibration needed for client-side selected-time calculations; this is not an admin editing endpoint.

## Verification and next action

Local verification passed: 37 automated tests, including 5,712 calibration parity cases; production build; browser checks at all five widths; identical hourly details on desktop and mobile; native horizontal touch selection and keyboard time selection; student, instructor, school-admin and legacy-admin denial; and platform-admin editor/history access. Staging custom-domain verification remains the deployment gate.

Run `npm test` and `npm run build` in `surf`. Browser review covers 1440, 1024, 768, 390 and 320 px; hourly value parity; dropdown order/inset; chosen time; 16 days; full-day hours; missing future temperature; lesson conditions; and role permissions. Temporary role sessions are used only against the local build; live testing uses the authorised student and platform-admin accounts. Do not commit credentials or browser session files.

Publish only to the `staging` Git branch, wait for the staging project's ready deployment and verify its custom domain. Confirm the production alias still resolves to its baseline deployment. Tell the owner staging is ready and wait for explicit approval.

After approval, deploy the accepted code through `main` to `mywaveplan-prod`, verify production and update this handover, the development plan, staging guide and release notes with the exact commit/deployment IDs. Do not overwrite either database to synchronise a presentation-only release.

Environment IDs, rollback resources and local setup are in [Staging environment](README-staging.md). The [development plan](DEVELOPMENT_PLAN.md), [design review](UX_AUDIT_2026-09.md#conditions-presentation-review-6-september-2026), [algorithm](CONDITIONS_ARCHITECTURE.md) and [spot schema](SPOT_DATA_MODEL.md) contain the detailed decisions.
