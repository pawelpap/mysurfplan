# Conditions UX production promotion

10 September 2026. The owner reviewed staging and explicitly requested production deployment. F18 is complete on both environments.

## Release

The tested staging commit `89652325fc80a7a76813ccdea3e93b7cdbd08f2b` was fast-forwarded to `main`. The application code is `7b3046b841e5c32a5f39e0acc9a28b6929a5865a`; later changes are documentation only. Production built with its own project settings and database connection. No staging deployment was repointed across projects.

| Environment | Verified application deployment | Status |
| --- | --- | --- |
| Staging | `dpl_AzDRrH8jRXr33oLKPdZvvS9iBBee` | Passed 14 API and nine browser groups. Later documentation deployment `dpl_63wtvrkANuBrbdaZeSz8zgcbhPJm` served identical app code. |
| Production | `dpl_GyGUyg9Eoj3oGXupTzSCQePFoxMe` | READY; [mywaveplan.com](https://mywaveplan.com) passed 14 API and nine browser groups. |

Subsequent documentation-only commits may create newer deployment IDs with identical application code. [Handover](../../HANDOVER.md) owns current status.

## Included behaviour

The complete approved F18 design is live: weekly forecast calendar, spot carousel and filtered catalogue, rich desktop/mobile tiles, qualitative quality colours, surf/energy and tide charts with linked cursors, detailed metrics, expandable hours/swell components, and current-school lesson links. Spot/day cards omit numerical scores while detailed assessments retain them. Nearest-spot selection and platform-admin-only spot configuration remain.

Spot cards show now during daylight or the next local sunrise at night. Their heading derives the actual context, with exact local times on each card. Day tiles stay at noon; chart cursors change details only. Five-minute batched summaries retain previous values during refresh, respect provider caching/backoff and avoid repeated per-minute calls. A one-minute floor protects against device-clock boundary retry loops. Mobile carousel cards fit two across at iPhone Pro Max width. A single “Conditions at …” label replaces the separate time field.

Login says “Made for surfers by surfers” and follows the device theme without a selector. The signed-in appearance switch remains above profile/logout. See the [implementation contract](../../CONDITIONS_UX_IMPLEMENTATION.md).

## Verification

- The approved source passed 104 unit tests and Node.js 22 lint/build. Dependency tree checks and `npm audit` were rerun before production, with zero vulnerabilities. One existing avatar-image lint warning remains for B7.
- Production API checks used the existing student test account: login, 17 spots, 16 days, exact-time summary/full-model equivalence, batch daylight equivalence, isolated missing-spot errors, input/method/auth boundaries and student spot-write denial.
- Nine native Chrome browser groups passed on production: nearest Bico, noon tiles and independent spot context, actual-context heading, keyboard/mouse/touch linked charts, catalogue search/cache reuse, hourly swell components, current-school lesson navigation, login/device theme behaviour and responsive layouts.
- The browser asserted no separate time input, selected time with Home/PageUp/Arrow keys, checked two-card geometry at 430 px and no page overflow at 390/320 px. No page errors occurred. Physical iPhone/Safari was not tested.
- Production error/fatal runtime scan for the deployed revision returned no matching entries after verification. Continuous monitoring and alerting remain A6.
- The runner deleted its own temporary login session and closed its test browsers. No lessons, people or schools were created, removed or reset.

## Database and rollback

No schema migration, calibration change, provider change or database clone was required. Staging and production remain separate databases. The release only uses normal forecast caches and temporary test sessions.

Previous production: main commit `91bc4fe2f9cd4c230f05f8ba7928e13610e2e9f3`, deployment `dpl_9uSc1nTvVFCwNS3pfk8sC9JHLa8s`. It is B2-compatible and can serve as the application rollback without reverting the database. Preserve membership authority and existing credentials/sessions; do not roll back to pre-B2 code.

The roadmap now has 70 items: seven complete and 63 open. B3 remains the next functional step, subject to the recorded privacy, EU, email and localisation prerequisites. This release does not activate registration, email services, payments or analytics.
