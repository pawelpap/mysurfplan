# Small-launch monthly cost estimate

9 September 2026. Estimate for [roadmap A7 and L1](IMPLEMENTATION_ROADMAP.md), based on the current app, published prices and the provider account review dated 8 September. This is a planning budget, not a quotation, an account invoice or approval to subscribe.

**Allow about €70–100/month before tax and payment fees for a small commercial launch.** The minimum service combination is **€29 + US$20/month**, approximately €50 for budgeting, if Neon and email/media remain within suitable free tiers and Vercel usage stays within its included credit. The higher allowance covers a small paid database, possible paid email and modest usage variation. It is not a guaranteed ceiling.

For simple budgeting, the euro allowances below reserve €1 for each US$1. This is a planning convention, not a current exchange-rate quote. Actual currency conversion, card charges and applicable VAT depend on the invoice. Do not add a blanket Portuguese VAT percentage without checking the supplier's tax treatment and the operator's status.

## Assumptions

- 3–5 pilot schools, approximately 100–300 monthly active surfers and 30–60 daily users. These are scenario inputs, not measured current traffic or capacity guarantees.
- The existing 17 spots, one person deploying code and the current staging/production projects. Include both environments' consumption; do not assume two independent Vercel base subscriptions.
- Forecast caching remains shared per spot, no continuous high-volume scraping, ordinary photo uploads and no video-hosting platform.
- Initial email traffic stays below 3,000/month and 100/day unless the paid-email option is selected. Invitations and verification can create daily peaks even with few users.
- Keep existing application authentication unless A3 identifies a reason to change it. No SMS authentication, paid identity checks, native store distribution, AI inference, advertising spend or optional enterprise tools in this starting budget.
- Commercial-only services activate at L1 before the first qualifying use; technical needs can trigger earlier spending. Free/sandbox tiers are used only where their terms and required capabilities permit.

## Services and licence costs

| Service | Starting choice | Monthly price or allowance | What changes it |
| --- | --- | --- | --- |
| Forecast, waves and water temperature | Open-Meteo API Standard | **€29** | Includes 1 million monthly API call units and the forecast/marine APIs used by the app. Professional is €99 and is not needed for current endpoints; historical/ensemble API work or higher volume may change the choice. |
| Application hosting | Vercel Pro, one deploying seat | **US$20 base**, including US$20 usage credit | Additional paid seats and metered usage beyond allowances/credit add cost. The credit is not another fee and must not be counted twice. |
| Database | Neon Free while sufficient; Launch if required | **US$0**, or budget **US$10–25** for the small Launch scenario below | Active compute, history/storage, extra branches and transfer. Paid Launch is usage-based, not a fixed US$25 licence. Existing Vercel-managed entitlements/billing must be checked at activation. |
| Transactional email, when signup/bookings ship | Resend Free candidate | **US$0** within 3,000 emails/month and 100/day; **US$20** Pro if needed | Pro includes 50,000/month and removes the daily cap. Verify sender/domain setup and delivery before choosing. Not implemented or selected by this estimate. |
| Photo and forecast-archive object storage, when needed | Cloudflare R2 Standard candidate | **US$0** within 10 GB-month, 1 million Class A and 10 million Class B operations | Above free allowances, storage/operations are metered. Internet egress is free; transformations or other services can still cost money. No video-heavy workload assumed. |
| Tides/daylight | Existing local calculations and bundled reference data | **€0 separate recurring API fee** | Retain the required code/data attribution. Additional countries may need a different licensed tide source. |
| Product analytics and search tools | Standard GA4, GTM and Search Console | **€0 licence fee** | Engineering/consent setup still takes work. No Analytics 360, paid server-side tagging infrastructure or ad campaigns assumed. |
| Authentication, feedback prompts and consent UI | App implementation within the agreed architecture | **€0 additional SaaS licence assumed** | Their compute/storage is already in hosting/database estimates. A future external auth, messaging or consent platform requires a separate decision. |

Open-Meteo's live monthly pricing table was inspected in Chrome: Standard €29, Professional €99. The text-only page did not expose the embedded prices. One Standard subscription is budgeted for the current weather/marine endpoints, not one per parameter or spot; L1 confirms staging/production key and licence scope. [Open-Meteo prices and API coverage](https://open-meteo.com/en/pricing)

The Vercel price/credit, Resend allowances and R2 Standard free tier were checked against their official pages. Public Neon pricing was verified in Chrome after the text reader failed. This does not inspect the owner's final Marketplace checkout. [Vercel pricing](https://vercel.com/pricing), [Neon pricing](https://neon.com/pricing), [Resend pricing](https://resend.com/pricing), [R2 pricing](https://developers.cloudflare.com/r2/pricing/)

Free analytics/search-tool editions are sufficient for the proposed initial measurement. [Google Analytics](https://marketingplatform.google.com/intl/en_uk/about/analytics/), [Google Tag Manager](https://marketingplatform.google.com/about/tag-manager/), [Search Console](https://support.google.com/webmasters/answer/9128668?hl=en-EN)

The current [forecast adapter](../lib/conditions/provider.mjs) makes weather, marine and water-temperature requests to Open-Meteo and already accepts `OPEN_METEO_API_KEY`. It does not call Surfline, Windguru, Google Maps billing or a separate paid tide API. Tide/daylight sources are recorded in [conditions architecture](CONDITIONS_ARCHITECTURE.md). Personal Surfline, Figma, Codex and other development subscriptions are outside the app operating budget.

## Monthly scenarios

These use the €1 per US$1 budgeting convention, before tax, transaction costs and existing domain renewal.

| Scenario | Calculation | Planning amount |
| --- | --- | --- |
| Smallest commercial configuration | €29 forecast + US$20 hosting; suitable free database/email/media tiers | **About €50/month** |
| Database needs Launch; email remains free | €29 + US$20 + US$10–25 database | **About €60–75/month** |
| Database and email need paid access | Previous scenario + US$20 email | **About €80–95/month** |

Use **€70–100/month** as an initial working allowance, purchasing only the services actually required. If Free fits the accepted recovery/capacity policy, there is no reason to buy Launch merely to spend the allowance. If usage or operational requirements exceed these assumptions, revise the budget before activation; €100 is not a provider-enforced cap.

The existing domain renews separately, generally annually; its actual registrar price was not inspected, so no invented renewal quote is included. Also excluded: development labour/tools, legal/accounting advice, fiscal invoicing integration, optional monitoring services, marketing, SMS, store developer memberships and payment fees. Fiscal invoicing/provider costs must be resolved in A4/E1 before a paid launch; this is a hosting/data/email estimate, not the entire business budget.

## Why low user counts do not determine the whole bill

The [refresh policy](../lib/conditions/refresh-policy.mjs) uses a 15-minute normal lifetime; an explicit refresh can refetch a complete forecast after two minutes. A normal full fetch makes three provider requests. Concurrent refreshes share a database claim, but staging and production have separate caches.

Illustrative demand scenarios, not observed usage:

- Refreshing all 17 spots once per hour for 12 hours daily over 30 days produces 18,360 requests per environment. Allowing roughly 1.5 billed units per request gives about 27,540 units.
- All 17 spots refreshed every 15 minutes, around the clock, produces 146,880 requests, or roughly 220,320 units per environment. Two equally busy environments would use roughly 440,640 units before retries, still below Standard's 1 million.
- Sustained two-minute forced refreshes across all spots would be about 1.65 million units per environment under the same approximation. It exceeds the starting plan even with few accounts, which is why C1 needs abuse/cost controls.

The multiplier is deliberately a rough allowance, not a claim about the supplier's invoice formula. The adapter requests 12 marine variables, seven weather variables and one water-temperature variable, covering 16 forecast days plus one past day. Open-Meteo weights long/multi-variable queries. Verify actual units, retries and model requests during the pilot and do not weaken freshness without a separate product decision. [Open-Meteo call accounting](https://open-meteo.com/en/pricing#faq)

For Neon Launch, a small scenario of **80–200 CU-hours/month**, **1 GB-month database storage** and **1 GB-month history** gives about **US$9.03–21.75** at US$0.106/CU-hour, US$0.35/GB-month storage and US$0.20/GB-month history. Round to US$10–25 for planning. Paid metering starts from zero; Free compute allowances do not carry over. Ten branches are included; additional ones are metered. [Neon pricing](https://neon.com/pricing)

This CU-hour assumption includes the project's active endpoints; it is not based on current measured traffic. Two endpoints continuously active at 0.25 CU each would consume 360 CU-hours in a 30-day month, or **US$38.16 compute alone**. Polling/background jobs can keep them awake. A7 should verify actual runtime, autoscaling and recovery requirements before agreeing the budget. The current 10/10 branch occupancy still needs lifecycle management; storage size alone does not prove that Free is sufficient.

## Payment fees when commerce launches

Stripe's standard Portugal card processing has no fixed monthly Payments fee. A standard EEA card is **1.5% + €0.25** per successful payment: a €40 lesson costs **€0.85** in basic card processing. Other cards, conversion and disputes differ. The chosen merchant model decides whether the school or platform pays each fee. [Stripe Portugal pricing](https://stripe.com/en-pt/pricing)

For school subscriptions, Stripe Billing's pay-as-you-go option adds **0.7% of Billing volume**. At the proposed, not approved, €39/month school price, standard EEA processing plus Billing is approximately **€1.11 per charge**, or about €5.55 across five such monthly charges after rounding. These are separate from the platform's fixed operating costs and exclude tax/invoicing extras. [Stripe Billing pricing](https://stripe.com/en-pt/billing/pricing)

Connect costs depend on the configuration. The published “Stripe handles pricing” option has no added platform account/payout fee; the “You handle pricing” option lists **€2 per monthly active account plus 0.25% + €0.10 per payout**, with other applicable fund-routing/cross-border charges possible. Do not assume either option is the implementation already chosen. E1 must confirm the supported account/charge model and total fee responsibility before lesson payments. [Stripe Connect pricing](https://stripe.com/en-pt/connect/pricing)

## Actions at the relevant checkpoint

A5 confirms source/service use and L1 activates required commercial access just before its triggering activity. A7 checks actual Vercel/Neon usage, branch lifecycle and recovery; A3 chooses email/auth/jobs and B7 chooses media storage. Compare measured pilot traffic against the scenarios before approving spend. Update this estimate after the first billing period and after paid bookings or forecast archiving are introduced.

No subscription, payment, account connection, application code or database was changed during this estimate. The temporary pricing research tab was closed. The next development task remains A1: school boundaries, public-response privacy, playground-route removal and demo isolation.
