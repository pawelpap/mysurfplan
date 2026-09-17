# MyWavePlan

17 September: [forecast window and small-surf changes](docs/archive/releases/RELEASE_2026-09-17_SMALL_WAVE_STAGING.md) are ready for staging review. Production remains unchanged pending owner approval.

Surf school lesson and booking management built with Next.js Pages Router, React and Neon Postgres.

Use Node.js 22 (`.nvmrc`). Install dependencies with `npm ci`. Configure `DATABASE_URL` and `SESSION_SECRET` in a local, ignored `.env.local`, using the staging database for development. Run `npm run dev`, `npm test` and `npm run build` from this directory. Builds include linting; see the [dependency baseline](docs/DEPENDENCY_BASELINE.md) for versions, audit and bundler decisions.

## Documentation and current work

The approved conditions layout, device-based light/dark appearance, colour-coded quality tiles and automatic nearest-spot ordering are live on https://mywaveplan.com and https://staging.mywaveplan.com. Production follows `main`; staging follows `staging`. Future changes must be verified on staging before production, with the owner’s approval or task-specific authorisation to promote after passing tests.

- [Start here: documentation index](docs/README.md)
- [Current handover and latest recorded release](docs/HANDOVER.md)
- [Current implementation roadmap: tasks, effort and launch gates](docs/IMPLEMENTATION_ROADMAP.md)
- [Current product development plan](docs/DEVELOPMENT_PLAN.md)
- [Local setup, staging and production](docs/ENVIRONMENTS.md)
- [Historical plans, releases, audits and calibration evidence](docs/archive/README.md)

The roadmap is the canonical remaining task list; the product plan explains its direction. A1/A2/A3/A8, B1/B2 and F17/F18 are complete. The email/job foundation is deployed with sending and scheduling disabled; the Zoho mailbox is verified. Next is A4/B6 reviewed legal pages and acceptance records, then A9 localisation foundations and B3 registration. Finish email activation before registration goes live. The Caparica comparison is closed; broader forecast validation remains F19. Use the handover for current deployments, outstanding work and provider purchase timing.

The app can also be added to a phone home screen, including iPhone, with the MyWavePlan wave icon and a standalone launch into Conditions. Browser-tab icons are supplied in SVG and ICO formats.

## Surf conditions

Both environments include a 16-day Conditions screen and forecasts during lessons. Spots, calibration and shared forecast data are stored in Neon. For an existing staging database, apply `node scripts/migrate-conditions.mjs --staging` only after verifying the database endpoint. This has already been done for the current staging branch.

See [Conditions architecture and sources](docs/CONDITIONS_ARCHITECTURE.md) for setup, global spot support, forecast freshness, tide datum and calibration limits. The free Open-Meteo endpoint is for non-commercial use; configure the server-side `OPEN_METEO_API_KEY` for licensed commercial access before commercial use.
