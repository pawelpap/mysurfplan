# São Pedro staging direction-trial evidence

17 September 2026. [Decision, assumptions, results and rollback](../SAO_PEDRO_DIRECTION_REVIEW_2026-09-17.md).

- `staging-before.json`: the two affected spots' public calibration settings, notes and sources, plus catalogue/default-setting hashes for concurrency checks. `production-before.json` contains catalogue/default-setting hashes only. Complete database records are excluded.
- `schema.json`: database calibration schema used for validation.
- `forecasts-before.json.gz`: weather fixtures from the two forecasts before the trial, including provider inputs, tide/daylight and baseline configuration. Spot identity is limited to slug, revision and timezone; full database records are excluded. Retrieval is dated; this is not a beach observation or a hindcast.
- `replay.json`: all 32 forecast-day windows and selected Saturday hours from an identical-input replay of 816 hourly samples.
- `rehearsal.json` and `staging-receipt.json`: transaction rollback rehearsal and successful staging-only migration receipt, with the deployment-policy checksum.
- `staging-after.json` and `database-checks.json`: the two updated public calibration settings, history checks, 15 unchanged staging spots and 17 unchanged production spots. Default-profile settings remain unchanged.
- `forecasts-after.json.gz` and `live-checks.json`: fresh staging weather fixtures and exact top-card/calendar parity. Provider inputs refreshed between the baseline and live check, so live results must not be presented as an identical-input comparison.

Local verification: 137 tests passed; changed scripts/tests passed lint. Browser verification: refreshed the owner's staging Chrome tab on Bafureira, Saturday 19 September, 08:00; both São Pedro top cards and the selected day tile displayed Fair and 0.3–0.5 m with the existing layout. No application UI or shared scorer was changed. Production promotion remains withheld.
