# Conditions UX review proposal

Recorded 9 September 2026. Source: design feedback from **Piotr**, relayed by the owner in this conversation. Status: **future design brief, not an approved design or implemented change**. The owner requested Figma design and review before implementation, with no work on the interface now.

The [implementation roadmap](IMPLEMENTATION_ROADMAP.md) tracks this as **F17: design and review** and **F18: implementation of the approved scope**. The [current handover](HANDOVER.md) identifies the next development task. The current design remains the production baseline until a replacement is reviewed. This proposal changes presentation, not forecasting calculations or spot calibrations.

## Assessment of Piotr's suggestions

| Suggestion | Recommendation and design question |
| --- | --- |
| Arrange daily forecasts in calendar weeks, with weekends in fixed positions and past days grey | Agree. Use Monday–Sunday headings initially, with Saturday and Sunday consistently placed. Show all 16 forecast dates across the necessary calendar rows. Leading past dates and trailing dates outside the forecast can be muted, disabled placeholders; do not invent historical forecasts. Distinguish today, selection and weekends without changing the meaning of quality colours. Test a compact seven-column calendar on mobile with readable selected-day details below. |
| Hide “Not applicable” on day tiles | Agree. The current experience formatter maps the internal `Too small` state to “Not applicable”. Omit that experience line when it has no useful meaning, while keeping “Flat / too small” as the conditions explanation. Missing data is a different state and must remain distinguishable. Keep Beginner, Intermediate or Advanced whenever the forecast supports an assessment. |
| Show spots as cards with current conditions, optionally with photos | Useful for comparing where to surf. Prototype a compact nearby-spot comparison area with search and a way to browse all spots. Avoid placing every spot's full forecast above the selected forecast, especially as the catalogue grows worldwide. Preserve nearest-first selection, A–Z sorting and explicit spot links. Photos are optional; first test whether they help identification enough to justify their space. |
| Add wave, weather and wind icons | Agree, where they make scanning easier. Use one consistent icon family, familiar symbols and short labels/units. Retain the actual direction arrows and bearings. Decorative icons should not compete with the condition colours or replace information that is unclear without a label. |
| Reduce information on day tiles | Agree with separating summary from detail. Prototype date, quality, estimated surf and meaningful experience level as the compact summary. Compare keeping the numerical score on the tile against moving it to the selected-day detail. This is a review decision, not permission to remove a KPI. All existing parameters must remain easy to access on desktop and mobile. |
| Add a conditions graph before the tide graph | Promising. My preferred first prototype is an hourly estimated surf-height range for the selected day, answering “When should I surf?”. Piotr's “per day” suggestion could also mean a 16-day trend; compare that alternative in Figma and confirm the intended timescale before coding. Avoid adding both charts by default. |

## Proposed screen flow to test in Figma

1. **Choose a spot:** selected spot and a compact comparison of nearby spots, with a clear route to the full catalogue.
2. **Choose a day:** calendar weeks with stable weekday headings, coloured quality tiles and a concise summary.
3. **Choose a time:** selected-day conditions chart above the tide/daylight chart, if the hourly proposal is approved. Both use the same selected time.
4. **Read the details:** the full parameter set at that time, using the existing balanced metric layout and accessible swell-component details.

The design should support these decisions in sequence. It should not turn into a page of unrelated cards and graphs. Reuse the app's typography, spacing, controls, light/dark palettes and quality colours. Mobile needs its own composition, with the same data available; shrinking the desktop tiles is insufficient.

### Calendar and tile details

Use the spot's timezone to determine dates and today. Sixteen forecast dates can require three or four calendar rows depending on the starting weekday; never shorten the horizon to fit a fixed number of rows. A future locale-specific week start must keep weekday headers and dates consistent.

Prototype at narrow mobile widths as well as desktop. A compact week row with tap targets and selected-day detail may work better than seven full metric cards. Week paging is another option if the complete horizon remains obvious and easy to navigate. Past placeholders are not selectable forecast results; a future day with unavailable data must not look like a past day.

Keep a readable quality label alongside colour. A green tile can still require Advanced experience, so that distinction must survive the simplified summary. Selection and today need their own visible markers. Do not restore “Long-range”, artificial probabilities, or low-information technical commentary.

### Spot comparison and optional photos

Compare summaries for the same valid instant, with each spot's local time available. Do not mix a noon forecast for one beach with “now” for another. Describe predictions as forecasts, not observed conditions. Unavailable or older cached data must remain recognisable.

The current screen requests a forecast for one selected spot. A comparison area needs a bounded, cached summary strategy before implementation: a limited nearby/visible set, pagination or lazy loading, request deduplication and provider/cost checks. Do not request a full forecast for every spot in the database on each page load. Basic spot comparison in this proposal is not dependent on a paid Surfer Plus plan; F7 remains a separate commercial opportunity.

Preserve automatic nearest selection, permission-denied fallback, manual selection, distance/A–Z ordering and direct links. Spot configuration stays restricted to platform admins. Photos, if approved, need rights/attribution checks and the B7 object-storage approach: resized assets outside Neon, with only references and metadata in the database. Photos must not block the initial comparison design.

### Conditions chart

For the hourly proposal, start with estimated local surf height in metres, preferably showing its existing minimum–maximum range. That range is not a statistical confidence interval. A metric selector may later switch to quality or swell energy/power using the system's existing definitions and units; avoid multiple unrelated vertical axes or unexplained combinations. No new forecasting formula is proposed here.

The conditions chart, tide chart and detail values must share one selected time and the spot's timezone. Preserve the current morning-to-evening journey and first light, sunrise, sunset and last light. Support tap/click as well as dragging and keyboard time selection. Missing forecast intervals remain gaps; do not draw invented values across unavailable data. If the 16-day trend is chosen instead, selecting a date must update the calendar and selected-day panel consistently.

## Delivery and review gates

| Task | Effort and scope | Completion requirement |
| --- | --- | --- |
| F17: Figma design and owner review | M; Design, FE feasibility review | Review the current implementation and existing Figma design, then create a clearly labelled proposal. Include desktop/mobile and light/dark views, calendar/spot/chart interactions, loading and unavailable states. Compare only the alternatives needed to resolve the open questions. Record the owner's chosen scope and approval before coding. |
| F18: implement the approved design | L; FE, BE; DB only if approved photo metadata requires it | Split into bounded releases: calendar/tile clarity/icons; chart and time synchronisation; spot comparison and optional media. Re-estimate after F17. Verify on staging and obtain the owner's production approval for this design change before promotion. Update the handover and release evidence afterwards. |

This is optional roadmap work, not a new G1–G3 launch requirement. Schedule the Figma review after the B1/B2 membership work, or sooner if the owner chooses to prioritise it. Coordinate with C7's wider usability review. Follow A9/B10 for translated interfaces when shipped; A5/A7 apply before increasing provider load, and B7 is required only if photos are included.

Acceptance must cover desktop and mobile, both appearance modes, keyboard/touch operation, weekend/month boundaries, every starting weekday, daylight-saving/timezone boundaries, all 16 days and empty/partial forecast states. Preserve every existing parameter, colour meaning, required experience, selected-time calculation, refresh behaviour, nearest selection and platform-admin restriction. Calendar/detail summaries must use consistent times and values. Recheck request volume if spot cards are implemented.

Accessibility references: W3C explains why [colour needs an additional visual cue](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) and why [dragging needs a single-pointer alternative](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html). Apply these alongside readable contrast, meaningful labels and keyboard access.

## Implementation references for the future review

- [Conditions screen](../components/conditions/index.js): daily noon summaries, selected date/time, tide interaction and detailed metrics.
- [Shared condition labels](../components/conditions/shared.js): score, quality and the current “Not applicable” experience mapping. Check other consumers before changing a shared formatter.
- [Spot selector](../components/spot-select.js): current nearest/A–Z and location-selection behaviour.
- [Conditions architecture](CONDITIONS_ARCHITECTURE.md): data and calculation behaviour to preserve.

No Figma file has been created for this proposal, and no application code, database or deployment has changed as part of recording it.
