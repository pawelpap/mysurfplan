# Small-launch monthly cost estimate

**Account update, 12 September:** Neon is Launch with the owner-reported US$20 notification, not a cap. A8 has migrated both databases/functions to Frankfurt and deleted the old US resource. Four EU branches remain; computes use 0.25–1 CU and five-minute idle suspension, with seven-day history. Vercel remains Hobby; no further paid plan was purchased. Temporary migration overlap is finished; no exact invoice total is claimed. The free-database example below is historical/hypothetical, and future Launch/worker costs remain estimates. Mailbox capacity is still to be confirmed before registration. [A8 runbook](EU_DATA_MIGRATION_PLAN.md).

9 September 2026. Estimate for [roadmap A7 and L1](IMPLEMENTATION_ROADMAP.md), based on the current app, published prices and the provider account review dated 8 September. This is a planning budget, not a quotation, an account invoice or approval to subscribe.

**Allow about €90–120/month before tax and payment fees for a small commercial launch with the A3 email/job design.** This includes both environments running minute workers, a small receiving mailbox and transactional sending. The earlier €70–100 allowance assumed less database active time. A minimal forecast-only combination remains €29 + US$20/month, approximately €50, if the other required services fit suitable free tiers; it does not cover the complete planned signup service. No purchase is authorised by this estimate.

For simple budgeting, the euro allowances below reserve €1 for each US$1. This is a planning convention, not a current exchange-rate quote. Actual currency conversion, card charges and applicable VAT depend on the invoice. Do not add a blanket Portuguese VAT percentage without checking the supplier's tax treatment and the operator's status.

## Assumptions

- 3–5 pilot schools, approximately 100–300 monthly active surfers and 30–60 daily users. These are scenario inputs, not measured current traffic or capacity guarantees.
- The existing 17 spots, one person deploying code and the current staging/production projects. Include both environments' consumption; do not assume two independent Vercel base subscriptions.
- Forecast caching remains shared per spot, no continuous high-volume scraping, ordinary photo uploads and no video-hosting platform.
- Initial email traffic is approximately 3,000 recipient emails/month, including staging. Mailjet Free is suitable only if bursts remain safely below 200/day and the monthly 6,000 limit. Invitations/verification can create peaks even with few users. Count and alert on total usage; upgrade before urgent account emails risk daily-cap deferral. The owner selected existing home.pl Hosting Business on 10 September. Check its included mailbox capacity before adding any separate subscription; the €2 allowance below remains contingency.
- Retain existing application authentication as decided in A3, with B3/B9 hardening. No SMS authentication, paid identity checks, native store distribution, AI inference, advertising spend or optional enterprise tools are included.
- Commercial-only services activate at L1 before the first qualifying use; technical needs can trigger earlier spending. Free/sandbox tiers are used only where their terms and required capabilities permit.

## Services and licence costs

| Service | Starting choice | Monthly price or allowance | What changes it |
| --- | --- | --- | --- |
| Forecast, waves and water temperature | Open-Meteo API Standard | **€29** | Includes 1 million monthly API call units and the forecast/marine APIs used by the app. Professional is €99 and is not needed for current endpoints; historical/ensemble API work or higher volume may change the choice. |
| Application hosting | Vercel Pro, one deploying seat | **US$20 base**, including US$20 usage credit | Additional paid seats and metered usage beyond allowances/credit add cost. The credit is not another fee and must not be counted twice. |
| Database | Neon Launch expected for both continuously polled environments; verify effective Marketplace entitlement in A7 | Budget **US$40–60** with minute workers; **US$10–25** for the lower-duty scenario without them | Polling can consume 360 CU-hours/month at two minimum-size endpoints before load-driven scaling. Storage/history, extra branches and transfer are additional. This is usage metering, not a fixed-price licence. |
| Transactional email, when signup/bookings ship | **Mailjet Free**, initial-pilot choice | **€0** while verified limits suffice; **US$9/month Starter** if required | Free allows 6,000/month and 200/day; Starter includes 8,000 with no daily cap. Sender approval, tracking controls, actual account entitlements and delivery need B3 tests. Upgrade before daily peaks jeopardise recovery messages. |
| Receiving support mailbox | `support@mywaveplan.com` on existing **home.pl Hosting Business**, selected 10 September | Expected **€0 additional subscription** if existing capacity suffices; keep **€2 contingency** | Configuration is deferred. Verify account limits, external-DNS support and processing location in A4/A6/B3. Existing hosting renewal is a separate cost; Mailjet does not supply this inbox. |
| Durable jobs and scheduler | Neon outbox plus Vercel Pro minute worker | No separate queue subscription; function/DB usage is included in the estimates above | A7 approves technical upgrades before live retries. Free Vercel daily cron cannot deliver this schedule. Do not count database polling twice. |
| Photo and forecast-archive object storage, when needed | Cloudflare R2 Standard candidate | **US$0** within 10 GB-month, 1 million Class A and 10 million Class B operations | Above free allowances, storage/operations are metered. Internet egress is free; transformations or other services can still cost money. No video-heavy workload assumed. |
| Tides/daylight | Existing local calculations and bundled reference data | **€0 separate recurring API fee** | Retain the required code/data attribution. Additional countries may need a different licensed tide source. |
| Product analytics and search tools | Standard GA4, GTM and Search Console | **€0 licence fee** | Engineering/consent setup still takes work. No Analytics 360, paid server-side tagging infrastructure or ad campaigns assumed. |
| Authentication, feedback prompts and consent UI | App implementation within the agreed architecture | **€0 additional SaaS licence assumed** | Their compute/storage is already in hosting/database estimates. A future external auth, messaging or consent platform requires a separate decision. |

Open-Meteo's live monthly pricing table was inspected in Chrome: Standard €29, Professional €99. The text-only page did not expose the embedded prices. One Standard subscription is budgeted for the current weather/marine endpoints, not one per parameter or spot; L1 confirms staging/production key and licence scope. [Open-Meteo prices and API coverage](https://open-meteo.com/en/pricing)

Vercel, Neon and R2 were checked in the earlier estimate; Mailjet and the additional email alternatives were checked on 9 September. Public Neon pricing was inspected in Chrome after the text reader failed. This does not inspect the owner’s final checkout. [Vercel pricing](https://vercel.com/pricing), [Neon pricing](https://neon.com/pricing), [Mailjet pricing](https://www.mailjet.com/pricing/), [mailbox example](https://www.zoho.com/mail/zohomail-pricing.html), [R2 pricing](https://developers.cloudflare.com/r2/pricing/)

Free analytics/search-tool editions are sufficient for the proposed initial measurement. [Google Analytics](https://marketingplatform.google.com/intl/en_uk/about/analytics/), [Google Tag Manager](https://marketingplatform.google.com/about/tag-manager/), [Search Console](https://support.google.com/webmasters/answer/9128668?hl=en-EN)

The current [forecast adapter](../lib/conditions/provider.mjs) makes weather, marine and water-temperature requests to Open-Meteo and already accepts `OPEN_METEO_API_KEY`. It does not call Surfline, Windguru, Google Maps billing or a separate paid tide API. Tide/daylight sources are recorded in [conditions architecture](CONDITIONS_ARCHITECTURE.md). Personal Surfline, Figma, Codex and other development subscriptions are outside the app operating budget.

Additional alternatives checked at the owner's request: **Scaleway TEM Essential** has no monthly subscription, 300 included emails/month, then €0.25 per 1,000; **MailerSend** has 500 free/month, or Hobby at US$7/month for 5,000; **SES** à la carte remains US$0.10 per 1,000 plus applicable extras. These are alternatives, not additional fees to add to Mailjet. Capability limits and remaining verification are in the [A3 comparison](AUTH_EMAIL_AND_JOBS_DECISION.md). [Scaleway pricing](https://www.scaleway.com/en/pricing/managed-services/), [MailerSend pricing](https://www.mailersend.com/pricing), [SES pricing](https://aws.amazon.com/ses/pricing/)

## Monthly scenarios

These use the €1 per US$1 budgeting convention, before tax, transaction costs and existing domain renewal.

| Scenario | Calculation | Planning amount |
| --- | --- | --- |
| Minimal forecast configuration, without minute jobs/new email flows | €29 forecast + US$20 hosting; suitable free database/media tiers | **About €50/month** |
| Lower-duty database, no continuous worker | €29 + US$20 + US$10–25 database; email/mailbox not yet activated | **About €60–75/month** |
| A3 signup launch, both minute workers and Mailjet Free | €29 + US$20 hosting + US$40–60 database + €0 outbound + €2 mailbox | **About €91–111/month** |
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

A7 must verify the effective Marketplace quotas, actual active time, autoscaling and restore policy. Public Neon Free’s 100 CU-hour example would not cover the two continuously active endpoints. Staging sending can be explicitly disabled outside tests if the runbook records it; production recovery must not stop to meet an assumed budget. Vercel Pro minute cron is a technical prerequisite before live delivery, independently of L1. [Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

## Payment fees when commerce launches

Stripe's standard Portugal card processing has no fixed monthly Payments fee. A standard EEA card is **1.5% + €0.25** per successful payment: a €40 lesson costs **€0.85** in basic card processing. Other cards, conversion and disputes differ. The chosen merchant model decides whether the school or platform pays each fee. [Stripe Portugal pricing](https://stripe.com/en-pt/pricing)

For school subscriptions, Stripe Billing's pay-as-you-go option adds **0.7% of Billing volume**. At the proposed, not approved, €39/month school price, standard EEA processing plus Billing is approximately **€1.11 per charge**, or about €5.55 across five such monthly charges after rounding. These are separate from the platform's fixed operating costs and exclude tax/invoicing extras. [Stripe Billing pricing](https://stripe.com/en-pt/billing/pricing)

Connect costs depend on the configuration. The published “Stripe handles pricing” option has no added platform account/payout fee; the “You handle pricing” option lists **€2 per monthly active account plus 0.25% + €0.10 per payout**, with other applicable fund-routing/cross-border charges possible. Do not assume either option is the implementation already chosen. E1 must confirm the supported account/charge model and total fee responsibility before lesson payments. [Stripe Connect pricing](https://stripe.com/en-pt/connect/pricing)

## Actions at the relevant checkpoint

A5 confirms source/service use and L1 activates required commercial access just before its triggering activity. A3’s [decision](AUTH_EMAIL_AND_JOBS_DECISION.md) retains auth, selects Mailjet Free initially and specifies the outbox/worker. A7 verifies current Vercel/Neon usage, scheduling, branch lifecycle and recovery before activation; A4 reviews the selected home.pl mailbox service and processing arrangements; B7 chooses media storage. Compare measured pilot usage with these scenarios before approving spend, then update after the first billing period and new payment/archive workloads.

No subscription, payment, account connection, application code or database was changed for A3. Mailjet replaces the initial SES proposal. Update, 10 September: the owner has created the Mailjet account, added `mywaveplan.com` as a sending domain and activated the Vercel integration for staging and production. Account plan, credential isolation and delivery remain unverified. The owner selected existing home.pl Hosting Business for `support@mywaveplan.com`. Keep app hosting/DNS at Vercel and registration at GoDaddy. No AWS signup is required. The owner subsequently authorised sending-domain activation: Mailjet validation and SPF/DKIM now pass against existing Vercel DNS records. No purchase, agent DNS edit or app deployment was needed. Mailbox, staging sender, DMARC and application delivery work remain deferred until A6/A7/B3 preparation. This validation does not change the cost estimate. B1/B2 and F17/F18 are complete; A4 preparation precedes B3 onboarding.
