# Documentation archive

Organised 9 September 2026. These files preserve dated plans, findings, releases and calibration evidence. For current instructions use the [handover](../HANDOVER.md), [implementation roadmap](../IMPLEMENTATION_ROADMAP.md) and [documentation index](../README.md).

## Superseded plans and handovers

| Record | Status |
| --- | --- |
| [June development plan](plans/DEVELOPMENT_PLAN_ARCHIVE_2026-06.md) | Superseded product plan and early change history. |
| [Plan archived 7 September](plans/DEVELOPMENT_PLAN_ARCHIVE_2026-09-07.md) | Superseded plan last updated 6 September; replaced by the current product plan and task roadmap. |
| [Handover before the 9 September tidy-up](handovers/HANDOVER_2026-09-09_BEFORE_DOCS_CLEANUP.md) | Full previous handover, including older deployment IDs, decisions and verification. Its repeated current/next-action sections are historical. |

Historical content is retained. Archive notices and document links are maintained so readers can distinguish it from current guidance.

## Dated release evidence

| Date | Record |
| --- | --- |
| 9 September | [School access and response privacy](releases/RELEASE_2026-09-09_SCHOOL_ACCESS_PRIVACY.md), A1 verification and rollback. |
| 8 September | [Login and request security](releases/RELEASE_2026-09-08_REQUEST_SECURITY.md). |
| 7 September | [Nearest-spot selection](releases/RELEASE_2026-09-07_NEAREST_SPOT.md) |
| 7 September | [Forecast calibration and tile cleanup](releases/RELEASE_2026-09-07_FORECAST_CALIBRATION.md) |
| 7 September | [Revocable sessions](releases/RELEASE_2026-09-07_SESSION_REVOCATION.md) |
| 7 September | [Session security](releases/RELEASE_2026-09-07_SESSION_SECURITY.md) |
| 6 September | [Forecast refresh recovery](releases/RELEASE_2026-09-06_FORECAST_REFRESH.md) |
| 6 September | [Conditions presentation](releases/RELEASE_2026-09-06_PRESENTATION.md) |
| 6 September | [Database calibration, energy and water temperature](releases/RELEASE_2026-09-06.md) |
| 5 September | [Initial database promotion](releases/RELEASE_2026-09-05_DATABASE_PROMOTION.md), extracted from the former staging guide. |

Additional home-screen, viewport and login-copy release details remain in the archived handover. Check the current handover before selecting a rollback revision; an older record's previous revision may be incompatible with later data or authentication changes.

## Audits and calibration provenance

| Record | How to use it |
| --- | --- |
| [September UX audit](audits/UX_AUDIT_2026-09.md) | Historical findings and design review. Remaining work is tracked in the current roadmap. |
| [São Pedro calibration, 6 September](calibration/CALIBRATION_2026-09-06_SAO_PEDRO.md) | Earlier directional-response calibration and evidence; later revisions are in the 7 September review and database history. |
| [Local spot review, 7 September](calibration/2026-09-07-local-review/README.md) | Latest documented regional calibration rollout, including sources, exact changes, validation and production promotion. The adjacent JSON files retain their original contents. |

Archive placement distinguishes dated evidence from maintained guidance. Do not rerun migration, fixture-cleanup or rollback commands merely because they appear here. Old branch and deployment references must be checked before use.
