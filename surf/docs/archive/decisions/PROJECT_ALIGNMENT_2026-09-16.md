# Project reconciliation, 16 September 2026

The owner requested reconciliation of code, documentation and plans before further development, and confirmed that the Caparica comparison had been resolved in another project task. This record documents the checks and corrections. The [handover](../../HANDOVER.md), [roadmap](../../IMPLEMENTATION_ROADMAP.md) and [development plan](../../DEVELOPMENT_PLAN.md) remain the current references.

## Verified baseline

- Read the project tasks “Correct surf spot data” and the recent decisions in “Audit and improve app UX”. The comparison completed without a justified code or calibration correction. The owner confirmed its resolution in this reconciliation task. The [comparison report](../calibration/2026-09-15-four-spots/README.md) is now explicitly closed; F19 remains separate broader work.
- `git ls-remote` verified both GitHub deployment branches at `04d9c9a8ba15e06406ceae6101154cc391719a34`. Local development HEAD already matched. After checking ancestry and the single active worktree, the stale local `main` and `staging` references were fast-forwarded from `520d826385b25223337716d705d1932fbd18977f` to the same commit. The active branch and working files were preserved; nothing was pushed.
- The connected Vercel API resolved the actual custom-domain aliases, rather than relying on the latest project deployment, which can be a preview. Production is `dpl_GqXkCSbo6ADaqeJjGZ4EhYfyaqWp`; staging is `dpl_HkoAVr38g5uZhUmJJ3FHuZ3dCuic`. Both are READY, target `production` in their respective projects, point to `04d9c9a`, and use `fra1`. Both projects report Node.js 22.
- The current domain builds contain the same application code as `e6cfee77ee0517950107d0f01a76b7e0f900373f`. The intervening diff contains documentation only. Full release checks remain in the [13 September typography evidence](../releases/RELEASE_2026-09-13_EMAIL_TYPOGRAPHY.md); the 16 September metadata check does not replace those checks or claim a new browser/database audit.
- The connected Vercel team API still reports Hobby for `pawelpaps-projects`. Pro is recommended for continued deployed commercial use and required before minute scheduling. No plan purchase, account change or worker activation occurred.

## Code and plan boundaries

| Area checked | Existing implementation | Remaining roadmap work |
| --- | --- | --- |
| Legal information | `pages/legal.js` publishes data licences | A4/B6 reviewed privacy/terms, versioned acceptance and separate preferences |
| Website typography | `pages/_document.js` still requests Google-hosted Poppins | B6 self-hosting and external-resource review; email self-hosting is already delivered |
| Application email | `lib/email/config.mjs` defaults off and restricts enabled delivery to approved test recipients; `http.mjs` enqueues a fixed operator check; `worker.mjs` handles that message type only | A6/A7 credentials, staging sender, real delivery/callback tests, independent alerts and activation; B3 general recipients, urgent dispatch, verification/recovery templates and token flows |
| Scheduling | `vercel.json` sets `fra1` and contains no cron entry | A7 Pro scheduling and capacity checks; production schedule with staging off outside tests |
| Email retention | Current store/worker removes terminal metadata after 30 days; the earlier separate seven-day failure proposal is not implemented | A4/B8 final retention review and operational lifecycle |
| Identity | B1/B2 memberships and compatible sessions are delivered; existing password hash work factor remains in `lib/auth.js` | B3 registration/recovery/password hardening; B4 invitations; B9 MFA |
| Localisation and account lifecycle | No completed locale framework, reviewed consent or erasure workflow | A9/B10 localisation, B6 acceptance/preferences and B8 export/deletion |
| Media and school branding | Existing URL fields and the default UI/email shell | B7 selected Vercel Blob Frankfurt storage; B5/C2/C4 school settings, pages and lesson emails |

No runtime code change was needed to reconcile these boundaries. Planned features remain open rather than being marked complete because their architecture or initial schema exists. The existing avatar-image lint warning remains within B7.

## Documentation corrections

The reconciliation replaced outdated “next” instructions, latest-release references, mailbox setup claims and pre-B2 status. It corrected current operational references that still pointed to deleted US databases, distinguished the two-account B2 cleanup from the later three-account demo/A8 inventory, and retained unresolved Demo Surf School ownership without inferring an owner.

Vercel purchase timing now distinguishes commercial-use requirements from the technical scheduler deadline. The €90–120 monthly estimate is labelled as the conservative scenario with both endpoints continuously polled; the intended staging schedule remains off outside tests. Neon Launch and Zoho are recorded as already active. Blob is selected but unprovisioned. Dated supplier prices are planning inputs, not newly verified quotes or measured bills.

The full earlier handover is preserved as a [historical snapshot](../handovers/HANDOVER_2026-09-16_BEFORE_ALIGNMENT.md). Release evidence and historical migration records retain their original dates. The bounded comparison report received a current disposition note without replacing its numerical evidence.

## Agreed continuation

1. **A4/B6:** finish provider/purpose/retention review, then implement reviewed legal pages, versioned evidence, optional preferences and website font hosting. Owner identity, support contact and adult-only initial pilot are already confirmed. Do not publish the private draft text as reviewed policy.
2. **A9:** implement localisation foundations before the B3 journeys. English, European Portuguese and Spanish are the pilot languages; French is optional. B10 completes translations and verification before G1.
3. **B3:** implement registration, verification, recovery and profiles using the existing global identity model. Complete A6/A7 real email tests, isolation, alerts, Pro scheduling and capacity checks before activation. Retire temporary public Demo student access during B3/C7 readiness.

A5/L1 permitted/commercial-use checks apply at the activity that requires them. C5 precedes optional C6 tracking. B4/B5/B7/B8/B9/B10 and C1–C4/C7 remain the broader G1 requirements; B3 is not the whole pilot. School billing and online lesson payments remain G2/G3. F19 and conditional extensions do not displace this order.

## Validation and scope

- 119 automated tests passed. ESLint reported no errors and the one existing avatar-image warning.
- Documentation checks cover local links/anchors, the 71 unique roadmap IDs, eight completed items, current source/plan boundaries and stale operational wording. `git diff --check` passes.
- The repository contained pre-existing uncommitted branding/storage decisions, market research, calibration evidence and local skill files. These were preserved. The reconciliation edits remain local for review; no application deployment or purchase was made.
- Database placement, counts and recovery settings are sourced from the dated A8 evidence. Mailjet credential absence is sourced from the 13 September audit. No fresh database, credential, invoice or end-to-end browser audit is claimed here.
