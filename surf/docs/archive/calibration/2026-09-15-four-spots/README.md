# Four-spot forecast comparison, 16 September 2026

**Status: closed investigation.** The separate task “Correct surf spot data” completed the explanation and checks on 15 September for the 16 September forecast. The owner confirmed resolution on 16 September. No code or spot-data correction was justified or made. The report below preserves the comparison evidence; residual differences between providers are not an open defect or an onboarding prerequisite. Any broader source/model validation remains the separately scoped [F19 backlog](../../../IMPLEMENTATION_ROADMAP.md#f19-accepted-scope-10-september-2026).

Reviewed on 15 September 2026 using the owner's open Chrome session, the live staging and production databases, and public Open-Meteo API responses. All times below are Europe/Lisbon. No application code or spot data was changed. There was no justified change to promote to production.

## Main finding

The largest difference in the captured comparison is São João. At noon, Surfline predicts 0.6–0.9 m and MyWavePlan predicts 0.2–0.3 m. Cornélia is less discrepant at noon: Surfline's 0–0.3 m includes MyWavePlan's 0.1 m. Cornélia diverges more by 18:00, when Surfline predicts 0.3–0.6 m and MyWavePlan still predicts about 0.1 m.

The owner clarified that MyWavePlan's small São Pedro forecast is more credible given the northerly wave direction. Bico and Bafureira were therefore retained unchanged. Surfline's São Pedro page is a regional comparator, not a separately verified forecast for each break.

| Spot | Surfline surf at 06:00 / 12:00 / 18:00 | MyWavePlan surf at 06:00 / 12:00 / 18:00 |
| --- | --- | --- |
| Bico | 0.3–0.6 / 0.3–0.6 / 0.3–0.6 m, São Pedro comparator | 0.0–0.1 / 0.0–0.1 / 0.0–0.1 m |
| Bafureira | Same São Pedro comparator | 0.0–0.1 / 0.0–0.0 / 0.0–0.0 m |
| São João | 0.3–0.6 / 0.6–0.9 / 0.6–0.9 m | 0.2–0.3 / 0.2–0.3 / 0.2–0.3 m |
| Cornélia | 0–0.3 / 0–0.3 / 0.3–0.6 m | 0.1–0.1 / 0.1–0.1 / 0.1–0.1 m |

Sources: [Surfline São Pedro](https://www.surfline.com/surf-report/s-o-pedro-do-estoril/640b9d679b6fab7dac307b39), [São João](https://www.surfline.com/surf-report/s-o-jo-o-da-caparica/5dbb587ff387900001fee288), [Cornélia](https://www.surfline.com/surf-report/praia-da-cornelia/5dbf6037eb8ddf00015a883f). These are competing forecasts, not observations establishing accuracy.

## Why Caparica looks strange

Both spots request GFS Wave 0.25° at 38.66, −9.37. The returned marine grid is 38.75, −9.5. At noon it contains 3.0 m of wind sea from 337°, but zero primary, secondary and tertiary swell. Direct provider requests reproduce those values, so this is not a stale browser response or a spot record accidentally losing the swell.

The current engine transforms wind sea as height × windSeaGain × directional exposure. The gain is 0.35 at both beaches. At 337°, São João's exposure is 0.2223, giving a central estimate of 0.2334 m; Cornélia's exposure is 0.1014, giving 0.1065 m. Their shore normals are 265° and 255° respectively. With this very northerly input, a ten-degree orientation difference produces a large relative difference in small surf. Swell gains 0.82 and 0.92 do not affect this wind-sea-only result.

The displayed 0° / 0 s swell is the provider's zero-valued partition. It should not be interpreted as measured north swell or as proof that the entire sea is flat. Most of the provider's wave height sits in the separate wind-sea component. [Open-Meteo documents separate swell and wind-wave variables and incoming bearings](https://open-meteo.com/en/docs/marine-weather-api).

Surfline instead lists São João's noon primary component as 1.0 m / 10 s / approximately 293°, and Cornélia's as 0.7 m / 10 s / approximately 294°, with further Cornélia components of 0.4 m / 13 s / 311° and 3.5 m / 8 s / 359°. Components and their treatment are materially different. Copying Surfline's height or direction into a permanent spot coefficient would not resolve the provider/partition distinction.

## Alternatives checked

GFS 0.25° at either actual beach coordinate selects 38.5, −9.25 and returns all-zero waves in the sampled hours. This is not a valid replacement for the existing sample. The existing history records why this sample was avoided.

GFS 0.16° at either actual beach, or the shared sample, selects 38.666668, −9.333328. At noon it returns 0.06 m / 13 s / 205° swell and 1.72 m / 314° wind sea. Substituting only these marine inputs in an offline calculation gives São João 0.3–0.4 m and Cornélia 0.2–0.3 m. This does not establish that switching models is more accurate, and it does not reproduce São João's Surfline forecast. Neither model nor sample was changed.

At noon Surfline gives all compared pages approximately 26 km/h from 345°, gusting 36 km/h. MyWavePlan gives São João 26.4 km/h from 340°, gusting 52.2; Cornélia 18.1 km/h from 343°, gusting 47.2. A read-only sea-grid request raises Cornélia's mean wind to 28.1 km/h, confirming sensitivity to weather-grid selection. Weather-grid selection is currently application behaviour, not a spot calibration field. Relocating a beach or inventing a wind multiplier to compensate would be unjustified. Wind and tide affect quality and experience, not the current surf-height calculation.

The Caparica local guides support variable sandbanks, exposure and tide sensitivity, but provide no measured coefficients for this event: [Gecko Surf School](https://www.geckosurfschool.com/en/costa-da-caparica-surf-guide-2026/). The retained São Pedro tide distinctions are consistent with [Surf Cascais](https://www.surfcascais.com/pt/post/cascais-surf-spots) and the owner's recorded local guidance.

## Verification and disposition

Both live environments were opened for the requested spots and date. Refreshed noon heights and scores agree: Bico 3, Bafureira 3, São João 19 and Cornélia 9. Gust thresholds explain the displayed Unfavourable / Advanced labels despite very small surf; they are not a claim of large waves. The engine's internal severe-condition label is mapped to Advanced by presentation code.

All eight refreshed spot forecasts have 408 hourly inputs and no provider issues. Offline calculations checked 3,264 hours against valid live schema-v3 configurations and bounded scores. This is calculation verification, not real-world forecast validation. The noon calculations reproduce the displayed values. Full-row comparisons confirm all 17 spot records remain unchanged in both environments. Bico remains revision 6; Bafureira and both Caparica spots remain revision 5.

No data-only fix met the evidence threshold, so staging and production were verified without a mutation or deployment. Possible broader F19 research includes validating marine partition/source choice and directional wind-sea transformation against observations, plus weather-grid and zero-swell presentation review if separately prioritised. These are not unfinished corrections from this closed comparison.

Evidence files retain before/current spot and forecast snapshots, public provider comparisons, the Surfline transcription, offline verification and unchanged-row checks. No credentials or browser-session tokens are included.
