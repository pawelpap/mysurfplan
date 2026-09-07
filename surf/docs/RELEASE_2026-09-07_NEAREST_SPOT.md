# Nearest spot selection, 7 September 2026

The owner requested verification of Nearest to me. Distance sorting worked, but a fresh Conditions page still selected the first alphabetical spot while the dropdown put the nearest spot first. This did not fulfil the earlier request to open the nearest spot automatically.

Application revision `c02da003ec56376750ff0620eef2e264a601fb9f` corrects initial selection. Conditions opts into a one-time callback from the shared picker after a successful location result. An explicit spot link takes precedence. A manual selection immediately prevents a late location result from replacing it. Switching sorting or updating location preserves the chosen spot. A requested forecast date is retained. Lesson forms do not opt into automatic selection.

The existing great-circle distance calculation, location request settings and alphabetical fallback are unchanged. Coordinates stay in browser memory. The browser sometimes returned location unavailable during verification; the app displayed the existing message and fell back to A–Z. The fix cannot supply a location when browser/device services do not provide one.

## Deployment and verification

The owner had authorised fixes on both environments with testing afterwards. Staging was verified before production promotion.

| Environment | Verified application deployment |
| --- | --- |
| Staging | `dpl_H9w3qC1inRzJW8QK4tgDNbkWoEGC` |
| Production | `dpl_5Z1s2wo2RqomRJmbUKBMossxwvSR` |

- All 68 regression tests passed, including global distance calculations, ties, missing/invalid coordinates, alphabetical ordering and distance labels. Both Vercel builds succeeded.
- Both live environments selected the first distance-ordered spot on a fresh Conditions page after a successful browser location response. Distance ordering and labels were visible.
- Manual spot selection remained selected while sorted by distance and after switching to A–Z in both environments.
- Staging retained a requested date when automatically selecting a spot, and an explicit spot/date link remained unchanged. Location failure and retry fallback were observed.
- Desktop and mobile emulation at 390 × 844 px passed without document overflow. All 16 forecast tiles remained available. No physical-phone test was performed.
- Browser error checks and deployment-scoped error/fatal runtime scans found no application errors during verification.
- Temporary viewport overrides were reset and the two tabs opened for these checks were closed. Existing user tabs were left open. No precise browser coordinates were collected or stored in the release evidence.

No database, calibration, forecast engine or account changes were made. Both environments retain the matching data from the [forecast calibration release](RELEASE_2026-09-07_FORECAST_CALIBRATION.md). A documentation-only follow-up keeps both branches together without changing the tested runtime.

To roll back this UI correction, deploy the preceding `e4eaafdc5b629a799d21bbed77c9966a9c7eb0a4` revision. Keep the current databases. This restores the previous initial-selection behaviour while retaining the approved calibration and tile cleanup.
