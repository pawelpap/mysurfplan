# Conditions UX implementation

F18, 10 September 2026. F17 is approved and the owner authorised staging implementation. Staging verification passed; production remains on B2 until owner approval. [Handover](HANDOVER.md) owns deployment status.

## Final time behaviour

The owner's final confirmation supersedes the intermediate proposal to synchronise every tile with the chart cursor.

- Spot cards compare **now during daylight**, **today at sunrise before dawn**, and **tomorrow at sunrise after sunset**, in both the carousel and All spots. This replaces the earlier always-now decision following owner approval on 10 September. The heading states the actual context (“Now”, “Today at sunrise” or “Tomorrow at sunrise”), derived from loaded summaries, rather than a generic rule. Mixed regions retain their distinct contexts. Each card has a visible local-time label, such as “Today · Sunrise · 07:15”. Sunrise is calculated per spot from coordinates and timezone, with no extra provider request. Daylight and date boundaries, including DST, use the spot’s calendar. Polar daylight uses now; when there is no sunrise within the next two local days, a “Night” label accompanies the current-time forecast instead of inventing a sunrise. Changing the day or chart time does not change the cards.
- Day tiles show a stable **12:00 local-time snapshot**, labelled above the calendar. Selecting a day opens its noon details. The initial detailed view opens at now; its Now button returns to today/current time.
- Moving either chart cursor updates both chart cursors, the detailed parameters and hourly selection. The calendar and spot summaries remain stable. One “Conditions at …” label sits above the charts; there is no separate time input. Mouse, touch, chart keyboard controls and hourly-row selection remain supported. Vertical touch movement retains page scrolling.
- Both charts use a stable full-day domain, including night hours, so dragging cannot resize the domain. The hourly list initially shows a three-row morning-to-evening preview. Show all hours expands it; night hours are separately available.

## Presentation

Monday–Sunday columns keep weekends aligned. All 16 dates remain available across the required three or four rows. Past/outside-horizon placeholders show only dates. Day and spot cards show qualitative quality and semantic background colours. Meaningful experience stays at the bottom. Numerical scores remain in detailed assessments and hourly details only.

Mobile carousel cards fit two across at 390–440 px phone widths, including 430 px iPhone Pro Max emulation. On narrower phones a 158 px minimum protects readability. Cards retain all parameters and visible local forecast times. Mobile day tiles retain desktop parameters: quality, surf range, numeric swell/wind bearings with separate icons/arrows, weather and meaningful experience. The weekly grid scrolls inside its own container, with arrows. It does not widen the phone page. All spots has search, region/distance/quality/experience filters and nearest/A–Z ordering. Mobile filters expand inline. There are no photos or new storage requirements.

The surf-height chart includes existing swell energy in kJ/m² on a separate labelled axis, quality bands and individual series controls. The tide chart stays neutral and retains all four daylight events and high/low tide times. Main parameters have equal visual weight. Swell components, including wind waves, are available on desktop and mobile.

Signed-in navigation has appearance radio icons above profile/logout. Login says “Made for surfers by surfers”, has no appearance selector and always follows the device, including live changes. A saved signed-in preference is preserved and restored outside login. The document bootstrap applies this rule before the first paint.

## Data and permissions

`GET /api/conditions/summaries` is authenticated, GET-only and private/no-store. It accepts up to 24 distinct spot IDs, processes at most three simultaneously, and returns compact assessments with per-spot daylight timing. Errors are isolated to each spot. Only explicitly requested visible IDs can force a refresh. The existing single-spot `/api/conditions/summary` remains available for an exact bounded timestamp. Both use the existing forecast cache, tide prediction and database calibration and expose neither full forecasts nor calibrations. No provider, formula, calibration or schema change is included.

The carousel requests visible cards plus one ahead. Catalogue reads are paged in groups of 24. One in-flight batch per mounted browser, a 500 ms debounce and a 250-entry memory cache avoid repeated per-card calls. Cache entries are keyed by spot, not minute; healthy summaries are reused for five minutes. Visible-page minute/focus checks revalidate only expired entries; sunrise/sunset boundaries shorten this period. A boundary already passed on the device has a one-minute retry floor, preventing request loops from clock differences or responses crossing sunset. Failed/stale summaries retry after one minute and explicit Refresh bypasses the browser age check. Previously loaded values remain visible while refreshing; failed updates keep them labelled as previous data. Scrolling does not cancel a started batch or repeat its work; unmount cancels the browser request. Hidden pages stop scheduling new work. Shared provider caching, refresh locks and backoff are unchanged. A batch has a 300-second server ceiling for a cold catalogue/provider timeouts, without increasing concurrency. Recheck A7 capacity before a substantially larger catalogue or traffic increase.

Existing nearest-location behaviour is reused. Coordinates stay in browser memory; denied location permits alphabetical/manual selection. Explicit links and manual choices take precedence over automatic selection. Spot configuration stays platform-admin-only, with server-side enforcement.

Find lessons uses the current authorised school workspace, filters real lessons by spot and local date, and orders them by proximity to the selected hour. It retains context back to Conditions. An account without a school has no broken school link. Complete cross-school discovery remains C2; F18 creates no availability or bookings.

## Verification and release boundary

Use Node.js 22, unit tests, lint/build, dependency checks and browser/API verification. Check stable tile times, linked cursors, touch versus vertical scroll, 17 spots/16 days, location, permissions, full swell components, lesson no-results, both themes and login's device-only rule. Chrome viewport/touch emulation does not establish physical iPhone/Safari coverage.

No database clone, migration or calibration promotion is part of F18. Only temporary verification sessions and normal forecast caches are written. Production requires owner approval. The preceding B2 application is a compatible rollback, without a database rollback.

Local release verification, 10 September: 96 tests, Node.js 22 lint/build, complete dependency tree and zero npm audit findings passed. Eight API groups and nine native Chrome browser groups passed against the production-mode local build. Desktop/mobile visual checks covered the login, rich tiles, linked charts and no page overflow at 390 px and 320 px. One pre-existing avatar-image lint warning remains. Staging also passed all eight API and nine browser groups, including vertical touch scrolling and restoration of the saved signed-in theme. [Release evidence](archive/releases/RELEASE_2026-09-10_CONDITIONS_UX_STAGING.md).

The daylight/cache/mobile follow-up passed 104 unit tests and build; the main change passed 14 API groups and nine browser groups locally, and the complete final version passed all 14 API and nine browser groups on staging; it has a separate [release record](archive/releases/RELEASE_2026-09-10_SPOT_CARDS_DAYLIGHT.md). See the handover for live staging status.
