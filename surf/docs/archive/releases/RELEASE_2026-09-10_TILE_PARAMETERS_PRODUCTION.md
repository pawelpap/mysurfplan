# Compact forecast tiles and mobile menu: production release

10 September 2026. The owner reviewed staging and explicitly approved production promotion.

## Released change

Spot and day tiles show two compact rows: icon, direction arrow, numerical bearing, compass direction, then offshore swell energy in kJ/m² or wind speed in km/h. Weather icons sit at the top right beside the spot name or date. Separate Wind/Energy rows are removed. Mobile day columns preserve complete values and weekly alignment. The mobile menu focuses its dialog container instead of the school selector, preserving keyboard containment and Escape focus restoration.

Application commit: `0fc7be5c669b95860cd6f2e70879d39a189be9ee`. Approved staging source, including documentation, promoted to `main`: `a6da03131013deb168434f3e737e4ce8c6291d94`. Verified production deployment: `dpl_9ULgt7wdSQS8kEdHep64jurAy4E8`, on [mywaveplan.com](https://mywaveplan.com). Staging evidence is in [the staging release](RELEASE_2026-09-10_TILE_PARAMETERS_STAGING.md).

The summary API exposes existing wind speed and energy at each tile's established timestamp. No new upstream requests, forecast formulas, calibrations, database migrations or database copies were introduced.

## Verification

The reviewed staging application had passed the Node.js 22 lint/build, 14 API groups and nine browser groups. Before promotion the dependency tree check passed and npm audit reported zero vulnerabilities. Git checks confirmed the production branch could fast-forward and the promoted documentation commit contained the same application as reviewed staging.

The live production custom domain passed all 14 API and nine native Chrome browser groups. Checks include 17 spots and 16 days, summary/detail parity, student permissions, nearest location, stable tile times, linked chart cursors, same-row measurements, two mobile carousel cards, page overflow at narrow widths, dark/light appearance, menu focus and keyboard behaviour, and login's system theme. Browser errors: none. The post-deployment error/fatal log scan returned no matching entries. A production mobile screenshot was visually reviewed.

The runner removed its own temporary test session and closed its browser. Physical iPhone/Safari was not tested. Forecast cache activity and security counters remain independent per environment.

## Release state and rollback

Both environments run the same approved application. Documentation-only commits after the promoted source may produce newer deployment IDs without changing application code.

Compatible rollback: preceding production commit `172080d763a1e6dd04acea04beb71a67f192ee71`, deployment `dpl_AmVQYmobHkvbZgQ73bW4YmUVxFpq`. No database rollback is needed.
