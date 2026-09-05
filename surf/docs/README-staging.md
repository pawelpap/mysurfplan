# Staging environment

The owner reviews changes at https://staging.mywaveplan.com. Production deployment is a separate step requiring the owner's approval.

| Environment | Git branch | Vercel project       | Neon branch               |
| ----------- | ---------- | -------------------- | ------------------------- |
| Staging     | `staging`  | `mysurfplan-staging` | `br-small-salad-adx0nsj2` |
| Production  | `main`     | `mywaveplan-prod`    | `br-gentle-dawn-ad5l1p9y` |

Both projects use application root `surf`. Neon project: `shy-paper-68550619`.

## Local setup

Use Node.js 22 and run `npm ci` from `surf`. Keep `DATABASE_URL` and `SESSION_SECRET` in an ignored `.env.local`. Verify that the database endpoint belongs to the staging branch before running migrations or local write operations. Never commit credentials.

Run `npm run dev`, `npm test` and `npm run build` from `surf`.

## Database setup

For a new empty database, apply `db/schema.sql`, then run the conditions seed script. For the existing staging database, only the additive conditions migration/seed was needed:

```
node scripts/migrate-conditions.mjs --staging
```

The script loads `.env.local`, adds the new tables and lesson spot reference, seeds 17 Portugal spots and the Cascais tide reference, and maps reviewed legacy lesson names. It preserves existing spot edits. The `--staging` flag is an acknowledgement, not automatic endpoint verification.

This migration has already been applied to the staging branch. It has not been applied to production.

## Forecast access

The app fetches Open-Meteo forecasts and calculates tides from open harmonic constants. See [Conditions architecture](CONDITIONS_ARCHITECTURE.md) for model choice, licences, data sources, refresh behaviour and initial calibration limits.

The free hosted forecast endpoint is restricted to non-commercial use. Set the server-side `OPEN_METEO_API_KEY` for licensed commercial access before commercial use. The app then selects the customer endpoints automatically. No browser-exposed key is needed.

## Deployment and review

Push the reviewed work to `staging`, wait for the staging project's deployment to become ready, then verify the custom staging domain. Confirm the production alias still points to its previous deployment.

The staging-only `Demo Surf School - UX review` contains sample lessons and people for testing. Preserve user-created schools and lessons. New lessons must select a spot from the database dropdown.

The optional-username migration `db/migrations/20260905_login_usernames.sql` has also been applied to staging. It supports the student-only review login `teststudent`, scoped to the demo school. Existing email login is unchanged. Apply this migration before the username-aware login code in any other environment. The owner has requested the same test account at production promotion, not before.
