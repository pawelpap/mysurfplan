# Small-launch monthly cost estimate

13 September storage decision: the owner selected **Vercel Blob in Frankfurt (`fra1`)** for B7 media, replacing the earlier Cloudflare R2 candidate. No storage has been provisioned by this decision. Allow **US$1–5/month of gross media usage** for the small illustrative workload below, before available shared Vercel Pro credit; this is an allowance, not a spending cap. [Media budget](#vercel-blob-media-budget).

16 September timing: Vercel remains Hobby. Pro is recommended for continued deployed commercial work and required before minute scheduling; this recommendation is not a purchase or activation. The [capacity record](INFRASTRUCTURE_CAPACITY_AND_UPGRADES.md) distinguishes commercial-use timing from worker readiness. If only production polls continuously, the 0.25-CU baseline is about 180 CU-hours/30 days, roughly US$19.08 at the documented Launch rate; this is total compute for that baseline, not necessarily an additional US$19.08. Staging should stay unscheduled outside tests. Zoho Mail Lite is already paid, with a recorded €10.80 annual subtotal before tax. [Runbook](EMAIL_JOBS_RUNBOOK.md).

13 September mailbox update: **Zoho Mail Lite 5 GB is active for one user**, with `pawel@mywaveplan.com` and the `support@mywaveplan.com` alias. Separate Gmail send-and-reply tests passed for both addresses, including SPF, DKIM and DMARC. Support mail routes to its own folder and replies use the Support address. Apple Mail is configured as `pawel@mywaveplan.com`, with Mail enabled and Notes disabled. Personal and Support signatures are installed, with no phone number. Mac sending tests passed SPF/DKIM/DMARC; the logo renders in Gmail. Mailjet remains the application sender. Vercel retains DNS/app hosting and GoDaddy retains registration. [Mailbox verification](MAILBOX_SETUP.md) · [Mac and iPhone instructions](MAIL_CLIENT_SETUP.md). Earlier home.pl/Proton proposals are superseded; Proton has no operational role.

**Account update, 12 September:** Neon is Launch with the owner-reported US$20 notification, not a cap. A8 has migrated both databases/functions to Frankfurt and deleted the old US resource. Four EU branches remain; computes use 0.25–1 CU and five-minute idle suspension, with seven-day history. Vercel remains Hobby; no further paid plan was purchased. Temporary migration overlap is finished; no exact invoice total is claimed. The free-database example below is historical/hypothetical, and future Launch/worker costs remain estimates. Zoho Mail Lite 5 GB is active and verified; Mailjet application delivery/capacity remains open. [A8 runbook](EU_DATA_MIGRATION_PLAN.md).

9 September 2026. Estimate for [roadmap A7 and L1](IMPLEMENTATION_ROADMAP.md), based on the current app, published prices and the provider account review dated 8 September. This is a planning budget, not a quotation, an account invoice or approval to subscribe.

**Allow about €90–120/month before tax and payment fees for a small commercial launch with the A3 email/job design.** This is the conservative scenario with both environments running minute workers, a receiving mailbox and transactional sending. The intended activation schedules production only and leaves staging unscheduled outside tests; A7 must measure that lower-duty staging workload. The earlier €70–100 allowance assumed less database active time. A minimal forecast-only combination remains €29 + US$20/month, approximately €50, if the other required services fit suitable free tiers; it does not cover the complete planned signup service. No purchase is authorised by this estimate.

For simple budgeting, the euro allowances below reserve €1 for each US$1. This is a planning convention, not a current exchange-rate quote. Actual currency conversion, card charges and applicable VAT depend on the invoice. Do not add a blanket Portuguese VAT percentage without checking the supplier's tax treatment and the operator's status.

## Assumptions

- 3–5 pilot schools, approximately 100–300 monthly active surfers and 30–60 daily users. These are scenario inputs, not measured current traffic or capacity guarantees.
- The existing 17 spots, one person deploying code and the current staging/production projects. Include both environments' consumption; do not assume two independent Vercel base subscriptions.
- Forecast caching remains shared per spot, no continuous high-volume scraping, ordinary photo uploads and no video-hosting platform.
- Initial email traffic is approximately 3,000 recipient emails/month, including staging. Mailjet Free is suitable only if bursts remain safely below 200/day and the monthly 6,000 limit. Invitations/verification can create peaks even with few users. Count and alert on total usage; upgrade before urgent account emails risk daily-cap deferral. The owner selected one Zoho Mail Lite user on 13 September, with Support as an alias. Budget €0.90/month equivalent (€10.80/year), before applicable tax. The owner paid and the subscription is active.
- Retain existing application authentication as decided in A3, with B3/B9 hardening. No SMS authentication, paid identity checks, native store distribution, AI inference, advertising spend or optional enterprise tools are included.
- Commercial-only services activate at L1 before the first qualifying use; technical needs can trigger earlier spending. Free/sandbox tiers are used only where their terms and required capabilities permit.

## Services and licence costs

| Service | Starting choice | Monthly price or allowance | What changes it |
| --- | --- | --- | --- |
| Forecast, waves and water temperature | Open-Meteo API Standard | **€29** | Includes 1 million monthly API call units and the forecast/marine APIs used by the app. Professional is €99 and is not needed for current endpoints; historical/ensemble API work or higher volume may change the choice. |
| Application hosting | Vercel Pro, one deploying seat | **US$20 base**, including US$20 usage credit | Additional paid seats and metered usage beyond allowances/credit add cost. The credit is not another fee and must not be counted twice. |
| Database | Neon Launch already active; verify effective Marketplace entitlement in A7 | Budget **US$40–60** with minute workers; **US$10–25** for the lower-duty scenario without them | Polling can consume 360 CU-hours/month at two minimum-size endpoints before load-driven scaling. Storage/history, extra branches and transfer are additional. This is usage metering, not a fixed-price licence. |
| Transactional email, when signup/bookings ship | **Mailjet Free**, initial-pilot choice | **€0** while verified limits suffice; **US$9/month Starter** if required | Free allows 6,000/month and 200/day; Starter includes 8,000 with no daily cap. Sender approval, tracking controls, actual account entitlements and delivery need B3 tests. Upgrade before daily peaks jeopardise recovery messages. |
| Business/support mailbox | **Zoho Mail Lite 5 GB, one user**; `pawel@mywaveplan.com` with Support alias | **€0.90/month equivalent, billed €10.80/year**, before applicable tax | The owner paid; Mail Lite is active and Gmail delivery/reply tests passed for both addresses. Further independent users add licences. Mailjet handles app sending separately. |
| Durable jobs and scheduler | Neon outbox plus Vercel Pro minute worker | No separate queue subscription; function/DB usage is included in the estimates above | A7 approves technical upgrades before live retries. Free Vercel daily cron cannot deliver this schedule. Do not count database polling twice. |
| Photo object storage, B7 | **Vercel Blob, Frankfurt (`fra1`), owner-selected** | **US$1–5 gross usage allowance** for the small scenario below; storage **US$0.025/GB-month**, public Blob downloads **US$0.05/GB** | Requests, cache-miss transfer and image processing can add cost. Usage can consume remaining shared Vercel Pro credit; no second base subscription is budgeted. Include both environments. F14 private forecast archives need their own estimate before activation. |
| Tides/daylight | Existing local calculations and bundled reference data | **€0 separate recurring API fee** | Retain the required code/data attribution. Additional countries may need a different licensed tide source. |
| Product analytics and search tools | Standard GA4, GTM and Search Console | **€0 licence fee** | Engineering/consent setup still takes work. No Analytics 360, paid server-side tagging infrastructure or ad campaigns assumed. |
| Authentication, feedback prompts and consent UI | App implementation within the agreed architecture | **€0 additional SaaS licence assumed** | Their compute/storage is already in hosting/database estimates. A future external auth, messaging or consent platform requires a separate decision. |

Open-Meteo's live monthly pricing table was inspected in Chrome: Standard €29, Professional €99. The text-only page did not expose the embedded prices. One Standard subscription is budgeted for the current weather/marine endpoints, not one per parameter or spot; L1 confirms staging/production key and licence scope. [Open-Meteo prices and API coverage](https://open-meteo.com/en/pricing)

Vercel and Neon were checked in the earlier estimate; Mailjet and the additional email alternatives were checked on 9 September. Vercel Blob Frankfurt rates and billing were checked on 13 September when the owner selected it. Public Neon pricing was inspected in Chrome after the text reader failed. This does not inspect the owner’s final checkout. [Vercel pricing](https://vercel.com/pricing), [Neon pricing](https://neon.com/pricing), [Mailjet pricing](https://www.mailjet.com/pricing/), [mailbox example](https://www.zoho.com/mail/zohomail-pricing.html), [Blob Frankfurt pricing](https://vercel.com/docs/pricing/regional-pricing/fra1)

Free analytics/search-tool editions are sufficient for the proposed initial measurement. [Google Analytics](https://marketingplatform.google.com/intl/en_uk/about/analytics/), [Google Tag Manager](https://marketingplatform.google.com/about/tag-manager/), [Search Console](https://support.google.com/webmasters/answer/9128668?hl=en-EN)

The current [forecast adapter](../lib/conditions/provider.mjs) makes weather, marine and water-temperature requests to Open-Meteo and already accepts `OPEN_METEO_API_KEY`. It does not call Surfline, Windguru, Google Maps billing or a separate paid tide API. Tide/daylight sources are recorded in [conditions architecture](CONDITIONS_ARCHITECTURE.md). Personal Surfline, Figma, Codex and other development subscriptions are outside the app operating budget.

Additional alternatives checked at the owner's request: **Scaleway TEM Essential** has no monthly subscription, 300 included emails/month, then €0.25 per 1,000; **MailerSend** has 500 free/month, or Hobby at US$7/month for 5,000; **SES** à la carte remains US$0.10 per 1,000 plus applicable extras. These are alternatives, not additional fees to add to Mailjet. Capability limits and remaining verification are in the [A3 comparison](AUTH_EMAIL_AND_JOBS_DECISION.md). [Scaleway pricing](https://www.scaleway.com/en/pricing/managed-services/), [MailerSend pricing](https://www.mailersend.com/pricing), [SES pricing](https://aws.amazon.com/ses/pricing/)

## Vercel Blob media budget

Selected on 13 September for B7 school logos, covers/gallery images and profile photos. Create stores in Frankfurt, separately for staging and production. This is a future implementation decision, not active storage or a paid-plan change. Keep originals/drafts private and publish only approved resized derivatives; do not put image binaries in Neon. Existing Vercel DNS stays in place.

At the verified Frankfurt rates, an illustrative **5 GB average total storage across both environments** costs **US$0.125/month**. **20 GB of public Blob downloads** costs **US$1.00**, for **US$1.125, approximately US$1.13**, before requests, cache-miss transfer and image processing. Simple operations cost US$0.43/million and advanced operations US$5.40/million; applicable Fast Origin Transfer is US$0.06/GB and Edge Requests use CDN rates. These are public-delivery assumptions; private downloads have a different delivery path and must be measured separately. [Regional rates](https://vercel.com/docs/pricing/regional-pricing/fra1), [Blob billing and delivery details](https://vercel.com/docs/vercel-blob/usage-and-pricing).

Reserve **US$1–5/month of gross media usage** for this small photo workload with low request volumes. Usage may fit the remaining shared Pro credit, but do not assume the entire credit is available or add it twice. If the credit is already consumed, allow the extra media cost within the overall budget headroom. More downloads, frequent transformations, private-file delivery or future archives can exceed this estimate. This replaces the earlier free-R2 assumption; it is not a fixed-price plan or guaranteed cap.

B7 must resize/compress images, enforce byte/count quotas, remove abandoned/replaced uploads under the retention rules and configure usage/spending alerts. No video hosting is budgeted. F14 must estimate compressed private archive size, retention and access costs when it is implemented. EU storage does not mean public CDN caches or all provider processing stay in the EU; A4/B7 must verify and document the actual arrangement. [Store regions and delivery](https://vercel.com/docs/vercel-blob).

## Monthly scenarios

These use the €1 per US$1 budgeting convention, before tax, transaction costs and existing domain renewal.

| Scenario | Calculation | Planning amount |
| --- | --- | --- |
| Minimal forecast configuration, without minute jobs/new email flows | €29 forecast + US$20 hosting; suitable free database/media tiers | **About €50/month** |
| Lower-duty database, no continuous worker | €29 + US$20 + US$10–25 database + €0.90 active Zoho mailbox; outbound Mailjet disabled | **About €60–75/month** |
| Conservative signup scenario, both minute workers and Mailjet Free | €29 + US$20 hosting + US$40–60 database + €0 outbound + €0.90 mailbox | **About €90–111/month** |
| Same setup with Mailjet Starter | Previous scenario + US$9 email | **About €100–120/month** |

Use **€90–120/month** for the Mailjet Free scenario, or **€100–130/month** with modest headroom if Starter is needed. Lower-duty scenarios remain useful before live jobs, but cannot establish that continuous retries fit free database capacity. Approve spending at its actual trigger and revise the budget from usage. These are allowances, not provider-enforced caps.

The existing domain renews separately, generally annually; its actual registrar price was not inspected, so no invented renewal quote is included. Also excluded: development labour/tools, legal/accounting advice, fiscal invoicing integration, optional monitoring services, marketing, SMS, store developer memberships and payment fees. Fiscal invoicing/provider costs must be resolved in A4/E1 before a paid launch; this is a hosting/data/email estimate, not the entire business budget.

## Why low user counts do not determine the whole bill

The [refresh policy](../lib/conditions/refresh-policy.mjs) uses a 15-minute normal lifetime; an explicit refresh can refetch a complete forecast after two minutes. A normal full fetch makes three provider requests. Concurrent refreshes share a database claim, but staging and production have separate caches.

Illustrative demand scenarios, not observed usage:

- Refreshing all 17 spots once per hour for 12 hours daily over 30 days produces 18,360 requests per environment. Allowing roughly 1.5 billed units per request gives about 27,540 units.
- All 17 spots refreshed every 15 minutes, around the clock, produces 146,880 requests, or roughly 220,320 units per environment. Two equally busy environments would use roughly 440,640 units before retries, still below Standard's 1 million.
- Sustained two-minute forced refreshes across all spots would be about 1.65 million units per environment under the same approximation. It exceeds the starting plan even with few accounts, which is why C1 needs abuse/cost controls.

The multiplier is deliberately a rough allowance, not a claim about the supplier's invoice formula. The adapter requests 12 marine variables, seven weather variables and one water-temperature variable, covering 16 forecast days plus one past day. Open-Meteo weights long/multi-variable queries. Verify actual units, retries and model requests during the pilot and do not weaken freshness without a separate product decision. [Open-Meteo call accounting](https://open-meteo.com/en/pricing#faq)

For Neon Launch, a small scenario of **80–200 CU-hours/month**, **1 GB-month database storage** and **1 GB-month history** gives about **US$9.03–21.75** at US$0.106/CU-hour, US$0.35/GB-month storage and US$0.20/GB-month history. Round to US$10–25 for planning. Paid metering starts from zero; Free compute allowances do not carry over. Ten branches are included; additional ones are metered. [Neon pricing](https://neon.com/pricing)

That 80–200 CU-hour scenario is for intermittent activity. Under A3’s selected minute worker, two endpoints continuously active at 0.25 CU each consume 360 CU-hours in a 30-day month, or **US$38.16 compute alone**. At 1 GB-month storage and 1 GB-month history this is about US$38.71; round to **US$40–60** for planning, with load-driven scaling able to exceed it. This replaces the US$10–25 database estimate when minute jobs run, not an extra fee on top. The current four EU branches require lifecycle review; the old ten-branch US project is deleted.

A7 must verify the effective Marketplace quotas, actual active time, autoscaling and restore policy. Public Neon Free’s 100 CU-hour example would not cover the two continuously active endpoints. Keep staging scheduling off outside tests as the runbook requires. Disabling sending alone is not the same as removing a trigger; verify the environment-specific schedule. Production recovery must not stop to meet an assumed budget. Vercel Pro minute cron is a technical prerequisite before live delivery, independently of L1. [Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

## Payment fees when commerce launches

Stripe's standard Portugal card processing has no fixed monthly Payments fee. A standard EEA card is **1.5% + €0.25** per successful payment: a €40 lesson costs **€0.85** in basic card processing. Other cards, conversion and disputes differ. The chosen merchant model decides whether the school or platform pays each fee. [Stripe Portugal pricing](https://stripe.com/en-pt/pricing)

For school subscriptions, Stripe Billing's pay-as-you-go option adds **0.7% of Billing volume**. At the proposed, not approved, €39/month school price, standard EEA processing plus Billing is approximately **€1.11 per charge**, or about €5.55 across five such monthly charges after rounding. These are separate from the platform's fixed operating costs and exclude tax/invoicing extras. [Stripe Billing pricing](https://stripe.com/en-pt/billing/pricing)

Connect costs depend on the configuration. The published “Stripe handles pricing” option has no added platform account/payout fee; the “You handle pricing” option lists **€2 per monthly active account plus 0.25% + €0.10 per payout**, with other applicable fund-routing/cross-border charges possible. Do not assume either option is the implementation already chosen. E1 must confirm the supported account/charge model and total fee responsibility before lesson payments. [Stripe Connect pricing](https://stripe.com/en-pt/connect/pricing)

## Actions at the relevant checkpoint

A5 confirms source/service use and L1 activates required commercial access just before its triggering activity. A3’s [decision](AUTH_EMAIL_AND_JOBS_DECISION.md) retains auth, selects Mailjet Free initially and specifies the outbox/worker. A7 verifies current Vercel/Neon usage, scheduling, branch lifecycle and recovery before activation; A4 reviews the selected Zoho Mail EU service and processing arrangements; B7 provisions the selected Vercel Blob Frankfurt stores and verifies media permissions, deletion, quotas and usage alerts. Compare measured pilot usage with these scenarios before approving spend, then update after the first billing period and new payment/archive workloads.

The A3 architecture decision made no purchases. Mailjet replaced the initial SES proposal; the owner later created the account and Vercel integrations, and production-domain validation passed. On 13 September the owner paid for Zoho Mail Lite, 5 GB for one user, with Support as an alias. The selected annual subtotal was €10.80 before applicable tax; do not infer the tax-inclusive invoice total. Zoho delivery, replies, DMARC monitoring and Mac setup are verified. Mailjet application delivery, staging isolation, limits and scheduler capacity remain in A6/A7. The former home.pl receiving-mail plan is superseded. Vercel and GoDaddy remain in place; no AWS signup is required.
