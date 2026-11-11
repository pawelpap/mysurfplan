# B5 school onboarding release plan

Recorded 11 November 2026 after B4 closeout. The owner subsequently authorised implementation of release 1, staging deployment and independent user verification. Production promotion still needs explicit approval. Releases 2/3 and storage provisioning remain proposed scope. B4 remains complete. See the [implementation record](SCHOOL_ONBOARDING.md). Follow the owner's applicable implementation, independent-review and release authorisations.

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

Recommend GPT-6.1 Terra Codex, High reasoning, normal speed for implementation. Propose Astra 6, High reasoning, normal speed for independent ownership/access/migration review and live UI checks, following the owner's applicable review authority. The stronger review helps catch grants, concurrent ownership changes and cross-school access errors.

Verify every enabled language, relevant actual email receipt and links, desktop/tablet/mobile alignment and staging/production source parity for each authorised release. Preserve real records, remove exact task-only fixtures, close task Chrome tabs/groups, stop local check servers, leave staging cron off outside explicit tests and keep production cron running. B4 release approval does not authorise B5 deployment.
