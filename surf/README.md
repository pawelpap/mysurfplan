# MyWavePlan

Surf school lesson and booking management built with Next.js Pages Router, React and Neon Postgres.

Use Node.js 22 (`.nvmrc`). Install dependencies with `npm ci`. Configure `DATABASE_URL` and `SESSION_SECRET` in a local, ignored `.env.local`, using the staging database for development. Run `npm run dev`, `npm test` and `npm run build` from this directory.

## Current work

The approved conditions layout, device-based light/dark appearance, colour-coded quality tiles and automatic nearest-spot ordering are live on https://mywaveplan.com and https://staging.mywaveplan.com. Production follows `main`; staging follows `staging`. Future changes must be reviewed on staging and explicitly approved before production.

- [Current development plan](docs/DEVELOPMENT_PLAN.md)
- [Current handover and release status](docs/HANDOVER.md)
- [Add MyWavePlan to a phone home screen](docs/HOME_SCREEN.md)
- [Conditions presentation release, 6 September 2026](docs/RELEASE_2026-09-06_PRESENTATION.md)
- [September UX and development audit](docs/UX_AUDIT_2026-09.md)
- [Staging environment](docs/README-staging.md)
- [Previous plan and history](docs/DEVELOPMENT_PLAN_ARCHIVE_2026-06.md)

The app can also be added to a phone home screen, including iPhone, with the MyWavePlan wave icon and a standalone launch into Conditions. Browser-tab icons are supplied in SVG and ICO formats.

## Surf conditions

Both environments include a 16-day Conditions screen and forecasts during lessons. Spots, calibration and shared forecast data are stored in Neon. For an existing staging database, apply `node scripts/migrate-conditions.mjs --staging` only after verifying the database endpoint. This has already been done for the current staging branch.

See [Conditions architecture and sources](docs/CONDITIONS_ARCHITECTURE.md) for setup, global spot support, forecast freshness, tide datum and calibration limits. The free Open-Meteo endpoint is for non-commercial use; configure the server-side `OPEN_METEO_API_KEY` for licensed commercial access before commercial use.
