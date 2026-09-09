# Initial database promotion, 5 September 2026

> Archive status: dated migration evidence extracted from the former staging guide on 9 September. Branch references, parity claims and rollback instructions describe the original release. Check the [current handover](../../HANDOVER.md) and [environment guide](../../ENVIRONMENTS.md) before any operation.


The owner approved promotion and asked to preserve production-only records by adding them to staging first. The merge added two schools, one login account, three coaches, three students, four lessons, four instructor assignments and five bookings. Seven legacy lessons and seven legacy bookings were retained in their original tables. Existing staging records were preserved; the duplicate owner login was matched by email. All imported active lessons were linked to database spots.

The merge was rehearsed on `br-proud-term-adeg3v5t`; a second run added no duplicates. The reusable script is `scripts/merge-production-into-staging.mjs`. It defaults to a rollback and requires `--apply` for writes. Copying existing login credentials also requires `--include-login-credentials` and explicit approval. It never prints password hashes.

Production now uses `br-weathered-silence-adp30k9s`, copied from merged staging. Both environments have the same schema and business records at promotion. They remain separate databases, so new bookings, logins and forecast-cache refreshes can diverge afterwards. Server-side database variables and session-signing secrets are scoped separately to each environment.

Rollback resources retained in Neon:

- Original production branch: `br-gentle-dawn-ad5l1p9y`.
- Production backup branch: `br-muddy-pine-ad5ohatp`.
- Production snapshot: `snap-old-king-adiyxhgw`.
- Staging before the merge: `br-restless-water-addipfh1`.

To roll back, restore the previous production database variables from the original branch and redeploy the previous production code, `520d826`. Do not discard later production writes without reconciling them first.
