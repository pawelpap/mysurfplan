# Conditions Figma review, 9 September 2026

Status: **F17 approved; F18 is deployed and verified on staging, awaiting owner review.** The owner authorised staging implementation and refined tile/time behaviour on 10 September. The [implementation contract](CONDITIONS_UX_IMPLEMENTATION.md) takes precedence over illustrative Figma values and earlier proposals. Production approval is still required.

## Review links

The new page is [REVIEW – Conditions UX – 9 September 2026](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ?node-id=382-2). Existing current and archived design pages remain intact.

| View | Light | Dark |
| --- | --- | --- |
| Conditions, desktop | [Desktop](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ?node-id=385-6) | [Desktop dark](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ?node-id=422-3292) |
| Conditions, mobile | [Mobile](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ?node-id=385-9) | [Mobile dark](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ?node-id=427-4613) |
| All spots | [Desktop catalogue](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ?node-id=414-2034) | Uses the same semantic theme tokens |
| All spots, mobile | [Mobile catalogue](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ?node-id=417-2684) | Uses the same semantic theme tokens |

[Mobile filters](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ?node-id=420-3263), [mobile menu](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ?node-id=421-3269), [loading/unavailable/empty states](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ?node-id=428-5330) and [review notes](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ?node-id=430-5335) are on that page.

The selected-day example uses 10 September at 09:00; the spot cards and catalogue represent conditions now. Forecast values, distances and times are illustrative design data, not a forecast observation, validation sample or calibration recommendation. The catalogue contains the 17 existing spots. No photographs or session data were imported.

## Design decisions to carry into F18

### Spots and calendar

- The spot carousel contains the full catalogue, with four visible cards at a typical desktop width, previous/next arrows, and swipe/scroll on mobile. It must not autoplay. Disable arrows at the ends and keep keyboard focus visible. The mobile composition reveals part of the next card.
- **All spots** opens search, nearest/A–Z sorting and filters for region, distance, quality and required experience. The implementation uses an expandable inline filter panel on mobile. Geography must remain extensible beyond Portugal. Distance filtering requires location; declined/unavailable location falls back to A–Z and manual search without blocking forecasts.
- **Spot cards show conditions now**, using the latest current-hour forecast, independently of the selected calendar date or graph time. The All spots catalogue and its quality/experience filters use that same current-time context. Compare one absolute instant across spots, with local date/time available where timezones differ. Advance the current-hour summaries when the hour changes; page refresh still checks freshness. Include loading/unavailable states. Quality filtering must never imply that a green Advanced forecast is suitable for a beginner.
- Calendar columns stay Monday–Sunday, with weekends in fixed positions. Preserve all 16 dates across three or four rows as needed. Past and outside-horizon placeholders show the date only: no icons, scores or experience. Missing future forecast data is a separate unavailable state.
- Day tiles retain the date, qualitative quality, surf range, numeric swell/wind bearings, weather and meaningful experience. Numerical scores are reserved for detailed conditions, not day or spot tiles. **Experience is anchored at the bottom**, with its space retained when absent, so the other values stay aligned. Apply the same rule to spot cards. Hide both the surfer icon and experience text when not applicable.
- The mobile calendar retains the same tile parameters as desktop. Its aligned weekday columns scroll horizontally, with navigation arrows. Empty grey placeholders have no icons.
- Wave, wind, weather and surfer icons support labels. Swell and wind arrows must remain distinguishable. Use the provider's actual weather code for sun/cloud/rain icons. Arrows show travel direction while the bearing/compass label describes the direction of origin, matching the existing app. Day tiles show numeric degrees; full degrees and compass labels remain in details.

### Charts, parameters and hours

- The first chart shows the **hourly local surf-height range in metres** and a dashed **swell-energy line in kJ/m²**, with separate labelled axes and a clear legend. The range is not a confidence interval. The owner chose this hourly view, so a second 16-day trend chart is not included.
- Soft hourly background bands use the existing surf-quality colours. The selected quality is also written in text. Both chart series should be individually toggleable; keep units visible and preserve gaps when a source is unavailable. Energy uses the existing calculation, not a new formula or Surfline unit conversion.
- The tide chart has a **neutral background**, not quality colours or a yellow daylight wash. Retain first light, sunrise, sunset, last light, tide height/state/trend and high/low times. Neutral daylight markers must not suggest a surf-quality assessment.
- Both graphs and detailed parameters share the selected time. The top spot comparisons remain on the current hour and do not change when a future date/hour is selected. Support tap/click, drag and keyboard/hour-list alternatives. Mobile must allow normal vertical scrolling without accidental time changes.
- Keep a compact hourly list below the graphs. Selecting an hour updates the charts and detailed parameters; its swell components can expand. **Show all hours** exposes the complete available morning-to-evening range, starting at 06:00. The mock-up says 06:00–21:00; production must derive the evening end from the spot/day coverage. Do not permanently limit the user to the preview hours.
- All metrics have equal visual weight. Repeated low-information descriptions were removed. Required information remains: score/quality, experience, local surf range, offshore swell height/period/direction, secondary swell and wind waves, wind speed/direction/gusts/orientation, air temperature/weather/rain chance, energy/power, water temperature, tides and daylight.

### From conditions to lessons

The selected conditions and hourly rows have **Find lessons**. Carry spot ID, local date and the chosen time into lesson discovery. C2 owns the complete search and no-results journey, with C1/B5 prerequisites; F18 must not imply that this backend already exists. F18 links to the existing authorised current-school lesson list, filtered by spot/local date and ordered by proximity to the selected time. Complete cross-school discovery remains C2. Search should use real lesson timing/availability and show suitable nearby times when there is no exact match. Do not invent availability counts or silently book a lesson. Keep filters through login/registration.

### Navigation and appearance

Keep navigation at the top. At the bottom, use appearance controls, then the profile/account name, then **Log out**. The appearance group is separate from the account actions. On short viewports, scrolling must keep every control reachable; respect phone safe areas.

Use a monitor/sun/moon segmented radio group for **System / Light / Dark**, initially following the device. Persist an explicit choice and provide an obvious return to System. Each option needs an accessible name, keyboard selection, a visible focus ring and an active outline, not colour alone. The proposal uses targets at least 44 px high. The profile must open the actual account view, and Log out must use the existing secure logout flow. The mobile menu retains the familiar hamburger and outside-tap/Escape dismissal, with focus returned to the trigger.

These choices follow the [WAI radio-group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/). The 44 px target is a design choice above the [WCAG 2.2 minimum target requirement](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), not a claim that all controls have passed an accessibility audit. System appearance uses [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme).

## Components and visual checks

The proposal reuses Poppins, the existing app logo and CSS light/dark/quality colours. Local Figma components cover buttons, desktop/mobile days, spot cards, metrics, hourly summaries, direction/weather strips and the appearance switch. There is one small semantic variable collection with Light/Dark modes. Lucide SVG icons use the ISC licence; the Material Design Icons surfing symbol uses Apache-2.0. Retain the relevant licence notices if these assets enter the app.

Visual inspection covered desktop, mobile, light/dark, catalogue and menu views. It found and corrected inherited desktop text widths in mobile cards, insufficient multiline heights, tight daylight/legend spacing and account/logout spacing. Cards now keep experience at the bottom and blank dates have no decorative icons. Bounds inspection found no overflowing auto-layout children in the eight primary frames; the spot carousel is intentionally horizontally scrollable. Font inspection found Poppins throughout. All four Conditions frames contain the same eight main metric groups and 17 spot cards. Both catalogues contain all 17 spots.

The existing quality text/background pairs measured 5.45:1–6.05:1 in Light and 6.86:1–7.76:1 in Dark. This check covers those pairs, not every possible rendered state. [Frame/component IDs and inspection results](design/conditions-ux-f17/review.json) are saved for handoff.

This is **design verification**, not browser, accessibility or live-app testing. The catalogue/back links, mobile filters/menu and first desktop carousel advance have prototype connections. Search/filter evaluation, repeated carousel paging, all-hours expansion, live chart selection, series toggles, persistent appearance and lesson discovery are specified behaviours for implementation; the Figma file does not execute them against real data.

## Next action

Staging verification passed. Obtain the owner’s review before production. The owner confirmed the final time model: spot cards always show now; day tiles show 12:00; the chart cursor changes both charts and detailed parameters only. The [implementation contract](CONDITIONS_UX_IMPLEMENTATION.md) records login and responsive changes. No forecast-model or calibration change is included.

Before implementation, settle summary freshness, caching, pagination and request deduplication under A5/A7. Never fetch every spot's full 16-day forecast on each page load. Preserve refresh behaviour, automatic nearest selection, manual/deep-linked spots and platform-admin-only spot settings. Test real desktop/mobile browsers, both themes, every calendar start weekday, month/DST/timezone boundaries, missing data, location permission states, keyboard/touch interactions and lesson no-results. Staging review and the owner's production approval still precede promotion for this design change.
