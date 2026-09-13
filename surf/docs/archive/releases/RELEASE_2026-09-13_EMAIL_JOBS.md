# Email jobs foundation, 13 September 2026

Status: local implementation and rehearsal tests passed; staging database migration applied. Application deployments and post-deployment checks pending. Sending and scheduling remain disabled by owner decision until registration readiness.

Scope: additive queue schema, bounded worker, untracked Mailjet adapter, authenticated/deduplicated callbacks, quotas, encrypted payloads and branded Support email shell. There are no changes to existing app UI, forecasts, login/session rules or business records. The only allowed template is an operator delivery check; B3 registration is not implemented by this release.

Verification so far: 13 real PostgreSQL queue scenarios passed on the isolated Frankfurt rehearsal branch. Temporary fixtures were removed and no external email was sent. The initial 118-test regression run and production build passed; the added branding test and final build are being verified before deployment. The only lint warning is the existing image-element warning in `components/workspace/ui.js`.

Migration ID: `20260913_email_outbox`. Checksum: `d5322fee60dc5eec5d6a7dec722be6647b65b44ccf7183c6f65da187163614a8`. Migration DDL rollback was tested before applying to rehearsal and staging. Separate database environment bindings are intentional.

Outstanding activation: Mailjet API credentials are absent from both live Vercel projects; staging sender/subaccount isolation and actual account quota require verification. Real inbox rendering/delivery, authenticated provider callbacks, independent operational alerts, key recovery/retention review and minute scheduling remain before real registration. The owner will upgrade Vercel when registration needs the worker. This release does not complete the broader A6/A7 milestones.

See the [operations and activation runbook](../../EMAIL_JOBS_RUNBOOK.md).
