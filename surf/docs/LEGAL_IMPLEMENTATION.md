# Legal pages and evidence contract

Prepared 6 October 2026 for A4/B6. Staging is the owner's review environment. Production publication needs separate approval. A4/B6 remain partial until the remaining legal and operating decisions are resolved.

## Routes and document source

The full documents appear directly at `/legal/privacy`, `/legal/terms` and `/legal/school-processing`. There is no temporary review route. `/legal` preserves the existing forecast/tide licences and links to the documents. `/legal/storage` documents current cookies/resources. `/legal/records` redirects to the authenticated workspace view `/?view=privacy`, which provides agreement status, history and privacy information. Optional controls are shown only when purposes are available. Login and workspace links provide access.

Registered entity spelling is **PAWEL PAPLINSKI**, as confirmed by the owner on 6 October. MyWavePlan is the service name. Existing owner-confirmed identity, tax identifier, correspondence address and Support address are reused. Complete owner-specific text remains in ignored `docs/private/legal-staging-documents.json` and `docs/private/PRIVACY_DOCUMENT_DRAFTS.md`. The earlier draft is retained locally. It is not included in this public repository or in build-time page data.

The operator explicitly requested complete text in its intended staging routes, with the intended production layout. The migration imports that text into the staging database as immutable `staging_preview` versions. Server-side rendering requires the staging custom host and a database bound to staging, and rejects a different Vercel project when its ID is present. Production cannot expose these preview versions. Public staging document access is intentional. Pages use no-store/noindex and never execute stored HTML. The preview indication is staging-specific; production will use separately reviewed `published` records.

Stable IDs are `mywaveplan.privacy`, `mywaveplan.adult-pilot-terms` and `mywaveplan.school-processing`. Current staging version: `2026-10-06.3`, language `en-GB`. Exact version and language links are supported; unavailable translations/versions return 404. No fallback silently claims a translated version. English content is the only implemented language; A9/B10 retain the other language work.

## Evidence and permissions

Migration `20261006_legal_evidence` is additive and backfills no acceptance. Each immutable document stores ID/version/language/kind/text/SHA-256/status/environment/effective and review-preparation dates. The latter timestamp for a staging preview records preparation, not legal approval. Hashes are checked in PostgreSQL. Acceptances reference the exact document version, language and hash.

`legal_acceptances` contains a subject account and server time; school acceptance adds school and representative membership. Active school owner/administrator membership and explicit confirmation of representative authority are required. Platform privileges alone cannot sign for a school. School and user eligibility are checked again in the insertion query. Existing legacy ownership is not inferred. Acceptance is idempotent per subject/version/language/school.

`privacy_notice_deliveries` is a separate table. The server records delivery when it serves an authenticated person's privacy notice, without a checkbox or consent requirement. Demo accounts create no evidence. Delivery is neither agreement nor proof of reading. Clients cannot create delivery evidence through the action API.

`optional_preference_events` records a separate subject, purpose, false selection, contract version, language and server time. Marketing, analytics, advertising, session recording and public rankings default off. Opt-in is rejected because no optional purpose is enabled. Withdrawal does not change agreement/notice records or restrict core service. There are no tracking identifiers to clean up in this release; C5/C6 must implement and test real identifier cleanup before activation. No tracking consent is collected in advance.

The API reads only the current account's evidence and derives subjects from the verified session. It uses existing same-origin mutation checks, current account permissions and read-only demo rules. Errors do not disclose database details. No IP, user agent, email, password or session token is added to legal evidence. School instructions/entity verification remain B4/B5 work and are required before real school processing; a staging acceptance is not an executed production agreement.

## Data roles and current providers

PAWEL PAPLINSKI is controller for independently determined platform account, security and operator-support purposes. The school is controller for its instructed lesson/customer/staff processing; PAWEL PAPLINSKI is processor for those instructions. Additional joint purposes need a separate factual assessment. The registered entity is not described as an incorporated company.

| Provider and state | Verified policy/source information | Remaining contract or operating evidence |
| --- | --- | --- |
| Vercel, active Pro hosting/DNS | [DPA](https://vercel.com/legal/dpa), updated 17 March and effective 31 March 2026, covers Pro/Enterprise customer-data processing and distinguishes Vercel controller purposes. It describes global transfers and SCC arrangements; deletion is not a fixed public number of days | Retain applicable account agreement/DPA acceptance and subprocessor evidence; verify actual log/copy retention and role-specific transfers |
| Neon, active database via Marketplace | [Current Neon schedule](https://neon.com/platform-terms) now refers to Databricks platform terms/subprocessors and adds Grafana Labs in the US. Frankfurt primary DB placement is separate from this register | Verify the effective legacy Marketplace agreement, contracting party, accepted DPA/version, support transfers and actual recovery retention. Do not assume the newly published schedule replaced this account's contract |
| Zoho Mail EU, active support/business mailbox | [Privacy policy](https://www.zoho.com/privacy.html), especially service data and transfers, describes group/supplier processing and DPA request procedure. EU mailbox endpoints do not prove all handling is EU-only | Retrieve actual signed/applicable DPA, support/backups/retention evidence. Account/alias and reply operation were already verified; no connection changes |
| Mailjet, disabled application sender | [Storage statement](https://documentation.mailjet.com/hc/en-us/articles/360042712274-Where-is-my-personal-data-stored) identifies GCP Frankfurt/Saint-Ghislain | Applicable DPA/subprocessors, sender isolation, recipient routing, suppression/deletion and open/click settings remain activation gates. No real recipients/jobs were added |
| Open-Meteo/GitHub tide constants, active server requests | Current adapter sends public spot/provider parameters, without account details or device coordinates. Existing licences remain on `/legal` | A5/L1 provider-use classification stays open; no plan purchase or calibration change |
| External profile-image hosts/OpenStreetMap | Profile image rendering can request its stored external URL. OSM is a link, not an embedded map | B7 origin restriction and image lifecycle remain open. Audit a future image-enabled journey; do not generalise a demo test to every configured avatar |

## Planned tracking providers

The owner selected these tools on 6 October. They are **planned, inactive**. No account, property, tag, pixel, payment plan or integration was provisioned. Future activation must update the actual configured register, public notice/storage list, consent UI and event specification. Supplier policy publication does not prove agreement acceptance.

| Correct product name | Intended purpose | Verified role/policy and specific activation issue |
| --- | --- | --- |
| Google Analytics 4 (GA4) | Usage measurement | [Service classification](https://business.safety.google/adsservices/) lists Analytics among processor services; [processor terms](https://business.safety.google/adsprocessorterms/) apply when agreed. [Measurement controller terms](https://support.google.com/analytics/answer/9012600?hl=en) can apply to data-sharing settings. Finalise sharing/ads links, retention and minimised events |
| Google Ads | Advertising/conversion measurement, exact features still to decide | The same Google service register separates ordinary Ads controller services from features such as Enhanced Conversions/Customer Match under processor terms. Do not treat those uploads as authorised. [Transfer information](https://business.safety.google/adsdatatransfers/) describes global handling, DPF and SCC mechanisms; verify applicability at activation |
| Meta Pixel | Advertising measurement | Official [Business Tools Terms](https://www.facebook.com/legal/terms/businesstools) and [joint-processing page](https://www.facebook.com/legal/terms/businesstools_jointprocessing) redirected to a blocked login response during this check. Effective text/roles/transfers remain **unverified**; complete an authorised read before activation. Do not list Meta as an ordinary school subprocessor |
| LinkedIn Insight Tag | Advertising/conversion measurement | [LinkedIn DPA](https://www.linkedin.com/legal/l/dpa), section 4, describes independent controller roles unless separately agreed. Its annex identifies Insight Tag data including pseudonym, IP, device/browser, time and URL. Recheck actual contracting entity/transfer and retention settings |
| Microsoft Clarity | Interaction analysis, heatmaps and session recordings | [Official FAQ](https://learn.microsoft.com/en-us/clarity/faq) identifies Microsoft as controller, Azure storage and cross-border processing. It states per-user deletion needs deletion of the project; 30-day webmaster availability is not proof that all provider copies expire then. The [terms page](https://clarity.microsoft.com/terms) returned no readable terms in the source check, so full effective terms remain unverified. Review masking, permitted pages, research/AI uses, consent signals and deletion limits before activation |

C5 supplies separate analytics/advertising/session-recording choices, equally usable reject/accept, saved choices and permanent settings access in English/pt-PT/Spanish. C6 must block requests before opt-in, exclude private/authentication/booking data and sensitive URL parameters, test refusal/reload/navigation/withdrawal, and never replay pre-consent events. Clarity needs a dedicated page/masking assessment; an adult account alone does not make school/private pages suitable for recording.

## Storage and live audit

Live desktop/light and mobile/dark staging checks before the release found only Google Fonts external browser requests. Anonymous contexts had no cookies, local/session storage, IndexedDB, Cache Storage or service workers. Demo login created `msp_session`: same-origin, Secure, HttpOnly, SameSite=Lax, approximately 604800 seconds. The forecast had 18 spots and 16 days. This is bounded journey evidence, not an exhaustive audit of all hosted integrations or arbitrary avatar hosts.

The full deployed checks confirmed the first-party requests, all four loaded font weights and saved/reloaded appearance. The staging profile-origin read found zero configured user photo URLs, so no actual avatar-host request was available to test. Source and subsequent live checks verify `mywaveplan:appearance` persists until changed/cleared, while coordinates stay in page memory. Poppins is self-hosted in the existing 400/500/600/700 weights with the SIL licence, all original language subsets and no design change. Browser verification checks network requests as well as code. No cookie banner is added because optional tracking remains absent. Necessary cookie expiry does not establish server-row or provider-log deletion.

## Publication and later gates

Staging text has complete sections and meaningful retention criteria that describe existing behaviour, including soft-deletion and unscheduled-purge limits. No proposed 30-day/12-month/24-month target is presented as an implemented guarantee. Production publication still needs owner approval of wording, purpose-specific bases/security LIA, contract and transfer evidence, retention/rights responsibilities, school instructions/entity/periods and applicable consumer complaint/ADR review. Exact fiscal/merchant decisions gate the respective paid flows; no paid service is offered by these pilot terms.

B8/A6 own scheduled deletion, provider-copy handling, exports/rights operations and restore replay. A9 then B3 remains the next sequence, with A6/A7 email readiness before B3 activation. C5/C6 remain unimplemented. A4/B6 are not complete merely because staging can display documents and evidence controls.

## Release commands and rollback

Use the existing endpoint-pinned private connection files and direct connections. Run `node scripts/migrate-legal-evidence.mjs rehearsal --rehearse`, then `staging --apply --staging-content`. The runner verifies checksums, environment and original-data fingerprints; synthetic checks roll back. Only the staging import reads the ignored owner file. No owner text enters rehearsal or production. Do not initialise a database with the legacy bootstrap.

Run `npm test`, `npm run build`, `npm ls --all`, `npm audit`, `check-legal-release.mjs` and `check-legal-browser.mjs`. Live synthetic fixtures are uniquely identified and removed in a finally block; the shared Demo student is read-only. Push only the reviewed code to `staging` and verify the custom domain. Production needs its own approved migration/content publication/release. Compatible rollback is the prior B2 runtime, leaving this additive schema in place; no whole-database synchronisation or destructive schema rollback is needed.

## Desktop and mobile revision, 6 October 2026

Public documents use a bounded reading column, desktop contents navigation, compact mobile contents and document menus, regular-weight body text and consistent section spacing. Account agreements use the existing workspace shell and mobile navigation. UI metadata omits the language label; version/language/hash remain part of the evidence contract. Future translated documents will follow the app language selector.

School acceptance controls appear only for eligible representatives. Accepted cards show the saved date and version instead of another form. Reading an agreement opens a labelled new tab so checkbox selections remain intact. Notice history has a refresh action. No redundant withdrawal button appears while optional tools remain unavailable. The APIs continue to reject opt-in and keep acceptance, notice delivery and preferences separate.

Owner-specific bodies were rewritten privately as immutable version .3, with introductory summaries, clearer responsibilities, retention criteria and school processing details. Internal publication conditions and staging commentary moved out of the body; a small environment label remains in the surrounding staging UI. Planned tool names and policy checks remain in the internal tracking register above until an actual configured integration is ready to be disclosed. No tracking, email or paid flow was enabled. Production contract, retention, school entity/instruction and owner approval gates remain in force.
