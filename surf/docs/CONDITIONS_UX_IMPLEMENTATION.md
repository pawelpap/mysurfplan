# Conditions UX implementation

F18, 10 September 2026. F17 is approved and the owner authorised staging implementation. Staging verification passed; production remains on B2 until owner approval. [Handover](HANDOVER.md) owns deployment status.

## Final time behaviour

The owner's final confirmation supersedes the intermediate proposal to synchronise every tile with the chart cursor.

- Spot cards always compare **now**, in both the carousel and All spots. Changing the day or chart time does not change them. The heading states the comparison time and timezone. World regions compare one absolute instant; each card includes its local time in its accessible description. The clock advances each minute.
- Day tiles show a stable **12:00 local-time snapshot**, labelled above the calendar. Selecting a day opens its noon details. The initial detailed view opens at now; its Now button returns to today/current time.
- Moving either chart cursor updates both chart cursors, the detailed parameters and hourly selection. The calendar and spot summaries remain stable. Mouse, touch, keyboard and a labelled time input are supported. Vertical touch movement retains page scrolling.
- Both charts use a stable full-day domain, including night hours, so dragging cannot resize the domain. The hourly list initially shows a three-row morning-to-evening preview. Show all hours expands it; night hours are separately available.

## Presentation

Monday–Sunday columns keep weekends aligned. All 16 dates remain available across the required three or four rows. Past/outside-horizon placeholders show only dates. Day and spot cards show qualitative quality and semantic background colours. Meaningful experience stays at the bottom. Numerical scores remain in detailed assessments and hourly details only.

Mobile tiles retain desktop parameters: quality, surf range, numeric swell/wind bearings with separate icons/arrows, weather and meaningful experience. The weekly grid scrolls inside its own container, with arrows. It does not widen the phone page. All spots has search, region/distance/quality/experience filters and nearest/A–Z ordering. Mobile filters expand inline. There are no photos or new storage requirements.

The surf-height chart includes existing swell energy in kJ/m² on a separate labelled axis, quality bands and individual series controls. The tide chart stays neutral and retains all four daylight events and high/low tide times. Main parameters have equal visual weight. Swell components, including wind waves, are available on desktop and mobile.

Signed-in navigation has appearance radio icons above profile/logout. Login says “Made for surfers by surfers”, has no appearance selector and always follows the device, including live changes. A saved signed-in preference is preserved and restored outside login. The document bootstrap applies this rule before the first paint.

## Data and permissions

`GET /api/conditions/summary` is authenticated, GET-only and private/no-store. It returns a compact assessment for one spot and timestamp using the existing forecast cache, tide prediction and database calibration. It exposes neither full forecasts nor calibrations. Input time is bounded to the forecast horizon. No provider, formula, calibration or schema change is included.

The carousel requests visible cards plus one ahead. Catalogue reads are paged in groups of 24, with at most three concurrent requests, 500 ms debounce, cancellation and a bounded memory cache. Current cards advance per minute; upstream data retains shared server caching, refresh coalescing and backoff. Explicit refresh is limited to its request cycle. Recheck A7 capacity before a substantially larger catalogue or traffic increase.

Existing nearest-location behaviour is reused. Coordinates stay in browser memory; denied location permits alphabetical/manual selection. Explicit links and manual choices take precedence over automatic selection. Spot configuration stays platform-admin-only, with server-side enforcement.

Find lessons uses the current authorised school workspace, filters real lessons by spot and local date, and orders them by proximity to the selected hour. It retains context back to Conditions. An account without a school has no broken school link. Complete cross-school discovery remains C2; F18 creates no availability or bookings.

## Verification and release boundary

Use Node.js 22, unit tests, lint/build, dependency checks and browser/API verification. Check stable tile times, linked cursors, touch versus vertical scroll, 17 spots/16 days, location, permissions, full swell components, lesson no-results, both themes and login's device-only rule. Chrome viewport/touch emulation does not establish physical iPhone/Safari coverage.

No database clone, migration or calibration promotion is part of F18. Only temporary verification sessions and normal forecast caches are written. Production requires owner approval. The preceding B2 application is a compatible rollback, without a database rollback.

Local release verification, 10 September: 96 tests, Node.js 22 lint/build, complete dependency tree and zero npm audit findings passed. Eight API groups and nine native Chrome browser groups passed against the production-mode local build. Desktop/mobile visual checks covered the login, rich tiles, linked charts and no page overflow at 390 px and 320 px. One pre-existing avatar-image lint warning remains. Staging also passed all eight API and nine browser groups, including vertical touch scrolling and restoration of the saved signed-in theme. [Release evidence](archive/releases/RELEASE_2026-09-10_CONDITIONS_UX_STAGING.md).
