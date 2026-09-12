# Neighbouring Sintra spot calibration, 10 September 2026

The accompanying raw JSON/forecast evidence remains in the local working folder and is not included in the public migration release. Filenames below refer to those local audit artefacts.

The owner authorised checking comparable beaches near Grande and Pequena, correcting justified coefficient inconsistencies and updating staging and production after verification. Adraga, Praia das Maçãs, Magoito and São Julião are now revision 4 in both databases. Staging was updated at 12:59:31 UTC and production at 13:02:33 UTC. This was a database-only calibration change; no Vercel deployment, application code change or schema migration was required.

This is dated evidence. It does not authorise rerunning the update or overwriting subsequent revisions. The [handover](../../../HANDOVER.md) records current status; [F19](../../../IMPLEMENTATION_ROADMAP.md#f19-accepted-scope-10-september-2026) remains planned for broader weather sampling and shared-model validation.

## Scope and evidence

The four selected spots lie on the exposed Sintra coast and had the same earlier quality weights and period curve. Their existing shore normals are all 285°, an estimated database setting rather than a new coastal survey. Their physical configurations remain separate.

| Spot | Approximate straight-line distance from Grande | Evidence and retained distinctions |
| --- | --- | --- |
| Adraga | 1.3 km | [Ericeira Surf House](https://www.ericeirasurfhouse.com/surf-spots/praia-da-adraga/) describes the beach immediately south of Grande, W swell, E wind and sand/rock banks. Retain mixed bottom, gain 1.02 and existing experience limits. |
| Praia das Maçãs | 1.5 km | [SaltyWay](https://www.saltywaytravel.com/saltyway-surf/?lang=de) describes a nearby consistent beach break with tide-dependent banks. Retain gain 1.00, broader tide window 0.15–0.85 and gentler tide penalty. |
| Magoito | 5.9 km | [Visit Sintra](https://visitsintra.travel/pt/visitar/praias/praia-do-magoito) locates the beach along the cliff-backed coast. [Joseph Richard Francis's first-hand guide](https://thesurfatlas.com/surfing-portugal/magoito-beach/) describes NW-swell exposure and mixed sand/reef behaviour; [Lisbon Wave School](https://lisbonwaveschool.com/services) teaches here in summer. Retain mixed bottom, gain 1.00 and earlier experience escalation. |
| São Julião | 14.1 km | The northern edge of this catalogue comparison, rather than an immediately adjacent beach. [Ericeira Surf House](https://www.ericeirasurfhouse.com/surf-spots/sao-juliao/) describes a W/NW-exposed, wind-sensitive beach break. [Ocean Surf School](https://www.theoceansurfschool.com/location) describes low/mid-tide teaching. Retain gain 1.00 and tide window 0–0.70. |

Distances were calculated from the stored beach coordinates. The sources support the exposure grouping and local distinctions; none publishes the new numerical coefficients. Applying the same period-quality sensitivity to this selected group is provisional engineering judgement, not a demonstrated accuracy improvement.

Guincho, Abano and Cresmina were reviewed but excluded from this narrow neighbouring-Sintra rollout. The [Cascais municipal description](https://360.cascais.pt/en/visit/guincho-beach) identifies Guincho's strong winds, and [Surf Cascais](https://www.surfcascais.com/post/2017/06/28/best-beaches-around-cascais) distinguishes its wind setting from Grande across the mountains. These beaches remain candidates for F19's wider evaluation. South-facing sheltered spots and Caparica were also unchanged. No new spot was added.

## Exact adjustment

Only `weights` and `periodFitCurve` changed inside each selected spot's `calibration_config`:

- Height/wind/period/tide weights: 0.40/0.30/0.15/0.15 → 0.20/0.30/0.35/0.15.
- Period suitability: `[[0,0.1],[4.8,0.1],[12,1]]` → `[[0,0.1],[5,0.1],[8,0.25],[10,0.65],[13,1]]`.

These are the same period-quality settings already applied to Grande and Pequena. They reduce the earlier tendency for roughly seven-second swell to receive Good ratings from favourable height/wind/tide alone. They operate on every forecast hour and contain no day-specific rule.

All remaining coefficients are unchanged, including swell gains, directional exposure, period-dependent physical height amplification, wind shelter, wind-sea transformation, tide rules, size ceilings, severe-condition caps and experience thresholds. In particular, Grande/Pequena's northern wind-shelter curve was not copied to these beaches. Shared profiles and the calculation engine were untouched. Notes and source provenance were updated, with a separate history entry per spot in each environment. The configuration status remains `initial`.

Exact proposals are in changes.json (`changes.json`, local evidence), with full before/after spot snapshots and transaction receipts alongside this file. Friday and Sunday differences are allowed where their inputs and local settings justify them; identical forecasts are not the objective.

## Forecast comparison

Production inputs were captured before the change around 12:56 UTC. The table isolates the calibration effect using those same saved inputs, at 12:00 Europe/Lisbon. Fresh live checks after the update returned the same displayed grades for these dates.

| Spot | Friday 11 September | Saturday 12 September, before → after | Sunday 13 September, before → after |
| --- | --- | --- | --- |
| Adraga | Poor 38, unchanged | Good 91 → Fair 72 | Good 95 → Good 90 |
| Praia das Maçãs | Poor 37, unchanged | Good 91 → Fair 72 | Good 94 → Good 88 |
| Magoito | Poor 37, unchanged | Good 91 → Fair 72 | Good 90 → Good 85 |
| São Julião | Unfavourable 26, unchanged | Good 91 → Fair 72 | Good 100 → Good 99 |

Grande and Pequena remain Fair 72 on Saturday at noon. Saturday's experience level remains Beginner at Maçãs and Intermediate at the other three revised spots. All physical surf ranges, energy and experience outputs are unchanged when evaluated with the same inputs. Later provider updates can legitimately change these values.

## Verification and recovery

- Both configurations and notes were compared across environments before changing anything. Live schema v3 validation passed; notes remain within the existing admin editor's limit.
- All 1,632 saved target hours passed before/after checks. Another 816 Grande/Pequena reference hours were checked. Date shifts did not change a calculation's result.
- 648 synthetic cases covered height, period, wind and tide. Fixed-local-size cases separately tested increasing period sensitivity, onshore penalties and severe-wind caps. Only the intended quality parameters differ from the original configurations.
- Live authenticated APIs checked all four updated spots plus Grande and Pequena on each environment: 4,896 hourly records in total, complete 16-day coverage and no reported forecast issues. Recomputed engine outputs matched the live records, allowing 1e−10 tolerance for unrounded floating-point values. Results (`validation.json`, local evidence), staging checks (`staging-after-live-checks.json`, local evidence), production checks (`production-after-live-checks.json`, local evidence).
- Browser checks confirmed the selected Saturday tiles, retained experience labels and charts for the revised spots. This was not a layout change or a physical-iPhone test.
- Full-row comparison confirmed all 13 other spot records unchanged in each environment, including Grande and Pequena. The four revised configurations, notes, sources and versions match across staging and production. Integrity checks (`integrity.json`, local evidence).
- Each database update used full-row fingerprint and revision guards, and required four updated rows and four history entries in one transaction. A mismatch would roll back the complete batch. Temporary API test sessions were revoked; no new Chrome tabs were needed.

Run `node surf/docs/archive/calibration/2026-09-10-sintra-neighbours/verify.mjs` from the repository root to reproduce the offline forecast and calibration checks. Saved forecasts use lossless gzip compression. The script never changes a database.

For an authorised rollback, first re-read the latest live revisions. Restore the selected previous configurations as new revisions with a rollback history note, preserving later edits and all unrelated rows. Do not decrement versions, erase history or reset the database. Scores are computed from the current spot configuration, so a browser reload picks up the changed calibration. The source/grid discrepancy and validation against actual surf observations remain work for F19/F9/F14/F15.
