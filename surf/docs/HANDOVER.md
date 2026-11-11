# MyWavePlan current handover

Updated 11 November 2026. This is the current operational handover. The [roadmap](IMPLEMENTATION_ROADMAP.md) owns task status; the [development plan](DEVELOPMENT_PLAN.md) owns product direction. [Release evidence](archive/releases/RELEASE_2026-11-11_STAFF_INVITATIONS.md) · [Environment guide](ENVIRONMENTS.md) · [Next-session brief](NEXT_SESSION_PROMPT.md).

## B5 release 1 in progress

The owner authorised private draft-school creation/text settings, staging deployment and independent user verification on 11 November. Production promotion still requires explicit approval. The [implementation record](SCHOOL_ONBOARDING.md) owns B5 evidence; the [release sequence](B5_RELEASE_PLAN.md) retains branding/B7 profile photos as release 2 and claims/transfer as release 3. Staging's B5 schema migration passed rehearsal/apply with unchanged existing data; the application candidate is not yet deployed. Production remains B4. Source parity below describes the completed B4 release, not permission to promote B5.

## B4 released baseline

B4 staff invitations, independent roles and team administration are live on [staging](https://staging.mywaveplan.com) and [production](https://mywaveplan.com). Both environments have identical application source. Their expected configuration difference is surf/vercel.json: staging has no schedule; production runs /api/cron/jobs every ten minutes. Staging Healthchecks is paused and production Healthchecks remains active.

The verified alignment runtime commits are staging 3bc0261aa545a096c541b106254fee2c5018f85c and production a945a3668b06a09c33ea4e42da5903078469fe34. Subsequent documentation commits do not change application behaviour. The release record owns the dated deployment receipts and verification limits.

## What is delivered

- Global accounts, independent school memberships, school boundaries, personal bookings and teaching views remain in place. The B1 bridge is retired; pre-B2 code is not a safe rollback target.
- Public signup, verified email, password recovery/change, personal-name editing and eligible self-closure were released on 4 November. Exceptions go to Support. Unverified legacy accounts need Support before accepting staff invitations.
- B4 adds seven-day invitations, explicit verified acceptance and historical instructor-record claims, owner-controlled administrator grants, school-scoped suspension/removal, per-account membership lists and minimal access audit records. Removed members return through a new invitation; a platform-only operational override remains protected in SQL.
- Mailjet delivers account and invitation messages with open/click tracking off. All four production invitation email versions were received and checked: English, European Portuguese, Spanish and French. Message text, action links and privacy links followed the selected language.
- Privacy and browser-storage notice version 2026-11-11.1 are available in all four languages. Production terms remain 2026-11-04.4. Terms acceptance, privacy delivery and optional preferences remain separate.
- Forecast/Conditions design, daylight windows, cached summaries and the existing calibration/archive work are preserved. Both environments retain 18 active spots. F19 accuracy/observation research is still open.

## Verification and cleanup

The release passed 193 automated tests, a Node.js 22 build, twelve transactional database check groups and six concurrent scenario groups. Independent Astra reviews covered architecture, permissions, privacy, language stability and visual alignment. Actual Chrome user journeys passed on staging and production, followed by received-email checks in all four languages.

The final visual fixes align invitation status/date columns across rows with different action counts, centre mobile role/action text and Legal toolbar text, and keep tablet actions visible. Both environments passed live desktop, tablet and mobile retakes. Mobile checks used browser viewports, not physical-device certification.

All accounts, schools, invitations and related fixtures created solely for this task were removed from both live environments. Existing accounts and real records were preserved. Task-created Chrome tabs/groups were closed, the existing MySurfPlan group was retained, and the local test server was stopped. Staging's temporary cron was removed and the live registry checked.

## Next development step

The proposed [B5 release plan](B5_RELEASE_PLAN.md) separates school creation/text settings, branding/publication with B7 media, and explicit claiming/ownership transfer. First create a draft school and accountable owner membership atomically, with a setup checklist, name/description, timezone, contacts, website/social links and operating spots. Keep draft, publication and pilot/trial access separate. Publish the school-processing agreement and record authorised acceptance before independent schools onboard. This first release does not require uploads or subscriptions.

Design School settings, the public-school presentation and a lesson-email preview coherently in Figma before implementing branding. B7 supplies separate Frankfurt Vercel Blob stores/credentials, private originals/drafts, public published derivatives, validation, metadata stripping, crop/resize, alternative text, quotas and cleanup. Include upload/crop/replace/remove for each user’s own profile photo in this second release, with personal ownership checks and the same secure media lifecycle. Personal photos do not wait for school claims, transfers or commerce. Reuse versioned branding later in C2/C4 without adding those journeys to B5. The recorded storage selection did not provision stores; verify current state before action. The [cost estimate](LAUNCH_COST_ESTIMATE.md#vercel-blob-media-budget) records shared Pro credit and current CDN treatment.

Claiming and transfer require explicit verified acceptance, recent authentication and atomic ownership changes. Never infer ownership from a name, email domain, old role or payment. Demo Surf School's legacy ownership stays unresolved until an explicit decision. Full erasure/retention remains B8; subscriptions and payments remain D/E.

Recommended implementation model: GPT-6.1 Terra Codex, High reasoning, normal speed. Propose Astra 6, High reasoning, normal speed for independent ownership/access/migration and live UI checks under the owner's applicable review authority. Release 1 implementation and staging deployment are now authorised. Storage provisioning and later releases remain proposed; B4 production authority applies to B4, so B5 production needs explicit approval.

## Remaining boundaries

G1 school-pilot readiness is not complete. B5/B7 onboarding/media, B8 export/erasure, B9 application MFA, remaining B10 journeys, C1–C4 discovery/booking/operations and C7 acceptance still need their roadmap evidence. A4/A5/A6/A7 retain their broader provider, operating, capacity and business reviews. C5 precedes C6 optional tracking; trackers remain off. Paid subscriptions and online lesson payments are later D/E work.

Neon primary databases and app functions remain in Frankfurt, with environment-local credentials/data. This is not an EU-only claim for all processing. Vercel Pro was recorded active on 6 October; no plans or provider accounts were changed by B4. Existing Zoho Support and production failure alerts remain operational. See the capacity and cost records for dated assumptions rather than treating them as invoices.

## Working-copy and release workflow

This task used an isolated copy at output/b4/work/surf because the original checkout contained substantial uncommitted work and missed parts of the released email runtime. Original application files were preserved. At B4 closeout remote main/staging and that isolated copy contained B4; B5 work is isolated at output/b5/work/surf. Production remains on B4 until separately approved; do not deploy the older root checkout wholesale. Pre-closeout local documentation snapshots remain in output/b4/pre-closeout-docs.

Rehearse additive migrations on the existing isolated database, then staging, then an authorised production transaction. Applied SQL files stay immutable and checksummed. Preserve B2-compatible recovery, legal evidence, membership history and forecast settings. Do not clone environments. Use the existing MySurfPlan Chrome group, clean exact fixtures and stop local servers at closeout.
