# Tile parameters and mobile menu on staging

10 September 2026. Owner-authorised staging-only follow-up to F18. Production remains on the approved F18 release until this amendment is approved.

Spot cards now show numerical wind and swell bearings alongside their compass directions. Spot and day cards both show wind speed in km/h and existing offshore swell energy in kJ/m². The same rows are used in carousel, catalogue and calendar, with the same desktop/mobile parameters. Missing data remains a dash; partial energy is labelled. Existing quality colours and bottom-aligned experience remain.

The summary response includes wind speed and the existing energy assessment. They are taken from the same timestamp/model as the rest of the tile. There are no new upstream requests, database changes, calculation changes or cache changes. Spot cards retain now/next sunrise; day cards retain noon.

Local verification: 104 tests and Node.js 22 lint/build passed, with the pre-existing avatar warning. The production-mode local build passed 14 API and nine native Chrome browser groups. API checks compare summary wind speed and energy to the detailed calculation. Browser checks assert numerical bearings and both added metrics, two-card geometry at 430 px, no tile overflow, and existing 390/320 px page checks. Dark mobile screenshots were visually reviewed; parameters fit and retain equal weight. Physical iPhone/Safari was not tested.

The mobile menu now focuses its dialog container instead of the first control. This avoids automatically focusing the administrator school select and triggering its native iPhone picker. Tab and Shift+Tab remain within the menu; Escape restores hamburger focus. The combined change passed the Node.js 22 lint/build. Staging deployment `dpl_DodyqiGT2kRMdzBPNg8LZiCjwpRk` serves application commit `f700797c5f1a58da3b9bdc3c156d653b5a89de14`. Live verification passed all 14 API and nine browser groups, including dialog focus, keyboard containment and Escape focus restoration. The initial run timed out waiting for all catalogue summaries; a full rerun passed without code changes or browser errors. Deployment error/fatal logs were empty. Mobile screenshots were reviewed. The test account has one school, so the actual administrator native iPhone picker was not exercised; the automatic select focus was removed at the shared menu entry point. The release runner uses the existing test account, deletes its own temporary session and closes test browsers. No operational records or calibrations are changed.

Rollback: preceding staging/production commit `172080d763a1e6dd04acea04beb71a67f192ee71`, without a database rollback.

Documentation-only commits after this application commit do not change the tested application. Production was not promoted.
