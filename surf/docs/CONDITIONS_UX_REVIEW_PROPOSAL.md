# Conditions UX review proposal

Recorded and reviewed 9 September 2026. Source: design feedback from **Piotr**, relayed by the owner, followed by the owner's live review comments. Status: **F17 approved; F18 implementation deployed and verified on staging**. The owner subsequently started the Figma work. See the [Figma review, decisions and visual checks](CONDITIONS_UX_FIGMA_REVIEW.md) for the current proposal and frame links.

The [implementation roadmap](IMPLEMENTATION_ROADMAP.md) tracks this as **F17: design and review** and **F18: implementation of the approved scope**. The [current handover](HANDOVER.md) identifies the next development task. The current design remains the production baseline until a replacement is reviewed. This proposal changes presentation, not forecasting calculations or spot calibrations.

## Assessment of Piotr's suggestions

| Suggestion | Recommendation and design question |
| --- | --- |
| Arrange daily forecasts in calendar weeks, with weekends in fixed positions and past days grey | Agree. Use Monday–Sunday headings initially, with Saturday and Sunday consistently placed. Show all 16 forecast dates across the necessary calendar rows. Leading past dates and trailing dates outside the forecast can be muted, disabled placeholders; do not invent historical forecasts. Distinguish today, selection and weekends without changing the meaning of quality colours. Test a compact seven-column calendar on mobile with readable selected-day details below. |
| Hide “Not applicable” on day tiles | Agree. The current experience formatter maps the internal `Too small` state to “Not applicable”. Omit that experience line when it has no useful meaning, while keeping “Flat / too small” as the conditions explanation. Missing data is a different state and must remain distinguishable. Keep Beginner, Intermediate or Advanced whenever the forecast supports an assessment. |
| Show spots as cards with current conditions, optionally with photos | The owner chose a carousel with all spots, desktop arrows and mobile swipe, plus an All spots catalogue with search and filters. Preserve nearest-first selection, A–Z sorting and explicit spot links. No photos are included in this proposal. |
| Add wave, weather and wind icons | Agree, where they make scanning easier. Use one consistent icon family, familiar symbols and short labels/units. Retain the actual direction arrows and bearings. Decorative icons should not compete with the condition colours or replace information that is unclear without a label. |
| Reduce information on day tiles | Use qualitative labels on spot/day tiles, with numerical scores only in details. Desktop and mobile tiles show surf range, numeric swell/wind bearings, weather and meaningful experience anchored at the bottom. Mobile weekday columns scroll horizontally. Empty dates have no icons. |
| Add a conditions graph before the tide graph | The owner chose the hourly surf-height chart, added a dashed energy series and requested quality-coloured background bands. The tide chart stays neutral. There is no extra 16-day trend chart in the proposal. |

## Proposed screen flow to test in Figma

1. **Choose a spot:** selected spot and a compact comparison of nearby spots, with a clear route to the full catalogue.
2. **Choose a day:** calendar weeks with stable weekday headings, coloured quality tiles and a concise summary.
3. **Choose a time:** selected-day conditions chart above the tide/daylight chart, if the hourly proposal is approved. Both use the same selected time.
4. **Read the details:** the full parameter set at that time, using the existing balanced metric layout and accessible swell-component details.
5. **Find a lesson:** selected-time and hourly actions carry spot/date/time into the C2 lesson-discovery journey. Availability must come from real lesson data.

The design should support these decisions in sequence. It should not turn into a page of unrelated cards and graphs. Reuse the app's typography, spacing, controls, light/dark palettes and quality colours. Mobile needs its own composition, with the same data available; shrinking the desktop tiles is insufficient.

### Calendar and tile details

Use the spot's timezone to determine dates and today. Sixteen forecast dates can require three or four calendar rows depending on the starting weekday; never shorten the horizon to fit a fixed number of rows. A future locale-specific week start must keep weekday headers and dates consistent.

Prototype at narrow mobile widths as well as desktop. A compact week row with tap targets and selected-day detail may work better than seven full metric cards. Week paging is another option if the complete horizon remains obvious and easy to navigate. Past placeholders are not selectable forecast results; a future day with unavailable data must not look like a past day.

Keep a readable quality label alongside colour. A green tile can still require Advanced experience, so that distinction must survive the simplified summary. Selection and today need their own visible markers. Do not restore “Long-range”, artificial probabilities, or low-information technical commentary.

### Spot comparison and optional photos

The owner’s 10 September refinement chooses **now during daylight or the next sunrise at night** for spot cards and All spots. Each card labels its own local forecast time; the calendar and chart selection do not change it. The five-minute batch cache reuses loaded values while refreshing. This supersedes the original always-now design brief. Describe predictions as forecasts, not observed conditions. Unavailable or older cached data must remain recognisable.

The current screen requests a forecast for one selected spot. A comparison area needs a bounded, cached summary strategy before implementation: a limited nearby/visible set, pagination or lazy loading, request deduplication and provider/cost checks. Do not request a full forecast for every spot in the database on each page load. Basic spot comparison in this proposal is not dependent on a paid Surfer Plus plan; F7 remains a separate commercial opportunity.

Preserve automatic nearest selection, permission-denied fallback, manual selection, distance/A–Z ordering and direct links. Spot configuration stays restricted to platform admins. Photos, if approved, need rights/attribution checks and the B7 object-storage approach: resized assets outside Neon, with only references and metadata in the database. Photos must not block the initial comparison design.

### Conditions chart

The reviewed direction shows estimated local surf height in metres with its existing minimum–maximum range, plus a dashed swell-energy series in kJ/m² on a clearly labelled second axis. The owner requested both series together; either should be toggleable. The range is not a statistical confidence interval. Soft hourly quality bands apply to this chart only. The tide chart uses neutral backgrounds and daylight markers. No new forecasting formula is proposed here.

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

- [Conditions screen](../components/conditions/index.js): daily noon summaries, independent current-time spot cards, linked chart selection and detailed metrics.
- [Shared condition labels](../components/conditions/shared.js): score, quality and the current “Not applicable” experience mapping. Check other consumers before changing a shared formatter.
- [Spot selector](../components/spot-select.js): current nearest/A–Z and location-selection behaviour.
- [Conditions architecture](CONDITIONS_ARCHITECTURE.md): data and calculation behaviour to preserve.

The proposal is on a new review page in the existing Figma file. [Current review links, owner decisions, prototype limitations and visual verification](CONDITIONS_UX_FIGMA_REVIEW.md) are the implementation handoff. The icon appearance switch, bottom profile/logout group, filtered catalogue and retained all-hours list are included. No application code, database or deployment changed during F17.

## Accepted implementation refinements, 10 September

The owner authorised staging implementation. Spot cards show now during daylight or the next sunrise at night, including in All spots. The mobile carousel fits two readable cards on larger phones. Day tiles show a labelled 12:00 snapshot. Chart cursors change only both charts and detailed conditions. Numerical scores are omitted from spot/day tiles; mobile retains the desktop tile parameters. The login copy is “Made for surfers by surfers” and login always follows the device theme with no selector. See the [implementation contract](CONDITIONS_UX_IMPLEMENTATION.md). Production remains on B2 until a separate approval.
