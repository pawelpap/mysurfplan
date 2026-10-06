# Legal pages and evidence on staging

6 October 2026. Owner-authorised staging implementation for A4/B6. Production approval is pending. Complete text is in the intended routes, as requested, with no temporary review page. This is not a legal-approval record or completion of A4/B6.

## Delivered scope

- Full privacy notice, adult-pilot terms and school-processing agreement at `/legal/privacy`, `/legal/terms` and `/legal/school-processing`, with **PAWEL PAPLINSKI** and confirmed operator/contact details.
- Preserved `/legal` data licences, public storage information, login/workspace links and authenticated legal-record controls. Stable IDs and exact version/language/hash evidence; only English is implemented.
- Separate terms/school acceptance, server-side privacy-notice delivery and optional-preference history. No backfill or inferred consent. Current school representative authority is required; demo is read-only.
- Self-hosted Poppins 400/500/600/700, original subsets and licence. No optional trackers, consent banner, email sending, cron, registration or payment activation.
- Future GA4, Meta Pixel, LinkedIn Insight Tag, Google Ads and Microsoft Clarity named correctly as planned and inactive, with purpose-specific provider-role checks. [Provider/source assessment and remaining gates](../../LEGAL_IMPLEMENTATION.md).

Owner text is stored in ignored local files and immutable staging database records (`staging_preview`, `2026-10-06.1`, `en-GB`). It is public on staging by the owner's explicit instruction but excluded from the public Git repository. Host/project/database gates prevent preview records appearing on production. Production will need approved `published` content in its own database.

## Migration and compatibility

The additive migration was rehearsed on the existing isolated EU branch and rolled back. Its seven synthetic check groups passed. Staging application records were fingerprinted before/after migration, with no change. The three owner documents were imported only to staging. No accounts/sessions/calibrations were copied, invalidated or backfilled. [Rehearsal](2026-10-06-legal-staging/rehearsal.json) · [Staging migration](2026-10-06-legal-staging/staging-migration.json).

Live release checks create one disposable synthetic account and school, scoped by generated UUIDs, and remove their evidence, sessions and memberships afterwards. The read-only Demo student is used for existing forecast/browser verification. No real school/customer records or email payloads are created.

Compatible rollback is the previous B2 runtime, leaving the additive legal tables in place. Do not synchronise databases or destructively reverse the schema. Existing immutable evidence must remain identifiable. A future production migration/content publication needs separate authority and its own checks.

## Validation and security

All 145 tests pass. The build/lint passes with the existing avatar-image warning. Dependency tree is valid. Local desktop/mobile checks passed document links, layout/overflow, skip-link keyboard access, 18 spots, 16-day forecasts and login/demo boundaries. Synthetic flow checks passed evidence separation, exact version/language/hash, school permissions/revocation, CSRF, subject isolation, idempotence and withdrawal without blocking core access. [Local browser](2026-10-06-legal-staging/local-browser.json) · [Local flow checks](2026-10-06-legal-staging/local-release.json).

The live pre-release audit found Google Fonts requests and a seven-day Secure/HttpOnly/SameSite=Lax login cookie, with no anonymous storage/IndexedDB/Cache Storage/service workers in the checked journeys. Local after-change checks show only first-party requests. Screenshots containing owner text are retained privately, not committed. [Before audit](2026-10-06-legal-staging/before-browser.json).

Required npm audit found one critical Next.js and seven high dependency findings in the existing baseline. Next.js/@next/env/lint plugin were patched within the same release line to 16.3.6, and compatible transitive updates were applied. Runtime audit is now clear. Four high findings remain in the lint-only `@next/eslint-plugin-next → fast-glob → micromatch → braces` chain; no compatible fix was established, and npm's major downgrade was not applied. The critical advisory concerns `next/og ImageResponse`, unused by this app. [Official Next.js advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) · [Remaining braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Node.js 22, React 19.2.8, explicit Webpack, forecasting and B2 authority are preserved.

## Deployment and remaining decisions

Staging deployment `dpl_C32hhVHuYLunf1iP7FmqcM95q9HS`, commit `dc9c4f587d6c2e6251b2daceb86fbd0a29dfd748`, is READY in fra1, with a 33.563-second build. The custom-domain desktop/mobile and full synthetic flow checks passed. All four font weights loaded locally, appearance choices persisted, and no external font/tracker request was observed. [Deployment receipt](2026-10-06-legal-staging/deployment.json) · [Staging browser/storage/font checks](2026-10-06-legal-staging/staging-browser.json) · [Staging evidence/permission/withdrawal checks](2026-10-06-legal-staging/staging-release.json). Synthetic accounts, schools, sessions and legal evidence were removed; normal short-lived login security counters follow their existing lifecycle. Production alias remains on `dpl_G4jPfFRPZZpw5FyCWSX69Vyr8FvJ`, commit `5fc24f4b6296c1b2bec1f3c16a1600534a4191b8`. Earlier uncommitted changes were preserved. Production remains at its previous release. Production approval must follow owner review of the intended staging pages. Confirm purpose-specific bases/security assessment, actual provider agreements/transfers, retention/rights responsibilities, school instructions/entity/periods and applicable consumer complaints/ADR requirements before production publication or real onboarding. Fiscal/merchant decisions gate the respective paid flows. Meta effective terms and full Clarity terms could not be read in this source check; they remain activation gates. A4/B6 remain partial. A9 then B3 remains next, with A6/A7 email readiness first; C5/C6 remain inactive.
