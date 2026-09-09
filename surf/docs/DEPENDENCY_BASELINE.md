# Dependency baseline

Reviewed 9 September 2026 for roadmap task A2. Deployment status and verification evidence are maintained in [HANDOVER.md](HANDOVER.md).

## Runtime decision

| Package/runtime | Previous | Reviewed baseline |
| --- | --- | --- |
| Node.js | 22.x on Vercel | 22.x, local verification with 22.23.2 |
| Next.js | 14.2.3 | 16.3.4 |
| React / React DOM | 18.2.0 | 19.2.8 |
| Neon serverless driver | 0.9.5 | 1.1.0 |
| pg, used by maintenance/release scripts | 8.17.1 installed | 8.23.0 |
| @next/env, used by the conditions migration script | Transitive dependency | Explicit 16.3.4 dependency |

Next.js 16 is Active LTS; 14 is outside the supported lines. The migration was rehearsed incrementally through 15.5.25 with React 19 before moving to 16.3.4. The existing Pages Router remains in use. [Next.js support policy](https://nextjs.org/support-policy), [version 15 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-15), [version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16).

Development and production builds explicitly use Webpack, the app's previous bundler. A local Next.js 16 Turbopack development rehearsal returned framework 404 responses for nested lesson API routes. Retain Webpack until a separate change passes the same dynamic-route and booking checks; do not remove the flag merely because a Turbopack build compiles successfully. Automatic generation of agent instruction files is disabled with `agentRules: false`; repository guidance is maintained explicitly. The obsolete `optimizeFonts` configuration was removed. Browser font loading and the accepted design are preserved.

The Neon 1.x driver requires `sql.query(text, values)` for queries with explicit placeholders. Public lesson filtering and platform-admin school edits now use that API, with values bound separately from SQL. Tagged templates remain unchanged. No schema or data migration is involved. [Neon driver changelog](https://github.com/neondatabase/serverless/blob/main/CHANGELOG.md).

## Cleanup

Contentful has no current or planned application role. There were no imports or package/lockfile entries. A clean `npm ci` removed the empty generated `node_modules/@contentful` directory. The unused `CONTENTFUL_SPACE_ID`, `CONTENTFUL_ACCESS_TOKEN` and `CONTENTFUL_PREVIEW_TOKEN` settings were removed from both Vercel projects after verifying no source consumer. Other deployment settings and provider accounts were preserved. The historical June removal record remains archived.

Removed five dependencies after checking source and maintenance scripts: `@vercel/postgres`, `date-fns`, `postgres`, `slugify` and `zod`. The app uses the Neon driver; scripts still use `pg`. Tide prediction and SunCalc versions remain unchanged.

## Checks and maintenance

Run from `surf` with Node.js 22:

```sh
npm ci
npm ls --all
npm audit
npm test
npm run build
```

`npm run build` runs lint before the production build, so Vercel builds fail on lint errors. `npm run lint` is available separately. The baseline uses ESLint 10.10.0 with the official Next.js 16.3.4 plugin and React Hooks 7.1.1 plugin directly. The current `eslint-config-next` bundle includes React/import/accessibility plugins whose peer ranges exclude ESLint 10; installing that bundle would leave invalid peers. The direct plugin setup avoids that conflict and uses Next.js recommended/Core Web Vitals plus hook-order and hook-dependency rules. React Compiler is not enabled. This is not a complete accessibility or general code-quality audit. [Next.js direct plugin configuration](https://nextjs.org/docs/app/api-reference/config/eslint#using-the-plugin-directly).

One existing lint warning remains for externally supplied avatar images in `components/workspace/ui.js`. Image validation, storage and optimisation belong to B7; this release does not introduce an image proxy or unrestricted remote-image configuration.

The initial npm audit reported four vulnerable packages, including one critical and three high findings. After the clean install, the complete development/runtime dependency tree reported zero known vulnerabilities and no invalid peers. This is a dated registry audit, not a guarantee against future advisories. Recheck before each functional release and after relevant security notices. Review lockfile updates; avoid automatic forced major upgrades.

The release checks cover real authentication, permissions, public schedules, booking/edit/cancel/rebook, school edits, lesson forecasts and demo isolation. Browser checks must cover nearest-location selection and sorting before production, plus desktop/mobile forecasts, hourly details, tides, appearance, navigation and logout. Use isolated disposable fixtures and preserve operational data, sessions, spots and calibration history.
