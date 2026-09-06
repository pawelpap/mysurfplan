# MyWavePlan

Surf school lesson and booking management built with Next.js Pages Router, React and Neon Postgres.

Use Node.js 22 (`.nvmrc`). Install dependencies with `npm ci`. Configure `DATABASE_URL` and `SESSION_SECRET` in a local, ignored `.env.local`, using the staging database for development. Run `npm run dev`, `npm test` and `npm run build` from this directory.

## Current work

The task-oriented UX proposal is reviewed at https://staging.mywaveplan.com. Production at https://mywaveplan.com follows `main` and must only receive the proposal after the owner's staging review.

- [Current development plan](docs/DEVELOPMENT_PLAN.md)
- [Current handover and production approval status](docs/HANDOVER.md)
- [September UX and development audit](docs/UX_AUDIT_2026-09.md)
- [Staging environment](docs/README-staging.md)
- [Previous plan and history](docs/DEVELOPMENT_PLAN_ARCHIVE_2026-06.md)

## Surf conditions

The staging app includes a 16-day Conditions screen and forecasts during lessons. Spots, calibration and shared forecast data are stored in Neon. For an existing staging database, apply `node scripts/migrate-conditions.mjs --staging` only after verifying the database endpoint. This has already been done for the current staging branch.

See [Conditions architecture and sources](docs/CONDITIONS_ARCHITECTURE.md) for setup, global spot support, forecast freshness, tide datum and calibration limits. The free Open-Meteo endpoint is for non-commercial use; configure the server-side `OPEN_METEO_API_KEY` for licensed commercial access before commercial use.
