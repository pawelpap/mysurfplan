# MyWavePlan handover

Updated 6 September 2026. This file records the current handover; dated release notes retain earlier deployment history.

## Current candidate

The conditions-layout, appearance and nearest-spot candidate is deployed and verified at https://staging.mywaveplan.com. Application commit: `d1ddea8be969783f88eee4b2cb2609cd892e94c4`; verified deployment: `dpl_FdtZhk6qH5oNi8WND2qcsiVF9JkD`. A documentation-only follow-up records the verification without changing application code. This includes the earlier layout review from `48b3a49`. The owner must test this candidate and explicitly approve production before promotion. Approval of previous releases is not approval of this one.

Production currently runs `1938804611fb66c1a70db919b0f48fe6cdb1f5fa`, Vercel deployment `dpl_2vqrj9acaPkMH33Mn2TLtAZuBHRG`. It already includes generic database calibration, offshore energy density in kJ/m², estimated power in kW/m and water temperature in °C. Keep these measures; the owner declined a speculative conversion to Surfline's kJ scale.

Candidate changes:

- Light, Dark and System appearance across the workspace, login, public schedule and legal page. System is the default and follows live device changes. The Appearance selector is in the workspace sidebar/mobile menu and public page headers. An early head script applies saved preferences before paint. The per-origin preference is stored in localStorage, synchronised across tabs and works in memory if storage is blocked.
- Surf quality has green/yellow/orange/red text and dots, plus subtly tinted daily tiles. The selected day retains a separate outline. Missing assessments stay neutral. This supersedes the earlier request to remove all quality colours; metric sizes remain consistent and required experience is independent of quality.
- Desktop hours expand from the time/chevron button. Mobile hours expand from the summary. Both use the same details component, including all available swell partitions, energy, power, water, gusts, tide, weather and reasons.
- Tide/time selection precedes selected-time values. First light, sunrise, sunset, last light and tide extremes remain available. Selected-time gusts and tide stage/trend are visible.
- Less repeated wording and fewer nested boxes. Swell components and the forecast guide use unfilled disclosure rows. Missing data, forecast uncertainty and assessment reasons are retained.
- Native dropdown chevrons have an inset. The shared spot-list API sorts names alphabetically, ignoring case and accents, with deterministic ties. Conditions and lesson selectors consume this list. Their shared browser picker defaults to Nearest to me when it first opens after login. It requests browser location automatically, displays approximate straight-line distances and sorts globally by great-circle distance. A–Z remains selectable and is the fallback for denied, unavailable or timed-out location. Clicking Nearest to me retries/updates location; switching to A–Z ignores late callbacks. Sorting preserves the selected spot. Coordinates and sort mode stay in memory across SPA navigation and reset on reload; coordinates are not stored or sent to app APIs. No location is requested on login or public pages without a spot picker. The obsolete priority field is removed from the editor; stored priorities are preserved.
- Spot editing and calibration settings/history remain platform-admin-only. Direct editor URLs show a denial to other roles, and API write protection remains enforced independently of the UI.

No migration, calibration change, forecast-model change or business-record copy is required for this candidate. The forecast response continues to include the calibration needed for client-side selected-time calculations; this is not an admin editing endpoint.

## Verification and next action

Local verification passed: 44 automated tests, including 5,712 calibration parity cases; production build; browser checks of device defaults and live changes, explicit appearance overrides, persistence and tab sync, blocked storage, pre-hydration/no-JavaScript theme fallback, text contrast of at least 4.5:1 on standard and tinted surfaces, desktop/mobile layout, touch tide selection, public schedule, lesson conditions and admin forms. Location checks use synthetic browser coordinates and cover automatic startup, global ordering, A–Z, selection preservation, reload, no coordinate storage/transmission, permission denial, timeout, unavailable APIs, retries and late-callback cancellation. The same appearance and location checks passed on the staging custom domain. Desktop/mobile review includes 1440, 1024, 768, 390 and 320 px; shared lesson/forecast distance order, required spot selection and preservation through sorting; and sort preference retained across SPA navigation. Native touch on the tide chart, public schedule, lesson conditions and admin forms passed. Production was confirmed unchanged at its baseline deployment. Awaiting owner review.

Run `npm test` and `npm run build` in `surf`. Browser review covers 1440, 1024, 768, 390 and 320 px; hourly value parity; dropdown order/inset; chosen time; 16 days; full-day hours; missing future temperature; lesson conditions; and role permissions. Temporary role sessions are used only against the local build; live testing uses the authorised student and platform-admin accounts. Do not commit credentials or browser session files.

Publish only to the `staging` Git branch, wait for the staging project's ready deployment and verify its custom domain. Confirm the production alias still resolves to its baseline deployment. Tell the owner staging is ready and wait for explicit approval.

After approval, deploy the accepted code through `main` to `mywaveplan-prod`, verify production and update this handover, the development plan, staging guide and release notes with the exact commit/deployment IDs. Do not overwrite either database to synchronise a presentation-only release.

Environment IDs, rollback resources and local setup are in [Staging environment](README-staging.md). The [development plan](DEVELOPMENT_PLAN.md), [design review](UX_AUDIT_2026-09.md#conditions-presentation-review-6-september-2026), [algorithm](CONDITIONS_ARCHITECTURE.md) and [spot schema](SPOT_DATA_MODEL.md) contain the detailed decisions.
