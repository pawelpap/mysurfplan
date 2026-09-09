# Local spot calibration review, 7 September 2026

> Archive status: Dated implementation evidence. Statements about current deployments, data, approvals and rollback refer to this record’s date; they are not new deployment instructions. See the [current handover](../../../HANDOVER.md) and [current roadmap](../../../IMPLEMENTATION_ROADMAP.md).

Initially applied to staging at 19:45 UTC. The owner subsequently approved production promotion, completed at 20:11 UTC. Both environments now have the reviewed spot configurations. See [production release, parity and verification](../../releases/RELEASE_2026-09-07_FORECAST_CALIBRATION.md). The calibration review itself used the existing generic schema v3 with no application code, shared default profile or provider integration change. A separate approved tile-copy cleanup was deployed with the production promotion.

Staging now has 17 active spots: 16 existing spots revised, Praia da Torre added and generic São Pedro do Estoril deleted. The five lessons linked to generic São Pedro were explicitly confirmed as disposable test data. Their five bookings and three coach assignments were removed by the existing foreign-key cascades. The seven other lessons were preserved. Generic São Pedro's configuration and calibration history are backed up here; disposable lesson records are not retained.

## Calibration choices

The sources describe local behaviour, not measured transfer functions. All new numerical coefficients are provisional estimates and retain `status: initial`. The checks below verify valid, consistent calculation; they do not demonstrate improved forecast accuracy. There are no date-specific overrides, scraped forecast feeds or coefficients fitted to one future day.

| Spot | Change on staging |
| --- | --- |
| Bico | Tide weight 0.15 → 0.30; tide penalty slope 2.2 → 3. Preserve the 283° shoulder, strong shadow from 290°, gain 0.72 and low-tide window that extends towards mid tide with larger swell. |
| Bafureira | Same stronger tide influence; preserve gain 0.68, mid-high tide and minimum swell 1.2 m. Intermediate upper surf threshold 1.6 → 1.4 m. |
| Parede | Stronger mid-tide dependence; tide slope 3.6. Reduce landward and far-NW swell leakage. Intermediate minimum retained. |
| Carcavelos | Retain W/SW and large-NW response plus mid-high tide. Reduce landward swell leakage; reduce Beginner size/period limits for its powerful surf. |
| Guincho | Direction-dependent N/NW wind gain 1.3, replacing uniform wind gain 1.2. Lower Beginner size/period limits. |
| Abano, Cresmina | Modest N/NW wind gain 1.15 and earlier experience escalation. Existing low-mid tide and swell gains retained. Cresmina bottom recorded as Mixed. |
| Praia Grande, Praia Pequena | Replace hard-edged 315–45° wind shelter with a smooth directional curve. Preserve northern shelter gain 0.7 and their different swell gains. Earlier experience escalation. |
| Adraga, Magoito | Mixed sand-and-rock/reef classification and earlier experience escalation as size or period increases. No invented narrow tide window or new directional cut-off. |
| Praia das Maçãs | Broader tide window 0.15–0.85 and gentler tide penalty 1.8, reflecting changing banks. Earlier experience escalation. |
| São Julião | Preferred tide window extends towards low tide, 0–0.7. Earlier experience escalation. |
| São João, Cornélia | Matching tide windows 0.2–0.8 and experience thresholds. Preserve shared marine sample point, model and modest local gain/orientation differences. |
| Tamariz | Progressively stronger W/NW shelter; initial minimum offshore swell 1.5 m. Large swell can still wrap into the beach. Beginner access retained for suitable small waves. |
| Praia da Torre | New sheltered Oeiras beach: gain 0.55, progressive directional shelter, initial minimum swell 1.3 m and mid-tide window 0.2–0.8. Shares Carcavelos's offshore sample and tide reference; has its own full calibration. |

Tide windows are ratios of the local tidal range, not metres or chart-datum heights. No tide timing or height corrections were invented. Wind gain applies to the existing local-wind assessment; the current engine's gust threshold still uses the unadjusted provider gust forecast. Experience thresholds are provisional lesson-planning limits, not claims about a surfer's safety.

The complete, exact settings and revision expectations are in [changes.json](changes.json). Every added/revised spot has sources and a change note in `spot_calibration_history`. Bico is version 6; Bafureira, São João and Cornélia are version 5; the other revised spots are version 3; Torre is version 1.

## Evidence

- [Surf Cascais local guide](https://www.surfcascais.com/pt/post/cascais-surf-spots): exposed west coast versus sheltered south coast; Guincho-like low-mid tide for nearby beaches; Carcavelos mid-high tide; São Pedro mid-low tide; Bafureira mid tide; Parede dislikes extremes; northern wind shelter around Praia Grande/Pequena. The user's more specific Bico/Bafureira tide observations remain in the model.
- [SaltyWay local Sintra guide](https://www.saltywaytravel.com/saltyway-surf/?lang=de): consistent west-coast exposure, changing sandbanks at Maçãs and a gentler smaller bay at Praia Pequena. These support broad rather than precisely claimed tide preferences.
- Ericeira Surf House guides for [Adraga](https://www.ericeirasurfhouse.com/surf-spots/praia-da-adraga/) and [Cresmina](https://www.ericeirasurfhouse.com/surf-spots/praia-da-cresmina/), plus [Visit Sintra's Adraga description](https://visitsintra.travel/en/visit/beaches/adraga-beach): sand/rock structure and local exposure. Unselected tide/ability labels in guide widgets were not treated as factual recommendations.
- [Ocean Surf School at São Julião](https://www.theoceansurfschool.com/location): beginner teaching around low tide and more experienced surfing around mid tide. The 0–0.7 ratio is our estimate, not a published measurement.
- [Lisbon Wave School](https://lisbonwaveschool.com/services) uses Magoito for summer lessons. [Surf Atlas's first-hand Magoito account](https://thesurfatlas.com/surfing-portugal/magoito-beach/) describes reef sections and a change from playful summer surf to powerful winter waves. Conflicting informal direction guides did not justify blocking NW swell.
- [Gecko Surf School's Caparica guide](https://www.geckosurfschool.com/en/costa-da-caparica-surf-guide-2026/) describes shelter, changing banks and seasonal exposure. No evidence justified separating the two nearby beaches onto different offshore data again.
- [Cascais municipal newspaper, March 2014, page 18](https://www.cascais.pt/sites/default/files/anexos/jornal/c39_web.pdf) includes Tamariz among local learning locations. [Historical Tamariz contributor reports](https://www.wannasurf.com/spot/Europe/Portugal/Central_Lisboa/tamariz) describe larger-swell shelter and rocks. These are qualitative historical evidence, not current bathymetric measurements.
- [Portuguese Surf Schools Association on Praia da Torre](https://www.associacaoescolasdesurf.pt/post/beaches-under-pressure-praia-da-torre): a small sheltered winter refuge receiving refracted waves in larger swell. Location 38.6757, -9.3228 was checked against [Surfline's Torre map](https://www.surfline.com/surf-report/praia-de-torre/602d64e1d663ff28d7a951c2). Shore orientation and numerical shelter were estimated from the setting, not obtained from a surveyed transfer function.

## Surfline comparison

The owner-authorised Chrome comparison on 7 September around 20:37–20:48 WEST showed São Pedro at 0.3–0.6 m, Poor to Fair, with 1.1 m / 11 s / 280° swell and 20 km/h NNW wind. The Tuesday daily summary was 0–0.3 m, with similarly small summaries through Saturday. Torre was 0–0.3 m. Source: the open [São Pedro forecast](https://www.surfline.com/surf-report/s-o-pedro-do-estoril/640b9d679b6fab7dac307b39).

Our comparison uses hourly records and separate Bico/Bafureira calibrations, so it is not an exact like-for-like comparison with Surfline's generic spot/daily summary. At Tuesday 08:00, staging predicted Bico 0.3–0.6 m, Fair (62), and Bafureira 0.3–0.5 m, Poor (40); both became flat by 20:00 as the incoming direction moved to 294°. At Monday 20:00 our Bico prediction remained more optimistic, Good (93), 0.5–0.8 m, versus Surfline's current Poor to Fair. Input direction, local transfer and rating methodology differ. This is recorded as an observation to review, not used to force a one-day match. No claim is made that all forecasts agree with Surfline.

Session data work is deferred at the owner's request. No private session history was imported, copied to the repository or used to fit coefficients.

## Validation and review

- Existing 68 regression tests passed. The database's schema v3 and constraints accepted all 17 configurations.
- 61,200 synthetic height/direction/period/tide/wind combinations passed range and level checks. Targeted checks cover flat-size ceilings, the 283° Bico reference, NW shadow, contrasting reef tide response, smooth wind shelter, Caparica consistency and Torre's larger-swell activation.
- Staging authenticated APIs returned 16 forecast days and 408 assessed hourly records per spot: 6,936 records, all with finite scores matching the intended configuration. No forecast issues or stale responses were reported during this check. Water temperature was available for 271 hours per spot and remained unavailable outside its returned coverage. An initial smoke assertion incorrectly required temperature for every hour; this was corrected after checking the existing provider's non-extrapolation behaviour. No application change was needed.
- The student spot-write request returned 403. Generic São Pedro's forecast returned 404. The selector returned exactly 17 active spots including Torre and excluding generic São Pedro.
- Chrome desktop inspection after reload confirmed the updated selector and Torre's complete forecast. No layout change was made; this review did not repeat physical-phone testing.
- At the end of the initial staging review, read-only production fingerprints before/after matched for every spot's version, configuration and active status. At that time production retained generic São Pedro and did not include Torre. This dated evidence predates the subsequently approved production promotion.

See [validation results](validation.json), [live checks](live-after.json), [transaction receipt](applied.json) and [production comparison](production-unchanged.json). The initial and final full spot snapshots are retained here. Provider snapshots are dated evidence only; the app continues to request fresh data normally.

Review on staging by reloading Conditions and selecting Bico, Bafureira, Torre and the Caparica pair. Compare equivalent spot, date and time. Stronger tide weights will not always change a score where the existing small-wave ceiling is already lower.

Production promotion is complete: current versions were re-read, every configuration was validated, and updates used optimistic version guards and history entries. The owner explicitly authorised synchronising disposable test lesson data with staging; six production-only lessons were removed, including five linked to generic São Pedro. Accounts and unrelated settings were preserved. A rollback restores selected previous configurations as new revisions with history notes. Recreating deleted generic São Pedro is possible from its saved row/history; its disposable test lessons are intentionally not recoverable from this evidence bundle.
