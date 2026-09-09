# Dependency baseline and Contentful cleanup

Completed 9 September 2026. Roadmap task A2. The owner authorised staging deployment, testing and production promotion after successful staging checks. [Current handover](../../HANDOVER.md), [version/configuration decision](../../DEPENDENCY_BASELINE.md).

## Released change

Runtime commit: `4f9d93fb64b5d4ccc046849d8eb9d795caa3857c`.

| Environment | Branch and URL | Verified deployment |
| --- | --- | --- |
| Staging | `staging`, [staging.mywaveplan.com](https://staging.mywaveplan.com) | `dpl_3fbAuy5PCQYosxCvjAqsTPiVwh3R` |
| Production | `main`, [mywaveplan.com](https://mywaveplan.com) | `dpl_AXGvebpEZyjMn6f2nQB6ivLCYjRU` |

Both deployments reached READY with the correct commit and custom-domain aliases. Staging's full checks completed before `main` was pushed. Each project built with its own existing environment configuration. The deployment records report `iad1`; Node.js remains 22.x. Documentation-only follow-ups can create later deployment IDs without changing this runtime.

Next.js moved from 14.2.3 to 16.3.4, React/React DOM from 18.2.0 to 19.2.8 and the Neon serverless driver from 0.9.5 to 1.1.0. Two explicit-placeholder queries now call `sql.query`, with regression tests for safe parameter binding. `pg` is pinned at 8.23.0 and the migration script explicitly declares `@next/env` 16.3.4. Pages Router, the design, forecast calculations and database configuration remain intact.

Removed unused `@vercel/postgres`, `date-fns`, `postgres`, `slugify` and `zod`. A clean dependency install removed the empty Contentful directory. Read-only source/configuration checks established that the three Contentful variables in each Vercel project had no consumer; those six settings were removed and absence verified. Provider accounts were unchanged and historical Contentful records remain archived.

The removed `next lint` command is replaced by ESLint 10 with compatible official Next.js and React Hooks plugins. Every build now runs lint. Legal-page links use Next.js navigation and authentication effects explicitly declare the values they use. The remaining avatar-image warning is recorded for B7's media work.

## Verification

- Incremental Next.js 15.5.25 / React 19 checkpoint: all 81 original regression tests and build passed before the final major upgrade.
- Final Node.js 22 clean install: `npm ci`, a valid `npm ls --all` tree, zero known vulnerabilities from `npm audit`, 83 passing regression tests and successful lint/build. Initial audit: four vulnerable packages, one critical and three high. These are registry findings, not a claim that every advisory was exploitable in this app.
- Final production-mode rehearsal, staging and production each passed all 13 scenarios in [check-school-access-release.mjs](../../../scripts/check-school-access-release.mjs): platform school edits; anonymous denial; school boundaries; platform-only management; assigned instructors; own-student booking; response privacy; inconsistent legacy-link isolation; minimal public schedules; invalid identifiers; edit/cancel/rebook; demo isolation and full forecast; removed test routes and health.
- Final development configuration also passed browser login, forecast loading and a JSON response from the nested lesson-conditions API.
- Both live environments passed isolated Chrome checks at 1440 px and 390 px. Simulated Bico/Praia Grande locations selected the nearest spot automatically and sorted every one of the 17 catalogue entries by independently calculated distance. A–Z switching, preservation of manual selection, explicit spot links and simulated permission-denied fallback passed.
- Hourly swell details opened on desktop and mobile. Tide selection responded to keyboard and simulated touch. All 16 forecast tiles rendered; screenshots confirmed the existing layout and colour treatments. Light/dark switching, mobile-menu dismissal, forecast refresh, legal navigation and logout/revocation passed. No captured browser runtime/hydration errors occurred.
- Vercel runtime error/fatal log queries returned no matching entries during verification for either runtime deployment. Production build logs confirmed Next.js 16.3.4, Webpack and the lint build step.

The browser checks use simulated device dimensions/location/touch in Chrome. They do not establish physical iPhone/Safari or real GPS behaviour. The current Next.js browser requirements apply; WebKit was not installed in the available test runtime. No extra browser runtime was installed for this release.

## Rehearsal findings

The new default Turbopack development server returned framework HTML 404s for nested lesson routes despite a successful build. The release therefore retains Webpack explicitly for both development and production. Webpack's production-mode rehearsal and both deployed environments passed the affected routes. A separate bundler migration must repeat these checks.

The new school-edit scenario exposed two test-fixture assumptions: cleanup needed the edited name, and the public-page check needed the database-generated updated slug. The test now preserves the returned school identity/slug and writes its cleanup manifest after editing. Exact failed-run fixtures were removed; subsequent runs cleaned themselves successfully. These were test-harness corrections, not production data changes.

## Data, cleanup and rollback

No schema migration, database copy, spot/calibration write or account reset was required. Each completed environment check removed its own schools, accounts, lessons and bookings. Post-release counts in each environment: 17 active spots, seven active schools, five active accounts and no A1/A2 access-check fixture schools/accounts. Sessions, login counters and forecast caches can change normally during testing and subsequent use.

Private connection exports were temporary; do not commit them or browser session state. Temporary browser contexts and local test servers were closed. Disposable test records were selected by exact IDs and unique run names; unrelated records were preserved.

The previous Git baseline was `b6e13451a9b6e5357c7b1f608294df0d666918e5`, with A1 runtime `9c96b5fc76f51153f6081da62b9ee788915b04e7`. An application rollback does not require restoring the database. Prefer a forward fix: returning to the previous dependency set would restore the dated audit findings. Rebuild a rollback in the correct Vercel project/environment and verify its custom domain; do not alias a staging artifact onto production. Contentful settings are unnecessary for either A1 or A2 and should not be restored for rollback.

## Next task

A1 and A2 are complete. A3 is the next small decision task: authentication, transactional email and background jobs, including costs and EU-region requirements. It precedes B1/B2 global membership and authorisation implementation. Localisation and the EU migration remain planned work; this release implements neither.
