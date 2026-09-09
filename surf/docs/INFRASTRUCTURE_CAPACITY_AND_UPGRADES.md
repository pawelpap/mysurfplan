# Infrastructure capacity and upgrade decisions

Account state checked 8 September 2026; purchase timing revised 9 September at the owner's request. Read-only review for [implementation roadmap A5/A7/A8 and L1](IMPLEMENTATION_ROADMAP.md). No plan, payment method, account connection, region or branch was changed. Prices and allowances must be checked again in the current billing screen before purchase.

Commercial-only purchases are scheduled immediately before the first use that requires them, with time to configure and test. Early work checks permitted use and technical limits without activating subscriptions unnecessarily. Capacity, security and recovery requirements remain reasons to upgrade earlier. This replaces the previous default recommendation to prepare immediate Vercel spending and target Neon Launch for every G1 pilot.

The [9 September monthly estimate](LAUNCH_COST_ESTIMATE.md) uses current public prices and explicit small-launch assumptions: €29 forecast access plus US$20 hosting as the minimum paid combination, and approximately €70–100/month as a working allowance with conditional database/email costs. It includes both environments' consumption, distinguishes usage estimates from licence prices and separates payment fees. Effective account billing still needs verification before purchase.

## Live account findings

| Service | Verified state | Evidence and limits of this check |
| --- | --- | --- |
| Vercel | Team `pawelpaps-projects` is on **Hobby**. Both `mysurfplan-staging` and `mywaveplan-prod` belong to that team. | Connected Vercel team/project API. Aggregate billed usage, seats, tax and Marketplace checkout terms were not exposed by these tools. |
| Neon | Project `neon-lime-house` (`shy-paper-68550619`) belongs to a **Free** organisation managed by Vercel; project API reports `free_v3`. | Connected Neon project/organisation API. A Vercel plan upgrade must not be assumed to upgrade the separately selected Neon plan. |
| Neon branches | **10 existing branches / 10 permitted**. Two are staging/production; eight are retained rehearsal or earlier backup branches. | Connected branch inventory and project-owner limit. Another rehearsal branch was already refused during the preceding release. None was deleted in this review. |
| Neon database size | Production branch logical size **34,062,336 bytes**, approximately **32.5 MiB**. Reported branch logical-size limit: **512 MiB**. | This is one branch's logical size, not the project's billed storage consumption. Do not add cloned branch sizes as if they were independent physical copies or infer exact project headroom from this value. |
| Neon restore setting | Project API reports `history_retention_seconds = 86400`, or 24 hours. | Public Free pricing currently describes a shorter restore allowance. The effective Vercel-managed/legacy entitlement and actual restorable history must be checked in the console and rehearsed before relying on this setting. |
| Neon location | **AWS us-east-1**, shared by the project's staging and production branches. | This is a factual hosting location, not a legal-compliance determination. Confirm the hosting policy before public registration. A subscription upgrade is not a region migration. |

The Neon API supplied counters for 1 September–1 October 2026, but this review does not claim a complete bill forecast or a verified percentage of the applicable compute allowance. A7 must capture effective Marketplace quotas, actual current-cycle consumption and expected load before choosing budget caps.

## When to upgrade

### Vercel: activate Pro at the commercial trigger, or earlier for a technical need

Hobby is restricted to personal, non-commercial use. Vercel includes financial-gain deployments and service promotion in its commercial definition. Move the commercial-only Pro purchase to L1 before the first qualifying activity; do not assume a free pilot, staging environment or business development project is exempt. A5/L1 must classify current as well as proposed use. If the current deployment already qualifies, the trigger is now rather than a later launch. This planning revision does not determine that classification or change the provider's terms. [Vercel fair-use guidelines](https://vercel.com/docs/limits/fair-use-guidelines)

Pro is currently listed from **US$20/month**, with **US$20 usage credit**, plus applicable resource usage, additional paid seats and taxes. Staging and production are projects in the same team; do not budget a separate base subscription for each project without checking the selected billing configuration. Exact seats, included usage and charges require the team's checkout/usage view. [Vercel pricing](https://vercel.com/pricing)

There can also be an earlier technical reason: Hobby cron jobs run at most daily with an hourly scheduling window; Pro supports minute-level schedules. A3/A6 must select a job approach that meets actual email retry, booking expiry and reconciliation needs. Upgrade through A7 if the chosen technical requirement needs it, rather than postponing required reliability to L1. Workers still need idempotency, retries and request-time expiry checks. [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

No evidence currently justifies Enterprise. Revisit only for an explicit support/SLA/security requirement or a measured need outside Pro. High usage alone first requires cost/query/cache optimisation and a Pro usage estimate, not an automatic Enterprise upgrade.

### Neon: upgrade when capacity or recovery requires it

There is a current development constraint: all ten branch slots are occupied. Before B1, inventory which old branches are still needed for rollback. Prepare a named deletion/expiry list for approval or reuse a confirmed isolated rehearsal branch. Never remove production/staging or a required recovery point to create room. More branch slots are a reason to review paid capacity if the retained branches are all needed, not a reason to skip migration rehearsal.

Before real customer bookings at G1, select and rehearse sufficient recovery under A6/A7. **Launch is a candidate if the effective Free plan cannot meet that requirement**, not an automatic purchase for commercial launch. Keep Free while its verified technical limits and accepted recovery policy suffice. Do not reduce the required recovery standard merely to avoid a paid plan.

The currently published comparison lists Free at 100 CU-hours/month/project, 0.5 GB/project, ten branches and up to six hours of restore history. Launch lists usage-based compute at US$0.106/CU-hour and storage at US$0.35/GB-month, with up to seven days of restore history; history and excess branches also have charges. Scale supports a longer window and additional operational controls. These published figures do not override the effective Vercel-managed account terms, which A7 must verify. [Neon pricing](https://neon.com/pricing)

Request the paid-plan decision earlier if the measured/projected compute, storage or transfer would reach a verified cap, if branch capacity blocks necessary work, or if the chosen recovery policy exceeds Free's effective capabilities. Do not use an arbitrary user-count threshold. Frequent app polling and background jobs can keep both staging and production computes active even with few users.

Compare Launch if a documented constraint remains after sensible branch/data lifecycle management. Revisit Scale only when its restore/security/support capabilities or measured compute ceiling are needed. Do not treat a website's typical-spend example as a fixed subscription quote, and do not promise a total monthly bill from the current small database size.

The organisation is Vercel-managed. Neon Native Integration billing is managed through Vercel; review the existing integration's plan configuration rather than reconnecting or creating another provider account. Hosting Pro and Neon Launch are separate decisions and costs. [Neon on Vercel](https://vercel.com/integrations/neon)

## Commercial activation checkpoint

L1 is a release/test checkpoint, not a purchase at the start of development. Record the first triggering activity per service, the licence/plan scope including staging, estimated provisioning time and the latest safe activation point. Activate only what is required and run the affected checks before that activity begins. Review coverage again for new paid or promotional uses without buying duplicate subscriptions.

| Service category | Early work | Purchase/activation timing |
| --- | --- | --- |
| Forecast, marine, weather and tide sources | A5 checks permitted evaluation, attribution, caching/archive rights, rate limits and required API capabilities | L1 before the first use requiring a commercial hosted-service entitlement; earlier only if a needed capability or volume requires paid access |
| Vercel hosting | A5/A7 check deployment-use classification and technical fit | L1 for commercial-use requirements; A7 earlier if technical limits require an upgrade. Current qualifying use cannot be deferred by renaming it a test. |
| Neon | A7 resolves branch capacity, quotas and tested recovery | When a verified capacity/recovery/security requirement needs a paid tier, independently of the first sale |
| Authentication, email, media and other services | A3/A6/B7 choose a viable implementation, check terms, security, retention and available test capabilities | Retain a permitted adequate free/sandbox tier; activate commercial-only access at L1. Pay earlier only for a required capability, delivery/volume or operational guarantee. |
| Payment services and optional commercial tools | Design and test within their permitted sandbox/evaluation scope | Activate applicable live billing/service terms before the corresponding commercial test or release; no subscription merely because a later roadmap feature mentions a provider |

Open-Meteo's pricing page permits evaluation/prototyping on its free tier. Its terms distinguish that from commercial products, subscriptions, advertising and promotional use, which require appropriate service access. The underlying data attribution licence and permission to call the free hosted API are separate checks. Keep attribution throughout development; purchasing a plan does not remove it. [Open-Meteo pricing](https://open-meteo.com/en/pricing), [Open-Meteo terms](https://open-meteo.com/en/terms)

The planned real-school G1 pilot must be assessed before invitations or demonstrations that constitute commercial use, even if MyWavePlan charges nothing during the pilot. Paid school subscriptions G2, live lesson payment tests G3 and sponsorship R2 require a fresh coverage check. Pure local fixtures need no hosted-service purchase; deployed tests and provider-backed research use the applicable terms. The terms check is lightweight and early precisely to identify the correct trigger without starting recurring fees prematurely.

## Region and environment decision

On 9 September the owner expressed an EU-first storage preference for the Portuguese launch. Record this policy now; A8 selects the exact EU database region and nearby application backend alongside A4's processing/contract review and A7's capacity review. Settle the destination before new provider provisioning and complete the agreed migration before opening real self-service registration or school onboarding. The last verified database location remains AWS us-east-1, checked 8 September; this documentation does not change it.

Apply the policy to a data-location matrix covering the primary database, replicas/recovery copies, image originals/derivatives, exports, application processing, logs and external email/auth/payment/analytics providers. Specify EU storage where supported and record actual processing, support access and subprocessors separately. Review any non-EU processing/transfer and its applicable safeguards; an EU database alone is not an assurance that every service stays in the EU. [European Commission guidance on transfers](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/rules-international-data-transfers_en)

Rehearse the EU move as a separate migration: provision the agreed destination, copy only the intended data, reconcile schema/IDs/links, update environment secrets in a controlled order, verify authentication and forecasts, test restore and document rollback. Validate staging before a controlled production cutover with a write freeze or tested synchronisation to prevent lost writes. Inventory and retire the old database, branches, exports and recovery copies under a documented rollback/retention window; do not claim the move is complete while untracked old copies remain. Check actual app function regions before choosing the destination. The current project API did not establish those runtime regions. Neon documents migration into a new-region project through its import tooling. [Neon migration guidance](https://neon.com/blog/easiest-way-migrate-postgres-database-neon)

Staging and production may retain separate branches during the prototype. Before launch, decide whether production needs its own project for independent quotas, isolation and recovery. Do not multiply free projects to evade limits. Separating environments or moving regions is additional work within A8, not an effect of purchasing a subscription.

## Measurement and approval checklist for A7 and L1

1. Confirm current paid-seat count, integration billing scope, effective quotas/restore entitlements, monthly usage and current branch inventory in the provider dashboards.
2. Estimate pilot load using forecast requests/cache misses, login/session queries, active compute time, background frequency, storage/history growth and email/media traffic. Include staging and retained branches; separate forecast-provider costs from hosting.
3. Separate each proposed expense into a technical/operational requirement (A7 or the affected task), a commercial-use entitlement (L1), or optional convenience. Record the actual trigger, then prepare the exact plan/configuration and budget for approval when due. Confirm autoscaling limits, scale-to-zero behaviour and restore window per endpoint.
4. Add warning thresholds at 70% and 85% of the approved budget or verified hard quota, plus projected month-end usage. These are proposed internal alert thresholds, not provider limits. Decide emergency behaviour explicitly; silently pausing production can interrupt bookings and webhooks.
5. With approval and at the recorded trigger, apply the selected upgrade/configuration through the existing accounts; verify affected environments, forecast endpoints, background jobs and recovery behaviour. Allow verification time before the test/release. Do not combine it with unrelated account reconnection or a database move.
6. Review capacity before G1, G2 and G3, after public forecast traffic grows, and after media/payment/package releases. These are roadmap checkpoints, not an active scheduled automation.

The immediate work is the permitted-use classification and technical branch/recovery review. Commercial-only activation waits until its recorded trigger; this is not a blanket exemption for the current live app. No paid plan was purchased or changed by this update.
