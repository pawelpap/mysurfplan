# Swell energy and water temperature

Implemented 6 September 2026. Shared calculation: `lib/conditions/energy.mjs`; ingestion: `lib/conditions/provider.mjs`. The Conditions summary follows the graph's chosen time. Hourly rows/cards and lesson start use the same calculation.

## Meaning and calculation

The primary metric is **offshore swell energy density**, in kJ/m². The secondary metric is **estimated offshore swell power**, in kW per metre of wave crest. Neither is a surf quality or experience rating. Shelter can make a spot flat even when offshore energy is high. This first release does not claim to estimate energy in breaking waves or alter surf scores.

For each independent swell partition with significant height H (metres) and period T (seconds):

- Energy density E = ρgH² / 16 / 1000, in kJ/m².
- Deep-water power P ≈ ρg²H²T / (64π) / 1000, in kW/m.
- Sum the partition energies and powers. Do not add combined `wave_height` or wind-wave height, which would double-count or introduce wind sea into a swell metric.

Reference seawater density is 1025 kg/m³ and standard gravity is 9.80665 m/s². These universal physical reference values and SI conversions belong to the shared formula, not local calibration. There are no spot-specific energy gains, hidden period multipliers or colour bands. Any future adjustable local transformation belongs in a versioned database calibration schema.

The exact spectral power formula uses energy period Te. The forecast supplies partition periods, not Te or a full spectrum. We use those periods directly as an explicit approximation, indicated by ≈ in the UI. We do not claim equivalence to Surfline's energy metric or invent a conversion factor. Depth, spectrum and breaking losses are not resolved.

A 1 m, 10 s swell has about 0.628 kJ/m² and 4.903 kW/m. Doubling height quadruples both. Doubling period doubles power but leaves energy density unchanged.

Each valid partition contributes. A missing or invalid height is not treated as zero; any resulting estimate is marked partial. If any positive-height partition lacks a positive period, power is unavailable. A known zero height contributes zero without needing period. With no valid heights both values are unavailable. Values are calculated from unrounded inputs and rounded for display only. At half hours, raw heights and periods are interpolated before calculating energy, just as for lesson start/end.

## Sources and verification

- [NREL Reference Model 5 report, NREL/TP-5000-62861, printed page 6](https://docs.nrel.gov/docs/fy15osti/62861.pdf) gives the significant-height/energy-period deep-water flux formula.
- [MHKiT wave resource implementation](https://mhkit-software.github.io/MHKiT/_modules/mhkit/wave/resource.html) gives Hm0 = 4√m0 and the flux calculation with the same density/gravity references. Combining E = ρgm0 with Hm0 gives the density formula above.
- [Open-Meteo GFS Wave source](https://github.com/open-meteo/open-meteo/blob/main/Sources/App/Gfs/GfsWaveVariable.swift) maps primary, secondary and tertiary swell to SWELL/SWPER partitions 1, 2 and 3. Their heights are significant heights.
- Tests in `tests/energy.test.mjs` cover reference values, dimensions/scaling, independent partitions, invalid/zero/missing data, temporal interpolation, lesson consistency and unchanged scores.

## Water temperature

[Open-Meteo Marine API documentation](https://open-meteo.com/en/docs/marine-weather-api) supplies `sea_surface_temperature` in °C through its best-match marine selection. A separate request is necessary because the chosen GFS wave model does not supply temperature. We use the spot's database coordinates and sea-cell selection, independently of the offshore wave sampling point. The API key and customer endpoint are used when configured.

The current global source has approximately 8 km resolution, six-hourly source data, daily updates and about ten forecast days. The API returns an hourly timeline, which can include interpolated values. Water temperature is a regional sea-surface estimate, not a beach measurement or a wetsuit recommendation.

Wave, weather and water requests run concurrently on refresh. Temperature is joined by UTC timestamp; absent values stay null and are never extrapolated across the rest of the 16-day wave forecast. A failed temperature request does not disable waves, wind or scoring. Its status and grid are retained in forecast metadata. All three are requested again on normal refresh. Cache provider version 3 prevents an old response without temperature being mistaken for the new response shape.

## Presentation

Energy and water temperature use the same label, value, note and spacing styles as the other forecast parameters. They appear inside the shared conditions grid, with no separate card background, icon or larger type. The selected-time summary uses three columns on desktop and two on smaller screens; lessons use four columns on desktop and two on smaller screens. Expanded mobile hours use the same metric cells throughout. An optional explanation contains the interpretation and limits. Desktop hourly rows include energy beneath swell and water beneath weather. Lessons explicitly label both values as at start.
