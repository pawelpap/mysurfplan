# B5 school onboarding release plan

Recorded 11 November 2026 after B4 closeout. The owner authorised all three B5 stages for implementation and staging verification, delivered as separately reviewable increments. Each stage needs meaningful automated checks, deployment, Astra human-user/permission review and correction of confirmed findings before proceeding. After all stages, run integrated automated and Astra browser/security/migration checks, then present the complete staging experience with an acceptance checklist and prepared test accounts/data. Wait for the owner's integrated staging review and explicit production approval before deploying any B5 code or migrations to production. No B5 stage is promoted separately. Preserve B4 production, environment settings and unrelated work. The [implementation record](SCHOOL_ONBOARDING.md) tracks current evidence.

[Acceptance and verification criteria](B5_ACCEPTANCE_CRITERIA.md) apply before each remaining implementation stage.

## 1. School creation and text settings

A registered person creates a draft school and its accountable owner membership atomically. Include a setup checklist, school name, introduction/description, timezone, contacts, website/social links and operating spots. Keep draft, public publication and pilot/trial access separate. Record authorised school-processing agreement acceptance before independent schools onboard.

Preserve B4 school boundaries and invitations. Prevent duplicate ownership grants and test concurrent requests and rollback after failed setup. Never infer ownership from an email domain, old role or payment. Keep Demo Surf School's unresolved ownership separate. This release can proceed without image uploads or subscriptions.

## 2. Branding, profile photos and publication with B7 media

Before interface implementation, design School settings, the public-school presentation and a lesson-email preview coherently in the existing [Figma app file](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ). The preview designs establish shared branding; C2 public-page and C4 lesson-email journeys remain later scope.

Add a logo, cover, bounded gallery and constrained accessible accent colour. Support save draft, preview, explicit publish and reset defaults. Store shared versioned branding so later pages and emails use consistent published settings and retain the version needed for retries.

Include personal profile photos in this second release. Profile settings let each user upload, crop, replace and remove their own photo. Reuse the secure media foundation with personal ownership checks, validation, metadata removal, resized variants and lifecycle cleanup. Personal photos do not depend on school claims, ownership transfers, subscriptions or payments. Include the profile settings flow in the Figma review.

B7 provides validation, metadata stripping, crop/resize, alternative text, quotas and orphan/replacement/deletion handling. Use Vercel Blob in Frankfurt (`fra1`), separate staging/production stores and credentials, private originals/drafts and public published derivatives. Neon stores ownership, asset references and metadata, not image files. Storage was selected but not provisioned in the recorded plan; verify current live state before taking action. Verify access controls, provider terms, retention and delivery behaviour before making location claims.

## 3. Claiming and ownership transfer

Handle existing-school claims explicitly. Require verified acceptance and recent authentication, transfer ownership atomically and prevent unauthorised grants. Make transfer and closure controls clear. Full erasure and retention execution remain B8. Subscriptions are later D work; online payments are later E work.

## Cost and release checks

The [media budget](LAUNCH_COST_ESTIMATE.md#vercel-blob-media-budget) records the 11 November official-pricing check. Small-pilot images may fit remaining shared Vercel Pro credit; this is a conditional estimate, not unlimited free storage or a verified current invoice. Keep compression, quotas and spending controls. Neon remains separately billed.

Keep GPT-6.1 Sol as lead developer and orchestrator, High reasoning at normal speed for substantial implementation. This is a workload recommendation, not an automatic model change. The lead owns code integration, tests, deployments, fixes and documentation. Use bounded read-only Astra 6 High reviews at normal speed for design, ownership/access/claims/uploads/migrations and complex live journeys. Use a fresh verification agent separate from the design agent. Astra Medium is suitable for routine visual retakes. The lead reproduces findings, fixes code and reruns affected checks; avoid concurrent edits to the same files. Write failure, permission and concurrency acceptance criteria before coding. Record the exact deployed commit/deployment, results and unresolved findings, and recheck affected behaviour after material changes. Coordinate browser surface ownership. Automated checks and Astra browser reviews support the owner’s required staging acceptance; they do not replace it. The stronger review helps catch grants, concurrent ownership changes and cross-school access errors.

Verify every enabled language, relevant actual email receipt and links, desktop/tablet/mobile alignment and staging/production source parity for each authorised release. Preserve real records, remove exact task-only fixtures, close task Chrome tabs/groups, stop local check servers, leave staging cron off outside explicit tests and keep production cron running. After explicit integrated approval, deploy the reviewed B5 code and migrations, verify application parity while retaining environment settings, and run automated plus Astra live production checks with controlled fixtures. An optional final owner look at production does not replace the required staging acceptance. B4 release approval does not authorise B5 production deployment.
