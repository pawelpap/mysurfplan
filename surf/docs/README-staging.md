# Staging environment

The owner reviews changes at https://staging.mywaveplan.com. Production deployment is a separate step requiring the owner's approval.

The current conditions-presentation candidate and verification handover are recorded in [HANDOVER.md](HANDOVER.md). It requires no database migration. The owner must review it on staging before production; do not copy databases for this presentation change.

| Environment | Git branch | Vercel project       | Neon branch                     |
| ----------- | ---------- | -------------------- | ------------------------------- |
| Staging     | `staging`  | `mysurfplan-staging` | `br-small-salad-adx0nsj2`       |
| Production  | `main`     | `mywaveplan-prod`    | `br-weathered-silence-adp30k9s` |

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

The current production release uses a copy of the verified staging database, including all conditions and username migrations.

## Forecast access

The app fetches Open-Meteo forecasts and calculates tides from open harmonic constants. See [Conditions architecture](CONDITIONS_ARCHITECTURE.md) for model choice, licences, data sources, refresh behaviour and initial calibration limits.

The free hosted forecast endpoint is restricted to non-commercial use. Set the server-side `OPEN_METEO_API_KEY` for licensed commercial access before commercial use. The app then selects the customer endpoints automatically. No browser-exposed key is needed.

## Deployment and review

Push the reviewed work to `staging`, wait for the staging project's deployment to become ready, then verify the custom staging domain. Confirm the production alias still points to its previous deployment.

`Demo Surf School` contains sample lessons and people for testing in both environments. Preserve user-created schools and lessons. New lessons must select a spot from the database dropdown.

The optional-username migration `db/migrations/20260905_login_usernames.sql` has also been applied to staging. It supports the student-only review login `teststudent`, scoped to the demo school. Existing email login is unchanged. Apply this migration before the username-aware login code in any other environment. The same student-only account is included in the approved production release.

## 5 September 2026 production release

The owner approved promotion and asked to preserve production-only records by adding them to staging first. The merge added two schools, one login account, three coaches, three students, four lessons, four instructor assignments and five bookings. Seven legacy lessons and seven legacy bookings were retained in their original tables. Existing staging records were preserved; the duplicate owner login was matched by email. All imported active lessons were linked to database spots.

The merge was rehearsed on `br-proud-term-adeg3v5t`; a second run added no duplicates. The reusable script is `scripts/merge-production-into-staging.mjs`. It defaults to a rollback and requires `--apply` for writes. Copying existing login credentials also requires `--include-login-credentials` and explicit approval. It never prints password hashes.

Production now uses `br-weathered-silence-adp30k9s`, copied from merged staging. Both environments have the same schema and business records at promotion. They remain separate databases, so new bookings, logins and forecast-cache refreshes can diverge afterwards. Server-side database variables and session-signing secrets are scoped separately to each environment.

Rollback resources retained in Neon:

- Original production branch: `br-gentle-dawn-ad5l1p9y`.
- Production backup branch: `br-muddy-pine-ad5ohatp`.
- Production snapshot: `snap-old-king-adiyxhgw`.
- Staging before the merge: `br-restless-water-addipfh1`.

To roll back, restore the previous production database variables from the original branch and redeploy the previous production code, `520d826`. Do not discard later production writes without reconciling them first.
