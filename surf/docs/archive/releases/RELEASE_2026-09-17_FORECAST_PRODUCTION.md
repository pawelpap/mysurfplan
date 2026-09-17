# Forecast windows and calibration, production release

17 September 2026. The owner confirmed that staging looked correct and explicitly instructed deployment to production. This approval supersedes the earlier hold for this release. The reviewed code and both calibration changes are deployed and verified on [mywaveplan.com](https://mywaveplan.com).

## Release boundary

- Reviewed source: `26e2a17ca9d524bb090fbe651662b6d365a2b164`, containing application runtime `3032204543a11308766efe148699624466d66bb3`. `main` was fast-forwarded from `04d9c9a8ba15e06406ceae6101154cc391719a34` to the reviewed staging commit.
- Reviewed staging deployment: `dpl_HgyNkngQNx4QHupvBfaQTBWwSNza`, project `mysurfplan-staging`.
- Verified production runtime deployment: `dpl_BL3VeqBzsef2vabxafFRf2f9aQWG`, project `mywaveplan-prod`, READY with the `mywaveplan.com` alias. Node.js 22 and Frankfurt application functions remain in use. Later documentation/verification-script commits leave the reviewed application unchanged.
- Production migration committed at 11:55 UTC after a successful rollback rehearsal. The additive archive schema, general profile v2, 17 small-wave revisions and the two subsequent São Pedro revisions were applied in one transaction. Staging and production retain separate accounts, sessions and operational data; no database was cloned.

## Shipped behaviour

The [small-surf/window release](RELEASE_2026-09-17_SMALL_WAVE_STAGING.md) permits favourable clean small surf through database size-ceiling settings across all 17 spots. Cornélia and São João share the reviewed directional-spread adjustment while keeping their distinct local settings. Flat, wind, tide, period, minimum-swell, severe-weather and experience rules remain in force.

Top spot cards, All spots and day tiles use each selected day's best complete one- or two-hour daylight window. The compact time label and existing design remain. Clicking selects the same detail view below at the window start. A current-day window can already have passed. Colour describes the labelled window, with the weakest sampled hour controlling its conditions.

The [São Pedro trial](../calibration/SAO_PEDRO_DIRECTION_REVIEW_2026-09-17.md) is applied to Bico revision 8 and Bafureira revision 7. Their database exposure curves admit sheltered GFS 285–300° swell and taper strongly towards 310°. Raw bearings, provider selection, the shared evaluator and break-specific rules remain unchanged. This is a provisional assumption, not a measured universal offset from Surfline.

Fresh forecasts are sampled before their valid time, once per six-hour slot/spot/engine/calibration revision, with immutable snapshots and 90-day request-driven retention. Provider issue time remains unavailable and is recorded as null. No historical forecast was reconstructed and no cron was introduced.

## Verification

All 137 tests pass. Both operational scripts pass ESLint. Vercel completed the production build; the existing avatar-image lint warning remains assigned to B7.

Production API checks covered Cornélia, São João, Bico, Bafureira, Praia Grande and Carcavelos. Each returned 16 forecast dates and 408 hourly entries without provider issues. All 2,448 hourly scores matched the shared local evaluator. Top-card summaries exactly matched the full-forecast daylight windows for 17, 19 and 20 September. Invalid calendar dates returned 400, unauthenticated forecasts 401 and demo spot writes 403. The temporary verification session was revoked.

At verification, Cornélia's 17 September window was 08:00–09:00, Good 89, 0.5–0.9 m. Both São Pedro Saturday windows were 08:00–09:00, Fair, 0.3–0.5 m: Bico 69 and Bafureira 61. Sunday remained flat. These are dated forecast outputs, not observations or guaranteed future conditions.

Database checks confirmed all 17 configuration/version pairs and default profile exactly matched staging. Revision history and unrelated spot fields were preserved. Eight spots had already recorded genuine fresh forecast samples containing only future hours, each with the expected 90-day expiry and null provider issue time. An attempted no-op snapshot update was rejected by the immutability trigger inside a rolled-back transaction.

Native Chrome checks confirmed matching Saturday top/day tiles, selection opening 08:00 below, All spots preserving the selected date, and Cornélia's green morning window. Desktop and 390 px mobile views retained the compact design. No horizontal page overflow occurred at 390 or 320 px; the temporary viewport override was reset. No browser warnings/errors were captured. Vercel's runtime-error tool returned no errors in its selected default time range; this is a bounded check, not ongoing monitoring or completion of A6.

[Sanitised receipts](2026-09-17-forecast-production/) include the migration rehearsal/application, live API windows, database checks, deployment identity and browser checks. They exclude credentials, account data and full database records.

## Migration identity and recovery

`scripts/promote-forecast-calibration-20260917.mjs` validates the reviewed staging state and production baseline before updating anything. It uses each environment's own row IDs, writes separate immutable history revisions and refuses a duplicate/partial application. Do not rerun it after this completed release.

| Migration | SHA-256 |
| --- | --- |
| `20260917_small_wave_trial` | `a7363425aa0aa21a11435b60244fedcef1411181f35cf2eee205d75cb96385ed` |
| `20260917_sao_pedro_gfs_direction_trial` | `fc2d24289beda7981e36e74b30f9760f918be3a0530a9a6596d867733e815f48` |

The original policy files and recorded checksums remain unchanged. Production history records the owner's later approval. The two São Pedro revisions follow their small-wave revisions, preserving both changes separately.

Application rollback can restore the preceding B2-compatible `04d9c9a` release while retaining the additive archive table. That alone would retain the new calibration values. A full calibration rollback must create new versioned updates from the saved baseline configurations and prior production history, restore the general default through a new version, and retain all migration/history records. Never delete history, reuse old revision numbers, drop unexpired samples or restore a whole database over live operational data.

F9/F14/F19 remain partial: representative observations, fixed-lead coverage and an accuracy dashboard are still outstanding. The next core development task is A4/B6, then A9 and B3, with the documented email readiness prerequisites. This deployment does not activate email, scheduling, paid services or new subscriptions.
