# MyWavePlan current handover

Updated 11 November 2026. This is the current operational handover. The [roadmap](IMPLEMENTATION_ROADMAP.md) owns task status; the [development plan](DEVELOPMENT_PLAN.md) owns product direction. [Release evidence](archive/releases/RELEASE_2026-11-11_STAFF_INVITATIONS.md) · [Environment guide](ENVIRONMENTS.md) · [Next-session brief](NEXT_SESSION_PROMPT.md).

## Current release

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

Start B5 with a bounded draft-school onboarding release: create a school and accountable owner membership atomically, add basic school settings/contact details/timezone/spots, and keep draft, workspace activation and public listing separate. Publish the school-processing agreement and record acceptance by an authorised representative before independent schools onboard. Preserve invitation acceptance and school boundaries.

Use B7's selected Vercel Blob Frankfurt media foundation before adding logo, cover or gallery uploads. Claiming, ownership transfer, richer branding and closure should be separately reviewable B5 releases. Do not infer ownership from a name, email domain, old administrator role or payment. Demo Surf School's legacy ownership stays unresolved until an explicit decision.

Recommended implementation model: GPT-6.1 Terra Codex, High reasoning, normal speed. Use Astra 6, High reasoning, normal speed for the ownership design and independent authorisation/migration review. New production releases need their own authority; this conversation's production approval applies to B4.

## Remaining boundaries

G1 school-pilot readiness is not complete. B5/B7 onboarding/media, B8 export/erasure, B9 application MFA, remaining B10 journeys, C1–C4 discovery/booking/operations and C7 acceptance still need their roadmap evidence. A4/A5/A6/A7 retain their broader provider, operating, capacity and business reviews. C5 precedes C6 optional tracking; trackers remain off. Paid subscriptions and online lesson payments are later D/E work.

Neon primary databases and app functions remain in Frankfurt, with environment-local credentials/data. This is not an EU-only claim for all processing. Vercel Pro was recorded active on 6 October; no plans or provider accounts were changed by B4. Existing Zoho Support and production failure alerts remain operational. See the capacity and cost records for dated assumptions rather than treating them as invoices.

## Working-copy and release workflow

This task used an isolated copy at output/b4/work/surf because the original checkout contained substantial uncommitted work and missed parts of the released email runtime. Original application files were preserved. Current remote main/staging and this isolated copy contain B4; do not deploy the older root checkout wholesale. Pre-closeout local documentation snapshots remain in output/b4/pre-closeout-docs.

Rehearse additive migrations on the existing isolated database, then staging, then an authorised production transaction. Applied SQL files stay immutable and checksummed. Preserve B2-compatible recovery, legal evidence, membership history and forecast settings. Do not clone environments. Use the existing MySurfPlan Chrome group, clean exact fixtures and stop local servers at closeout.
