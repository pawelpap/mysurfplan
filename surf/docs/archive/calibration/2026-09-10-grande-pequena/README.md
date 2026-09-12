# Praia Grande and Praia Pequena calibration review, 10 September 2026

The accompanying raw JSON/forecast evidence remains in the local working folder and is not included in the public migration release. Filenames below refer to those local audit artefacts.

Dated evidence, not instructions to rerun a database update. The owner requested a Surfline comparison for Friday 11, Saturday 12 and Sunday 13 September and authorised justified calibration changes on staging and production. Both spots were updated from revision 3 to 4, staging at 11:41:55 UTC and production at 11:44:36 UTC. No application code, shared profile, schema or provider integration changed. No Vercel deployment was required.

## Comparison and diagnosis

Surfline was read in the owner's authenticated Chrome session on 10 September. The comparison used 06:00, 12:00 and 18:00 in Europe/Lisbon on each requested day. Our initial forecasts were retrieved at approximately 11:27 UTC; staging and production had the same inputs and scores. These are competing predictions, not observed surf conditions or proof of either service's accuracy.

Noon comparison, at the time of this review:

| Spot | Date | Surfline surf / quality | Our surf | Our quality before → after |
| --- | --- | --- | --- | --- |
| Grande | Friday 11 September | 0.6–0.9 m / Poor | 0.3–0.5 m | Poor 40 → Poor 40 |
| Grande | Saturday 12 September | 0.6–0.9 m / Poor to fair | 0.6–1.0 m | Good 91 → Fair 72 |
| Grande | Sunday 13 September | 0.9–1.2 m / Fair | 0.7–1.2 m | Good 95 → Good 90 |
| Pequena | Friday 11 September | 0.6–0.9 m / Poor | 0.3–0.5 m | Poor 40 → Poor 40 |
| Pequena | Saturday 12 September | 0.6–0.9 m / Poor to fair | 0.6–0.9 m | Good 91 → Fair 72 |
| Pequena | Sunday 13 September | 0.6–1.1 m / Fair | 0.7–1.1 m | Good 95 → Good 90 |

Surfline rated Friday Poor at all three sampled times for both beaches. Saturday was Poor / Poor to fair / Poor. On Sunday, Grande was Poor to fair / Fair / Fair, while Pequena was Poor to fair / Fair / Poor to fair. Sources: [Grande forecast and guide](https://www.surfline.com/surf-report/praia-grande/5842041f4e65fad6a7708e62) and [Pequena forecast](https://www.surfline.com/surf-report/praia-pequena/584204214e65fad6a7709d28). These are hourly samples, not a claim about every intervening hour. Our corresponding before/after samples are in validation.json (`validation.json`, local evidence).

Three differences matter:

1. **Quality weighting.** The previous model gave 40% of the score to height and only 15% to period. Moderate local size, calm forecast wind and a favourable tide could therefore produce a score above 90 for roughly seven-second swell. That is an overly generous initial assumption for assessing organised surf at these exposed beach breaks. The revised period sensitivity addresses this structural behaviour across all dates.
2. **Weather input and sampling.** At noon on Friday/Saturday/Sunday, our wind was 7.6/3.8/1.9 km/h versus Surfline's 21/9/10 km/h. Sunday direction also differed: our 292° versus approximately 159° on Surfline. The app's Open-Meteo best-match request selects the default land grid, returned at 38.8125, −9.4375, inland of both beaches. A read-only request with `cell_selection=nearest` or `sea` returned 38.8125, −9.5 and winds of 11.9/4.6/4.3 km/h. Grid selection explains part, but not all, of the difference. See weather-grid-check.json (`weather-grid-check.json`, local evidence) and [Open-Meteo's grid selection documentation](https://open-meteo.com/en/docs). The alternate results were not substituted into the app.
3. **Wave inputs and definitions.** Weekend local surf ranges overlap substantially. Friday differs more: Grande's Surfline noon primary component was about 0.7 m, 10 s, 322°, while our GFS Wave primary was 0.58 m, 8.6 s, 338°, alongside a separately modelled 0.96 m wind sea. Different partitioning, directions and local wind-sea transformation affect the result. Three future days do not justify changing beach orientation or amplifying every swell to close that gap.

Sunday remains more optimistic in our model. As a diagnostic, replacing only Sunday's noon wind/gust values with Surfline's in a frozen calculation reduced our revised score from 90 to 83, still Good. Wind therefore does not explain the whole quality difference. We do not know Surfline's proprietary grading formula. The remaining period/height/wind interactions should be assessed against observations, not resolved by assigning Surfline's labels to our output.

## Database changes

Both spots use the existing generic schema v3. Only these numerical settings changed:

| Parameter | Before | After |
| --- | --- | --- |
| Height / wind / period / tide weights | 0.40 / 0.30 / 0.15 / 0.15 | 0.20 / 0.30 / 0.35 / 0.15 |
| Period suitability curve, seconds → fit | 0 → 0.1; 4.8 → 0.1; 12 → 1 | 0 → 0.1; 5 → 0.1; 8 → 0.25; 10 → 0.65; 13 → 1 |

Interpolation remains linear. The choice makes an otherwise ideal, moderate-size eight-second scenario Fair instead of automatically Good. Ten-second and longer organised swell can still be Good, subject to size, wind, tide and severe-condition rules. These numerical values are provisional engineering judgement, not coefficients measured by a source or validated on held-out observations. `status: initial` remains unchanged.

Physical wave transformation, direction response, northern wind shelter, marine and weather sources, tide rules and experience thresholds are preserved. Grande retains gain 1.08 and shore normal 285°; Pequena retains gain 0.95 and normal 290°. Their experience limits remain separate. [Visit Sintra](https://visitsintra.travel/pt/visitar/praias/praia-pequena) describes Pequena's northern shelter, and the [SaltyWay local guide](https://www.saltywaytravel.com/saltyway-surf/?lang=de) describes differing beach/bay behaviour. These support keeping the existing distinctions, not any exact new number. Surfline's Grande guide describes an exposed beach with changing peaks and tide-dependent shorebreak; Pequena's guide did not provide comparable detail.

There are no date conditions, competitor feed dependencies or changes to shared defaults. Full proposals, notes and source provenance are in changes.json (`changes.json`, local evidence). Each environment has its own audit entry, with the operator left null and the owner-authorised review recorded in the change note.

## Verification and recovery

- Live database schema v3 validation passed for both configurations.
- 816 saved forecast hours were recalculated before promotion. Surf heights, energy, wind classification, experience, swell components and explanation text were unchanged by the calibration; only scores/quality/tone can change.
- 324 synthetic scenarios covered size, period, wind and tide. Additional fixed-size cases verified progressive period sensitivity, adverse-wind penalties, severe-condition caps and date independence.
- Authenticated live APIs returned 408 hourly records per spot in each environment, with no forecast issues. All 1,632 live records matched the engine. A 1e−10 relative/absolute tolerance covers floating-point differences in unrounded component values between runtimes; displayed grades and numbers were also checked.
- Chrome rendered the Friday/Saturday/Sunday tiles and both charts for both spots in staging and production. Saturday's day tile is Fair in all four views, with Grande Intermediate and Pequena Beginner at noon. No layout change or physical-phone verification was part of this data-only review.
- All 17 spots remain. Full-row fingerprints confirm the other 15 spots are unchanged in both databases. The two revised configurations, notes, sources and versions match across environments. Integrity evidence (`spot-integrity.json`, local evidence), staging live checks (`staging-live-checks.json`, local evidence), production live checks (`production-live-checks.json`, local evidence).
- Temporary test API sessions were revoked. The original Chrome tabs and the owner's browser sessions were retained; no new Chrome tabs were opened for this review.

Run `node surf/docs/archive/calibration/2026-09-10-grande-pequena/verify.mjs` from the repository root to reproduce the offline checks. It reads the saved JSON/gzip snapshots and never writes to a database. The eight forecast snapshots are losslessly compressed to avoid inflating the documentation folder.

Before/after spot rows and transaction receipts are retained alongside this report. If rollback is authorised, first check the latest live revisions. Restore the two previous configurations as new revisions with audit entries and an explicit rollback note; do not decrement versions, erase history or overwrite a newer edit. Runtime scores are calculated from current database calibration, so reload the page to discard an older browser response.

The weather-source/grid and residual quality discrepancy is recorded as F19 in the current roadmap. F9/F14/F15 remain the route to validation against actual surf observations.
