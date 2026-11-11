# B5 acceptance criteria

11 November 2026. Sol is the lead for implementation, integration, fixes and evidence. Astra design and fresh verification agents review bounded scopes independently and read-only. Record exact commits/deployments and retest affected behaviour after changes. This extends the failure, permission and concurrency criteria used before release 1 implementation.

## Stage 1: private school creation and text settings

- A verified person creates one private draft and explicit active owner atomically. Missing/invalid input, unverified/demo/closed/disabled accounts and a failed membership insert leave no partial school.
- Identical actor/request retries return the same school; changed payloads conflict. Concurrent settings saves preserve one revision and reject stale edits. Creation races with account closure/deactivation have a valid serial outcome.
- Another account cannot read or edit the private draft. Platform authority may inspect but cannot edit a foreign draft. No owner/lifecycle/role fields can be forged through settings or legacy endpoints.
- Draft creation, settings and exact agreement evidence stay separate from operational/pilot approval and public publication. Drafts cannot use lessons, bookings, invitations or student affiliation. Existing B4 and legacy operations remain valid.
- Operating spots are an accessible multi-select. Persist every selected association and preserve it across editing, saving, locale/theme changes and setup navigation. Full B5 must let an authorised user create one lesson at each of at least two selected spots, with a clear per-lesson selector limited to school operating spots and server-enforced school/active-spot permissions. Preserve existing associations during migration. Removing a spot referenced by ongoing/future lessons must produce a safe explicit outcome without deleting/corrupting lessons or bookings; test concurrent settings/lesson writes.
- Creation asks only name/timezone and clearly identifies the owner. Settings save/reload, checklist saved-value progress, validation, errors/conflicts and explicit reload work in every enabled language and viewport. Language switching preserves inputs. Mobile checklist links keep targets below the sticky header.

## Stage 2: branding, publication and secure media

- Review coherent Figma designs for School settings, public presentation, lesson-email preview and personal photo controls before interface implementation. Later C2/C4 lesson journeys remain separate scope.
- Each person can upload, crop, replace and remove their own profile photo. Authorisation is checked on every operation; a user cannot select another user's asset or school asset. Private originals/drafts never become anonymously accessible.
- School logo, cover, bounded gallery and accessible accent colour require current school settings authority. Draft edits do not change published branding until explicit publish. Preview does not publish. Reset defaults is explicit and leaves a clear outcome.
- Validate actual image bytes, format, pixel dimensions, animation, crop bounds, byte/count quotas and file sizes. Strip metadata and create bounded resized variants. Reject malformed files, SVG/script content, spoofed MIME types and oversized/decompression-bomb inputs without storing active assets.
- Keep separate staging and production Frankfurt stores/credentials. Verify current inventory, region, access mode and spend controls before provisioning. During staging development do not configure production resources or deploy production code/migrations.
- Persist ownership, asset references, metadata and versioned published branding in Neon. Never trust client-supplied Blob URLs/pathnames or identifiers as authority. Public derivatives are created only for intentionally published content; original/draft delivery remains authenticated.
- Handle upload/storage/database failure and retries without dangling active references. Queue and verify orphan, replacement and deletion cleanup. Retain assets still referenced by a published version or immutable queued-email snapshot. Protect concurrent uploads/publications/removals and quota races.
- Provide alternative text and keyboard-operable crop controls. Image error/loading states do not cause avoidable layout jumps. Check all supported languages/themes and mobile/tablet/desktop before/after interactions.
- Update staging legal/storage disclosures to match actual storage, image processing, delivery, retention and rights controls. Clearly distinguish staging previews from published production documents. Do not infer that Frankfurt originals make all CDN processing EU-only.

## Stage 3: existing-school claims and ownership transfer

- Never infer ownership from a name, email domain, prior role or payment. A claim is an explicit reviewed request tied to the exact school and verified claimant. Unresolved legacy ownership remains unresolved until an authorised decision.
- Ownership transfer requires current owner authority, recent authentication, verified recipient acceptance and an atomic change. Reject replay, expiry, wrong account, changed account/school state and stale authorisation. Keep one valid active owner throughout.
- Concurrent claim/transfer/closure/deactivation operations must preserve valid ownership, memberships, audit records, other-school access and personal bookings. No self-service path grants platform authority or bypasses required agreements.
- Keep transfer, closure, suspension, removal and permanent erasure understandable and separate. Full erasure/retention execution remains B8. Test failure/recovery and direct API calls as well as UI affordances.

## Integrated staging and production gate

After each stage: meaningful automated tests, staging deployment, fresh Astra actual browser/permission review, verified fixes and affected regression checks. The browser reviewer must navigate and interact as a person, inspecting before/after layouts, alignment, clipping, stable controls, intended reflow and understandable feedback. Findings include reproduction, viewport/language/theme, exact deployed version, expected/actual outcome and visual evidence.

After all stages: integrated automated, Astra browser/security/migration reviews across school creation/setup, text settings, personal photos, branding, draft/preview/publication, claims and transfers. Cover lifecycle/concurrency and cross-school boundaries, actual relevant email receipt/links, all enabled languages/themes and mobile/tablet/desktop. Present the owner with the complete staging experience, a concise checklist and prepared accounts/data. Wait for that integrated review and explicit production approval.

After approval: deploy the reviewed code/migrations, verify application source parity while preserving environment settings, then automated and Astra live production checks using controlled fixtures. Repeat the same human-user acceptance matrix as staging, including navigation, language changes, loading/saving, validation/errors, status/publication and image workflows, all supported languages/themes and desktop/tablet/mobile. Verify the actual production commit/deployment and collect before/after visual evidence for movement, alignment, clipping and control consistency. Confirmed defects follow staging-first correction and the applicable production approval process, followed by Astra retesting of the affected production journeys. Source parity and automated success alone do not complete this acceptance. An optional owner look at production does not replace staging acceptance. Remove exact task-only fixtures and media when checks end; preserve real records and historical evidence. Close only task Chrome tabs/groups, stop check servers, remove temporary staging cron and retain production cron.

## Retained demonstration schools and cleanup

The owner requests one branded demonstration school per environment after development. Inspect and reuse suitable existing demo records; do not create duplicate demos, remove unrelated schools or silently assign unresolved legacy ownership. Both environments currently have the existing Demo Surf School with no explicit owner, no lessons and two student records. Preserve those pre-existing relationships and keep private records inaccessible. Platform-authorised demonstration branding must not invent an owner or imply a real business/staff claim.

Generate coherent demo logo/cover/description/accent with accessible variants and clear demonstration labels. Avoid personal contacts or fabricated real-business claims. Keep environment records, assets and credentials separate; production resources/publication belong to the approved rollout after integrated staging acceptance. Test demo boundaries and light/dark/mobile/language behaviour.

Remove all other exact task-created temporary accounts, schools, memberships, invitations, lessons/bookings, uploaded media and related fixtures through approved deletion/retention procedures. Preserve automated regression tests, real records, protected demo relationships, required evidence, forecasts and unrelated work. Coordinate cleanup with Astra and owner review so agreed review/demo data remains usable; record retained data and pending cleanup explicitly.
