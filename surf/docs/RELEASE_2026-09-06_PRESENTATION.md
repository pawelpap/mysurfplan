# Conditions layout, appearance and nearest spots

Released to production on 6 September 2026 after the owner tested staging and explicitly approved deployment. The same approved application runs in both environments. A documentation-only follow-up records completion and keeps `main` and `staging` together.

## Release references

| Reference | Value |
| --- | --- |
| Approved Git revision | `2ea5905753a321c3c8a9c5854826a19e1ee26646` |
| Application changes | `48b3a49` and `d1ddea8` |
| Verified production deployment | `dpl_AfTvG9kcZfHKp3xY1s31VeYnZTH9` |
| Approved staging deployment | `dpl_3SfVt7LagQnZyeKMFm3T8ja2y5su` |
| Full staging application verification | `dpl_FdtZhk6qH5oNi8WND2qcsiVF9JkD` |
| Previous production commit | `1938804611fb66c1a70db919b0f48fe6cdb1f5fa` |
| Previous production deployment | `dpl_2vqrj9acaPkMH33Mn2TLtAZuBHRG` |

Production: https://mywaveplan.com, Vercel project `mywaveplan-prod`. Staging: https://staging.mywaveplan.com, Vercel project `mysurfplan-staging`. Both use the Next.js application in `surf/`.

## Released behaviour

- Desktop hourly rows and mobile cards open the same details, including all available swell components, energy, power, water temperature, wind gusts, tides and weather. Selected-time values follow the interactive tide graph, which appears before the metrics.
- Forecast presentation has consistent value sizes, compact disclosures and less repeated text. Spot selection has an inset native chevron. Spot settings, configuration and history remain restricted to platform admins, with independent API protection.
- Appearance offers System, Light and Dark across the workspace, login, public schedule and legal page. System follows the device. A saved browser preference is applied before paint, synchronises across tabs and remains usable in memory when storage is blocked. Staging and production have separate browser preferences because they are different origins.
- Daily forecast tiles have subtle green, yellow, orange or red fills, readable quality labels and a separate selected-day outline. Missing assessments remain neutral. Required experience stays independent of surf quality. Energy and water retain the same visual emphasis as other physical parameters.
- The shared Conditions/lesson spot picker defaults to Nearest to me and requests browser location when it first opens after login. Approximate straight-line distances use a worldwide great-circle calculation. A–Z remains available and is the fallback when location is blocked or unavailable. Switching sort preserves the selected spot. Retries update location; late responses cannot override a switch to A–Z. Coordinates stay in browser memory and are not stored or sent to app APIs.

## Verification

The approved source passed 44 automated tests and the production build, including the existing 5,712 calibration parity cases. Local and staging browser checks covered appearance defaults, live device changes, saved overrides, tab synchronisation, blocked storage, pre-hydration and no-JavaScript fallback, text contrast of at least 4.5:1, location errors/retries and late-callback cancellation.

Production verification passed at 1440, 1024, 768, 390 and 320 px. It covered student login through the UI with Conditions shown first; 17 database spots; 16-day forecasts and real water-temperature data; nearest and alphabetical ordering; selection preservation; both themes and distinct tile fills; exact desktop/mobile hourly detail parity; keyboard and native touch tide selection; lesson forecasts; public schedule; student denial of spot editing and calibration endpoints; and platform-admin spot/lesson forms.

Location checks used synthetic coordinates in isolated browser contexts. No lessons, bookings, users, spots or calibration values were created or edited. No browser exceptions or 5xx responses were observed. A deployment-scoped Vercel query found no error/fatal log entries between deployment readiness and the end of verification. This is a release-time check, not continuous monitoring.

## Database and rollback

No migration, database copy, calibration adjustment or forecast-model change was performed. Production remains on Neon branch `br-weathered-silence-adp30k9s`; staging remains on `br-small-salad-adx0nsj2`, in project `shy-paper-68550619`. The databases are independent and can accumulate different business records, login metadata and forecast caches.

To roll back this presentation release, redeploy the previous production application reference above through the normal release process while retaining the current production database. Do not restore an old database or overwrite newer business activity to roll back UI code. Review subsequent application changes before resetting a Git branch or deployment.

The owner approval completes this release only. Future work must be deployed and verified on staging, then explicitly approved before production. Current operating instructions are in [the handover](HANDOVER.md) and [development plan](DEVELOPMENT_PLAN.md).
