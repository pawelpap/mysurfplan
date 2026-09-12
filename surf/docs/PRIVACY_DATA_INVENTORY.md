# Personal data and privacy implementation record

12 September 2026. **A4 audit and recommendations, not a declaration of compliance.** Application code, database contents and provider settings were not changed by this audit. The owner asked to decide which personal data MyWavePlan needs. The collection specification below is the recommended implementation contract for B3 onwards; it is not all implemented today.

[Roadmap](IMPLEMENTATION_ROADMAP.md) · [Draft documents](PRIVACY_DOCUMENT_DRAFTS.md) · [EU move](EU_DATA_MIGRATION_PLAN.md) · [Children and guardians](CHILDREN_AND_GUARDIAN_BOOKINGS.md)

## Operator and decisions

Owner-supplied business details, 12 September:

| Field | Value |
| --- | --- |
| Operator | PAWEL PAPLINSKI, registered self-employed activity in Portugal, as confirmed by the owner |
| Tax identifier | PT311219217 |
| Correspondence address | Confirmed by the owner; retained in local `docs/private/PRIVACY_DATA_INVENTORY.md` until legal publication review |
| Business email | pawel@mywaveplan.com, planned mailbox |
| Support and privacy email | support@mywaveplan.com, selected by the owner; receiving mailbox not yet active |
| Responsible person | Pawel Paplinski, operator and initial privacy-request owner; no DPO appointment is implied |

Use the supplied identity in drafts. This audit has not checked a business registration certificate, VAT registration/exemption, business activity codes or invoicing obligations. Do not describe the operator as a separate incorporated company. Activate and test the support inbox before publishing it. The owner reports sending home.pl support requests; [mailbox status](MAILBOX_SETUP.md).

The owner confirmed that the first self-service pilot may remain **adult accounts and adult participants, 18+**. Children’s lessons are in product scope through F11. Optional 16–17 accounts are a later proposal, not permission to open registration to minors now. Adult confirmation is a product-scope measure, not proof that all child-protection obligations have been met.

## Which personal data to collect

Collect information when the relevant feature needs it. Viewing a forecast should not require a personal profile. A database column is not a reason to ask every user to fill it in.

| Journey | Required data and purpose | Optional or later | Exclude from this step |
| --- | --- | --- | --- |
| Browse forecasts | Requested spot/date/time; transient network data needed to serve and protect the request | Browser location permission for nearby sorting | Name, email, phone, home address, birth date; no visit-history profile |
| Create an adult account, B3 | Email, password, preferred name; 18+ confirmation with timestamp and policy version; terms acceptance and record of notice delivery | Allowlisted language preference once A9 is authorised | Mandatory surname, phone, photo, gender, tax number, school, profession or precise location |
| First lesson booking, C3 | Participant’s first and family name, adult eligibility, linked account, lesson/spot, booking status and contact email | Phone for day-of-lesson changes, optional by default. A school must justify and explain any compulsory phone requirement. Structured self-reported surf level only if used to match lesson eligibility | Home address, identity document, medical history, payment-card data; no generic biography |
| Staff invitation/access, B4 | Work/contact email, name, school membership, independently granted roles and grant/revocation evidence | Public professional name, short biography/photo through reviewed profile publication | Staff birth date, tax details, home address, another school’s roster; no automatic public email |
| School setup, B5 | School name, representative’s account/authority, business contact; listing location/contact when publishing | Legal entity and billing details at the relevant paid/contractual step, with a field-specific reason | Staff/customer profiles merely to activate a school; no automatic publication of the owner’s personal contact |
| Pay online, D/E | Provider references, amount/currency, status, payer and seller links; legally required billing fields only when applicable | Invoice name/address/tax ID according to the reviewed fiscal flow | Card numbers, CVC, bank login details, unnecessary identity-document copies in Neon |
| Support/rights request | Reply address, relevant account reference, request and minimal resolution evidence | Proportionate identity check only if needed | Passwords, full identity documents by default, unrelated screenshots or children’s details |
| Photos/progress/reviews, B7/F | Only when the user chooses that feature and its visibility is clear | Separate publication choice, structured private progress | Automatic public profiles, ranks or photo permission through general terms |

An account email identifies the login owner, not necessarily the lesson participant. Preserve that distinction now so later parent/child bookings do not require fake child emails. Do not create a permanent surfer/coach/owner personal-data type; membership grants access independently.

Retain existing usernames and login compatibility, including teststudent, while B3 uses email for new self-service accounts. Current administrator-created accounts require both names; making surname optional at signup needs coordinated API, validation, database-function and UI changes. Do not simply remove the required marker in the form.

Adult account schema additions proposed for B3/B6: age-eligibility attestation time/version, separate versioned legal-document evidence and optional preference records. Store the fact of confirming 18+, not a date of birth or identity image. Reassess proportionate age assurance if actual use indicates minors are entering the adult pilot. See F11 for the additional child-participant model.

## Current implementation and processing inventory

Evidence: application inspection at `a31a27e`, followed by A8 infrastructure/operator release `73a9ae1` on 12 September. Pages, components, styles and runtime application logic are unchanged by A8. Schema/data fingerprints, credentials/session continuity and active spot counts were verified during migration without publishing personal rows or secrets. [A8 release evidence](archive/releases/RELEASE_2026-09-12_EU_MIGRATION.md).

At A8 completion each environment retained 3 users, 2 school-student rows, 1 school and 17 active spots; lesson/booking fixtures were cleaned. Unused `surf_bookings`, `surf_lessons` and `neon_auth.users_sync` were removed after empty/dependency checks. Dated counts do not guarantee future contents. The old US project is deleted; retained EU test/ancestor branch purposes are in the [runbook](EU_DATA_MIGRATION_PLAN.md).

The primary database rows below now reside in Neon AWS Frankfurt, with Vercel application functions in fra1. Browser storage and other recipients are distinguished below. This is not an EU-only claim for every provider’s logs, support or network processing. The operator owns this inventory; schools must approve their purposes, recipients and retention where they are controllers. Legal bases remain proposed and require purpose-specific review.

| ID / purpose | Current data and source | People / permitted recipients | Proposed role and basis | Current retention / next control |
| --- | --- | --- | --- | --- |
| P01 Account and support identity | `users`: UUID, name/family name, email, optional username/phone/description/photo URL, verification/login/creation/update dates, status, demo flag; entered by platform admin today | Account holder; platform admin. School access uses scoped projections, not permission to edit global credentials | Operator controller; contract for the person’s account service. Staff contact handling requires its own assessment where the person is not the contracting party | No timed profile purge. API deletion sets `deleted_at`; B3 minimises signup fields, B8 erases/anonymises by purpose |
| P02 Authentication and abuse prevention | Salted scrypt password hash and auth version; `auth_sessions` token hash/user ID/expiry/revocation. Login request receives raw password and IP transiently; `auth_login_limits` stores HMAC buckets for identifier/network/pair, counts and expiry, not raw IP/email | Operator’s restricted administrators, Neon/Vercel; no school access to credentials | Operator controller; account authentication necessary for service, abuse prevention proposed legitimate interest with balancing assessment | Session validity 7 days; at login, up to 500 expired rows deleted. Rate window 15 minutes; opportunistic cleanup of up to 500 rows over 24 hours past expiry. Neither is a guaranteed purge schedule |
| P03 School roles and ownership | `school_memberships`, `membership_roles`, `platform_role_assignments`, school owner link: identifiers, roles, status, grantor/timestamps | Person, authorised school admin for that school, platform admin | Operator controller for access security; school controller/operator processor for school-directed workforce administration, subject to signed terms | Revocation retained; no timed purge. B4/B8 define minimal audit record and removal |
| P04 Lessons and attendance relationships | `students`, `coaches`: names, emails, user/school links. `lessons`, `lesson_coaches`, `bookings`: date/spot, difficulty, notes, assignments, capacity, status/timestamps; entered by staff or booking customer | Booking customer and authorised school staff under current permissions; public listing contains instructor ID/name, not contact email, customer list or private lesson notes | School controller/operator processor for delivery records. Operator separately controls personal account/booking service, with explicit purpose separation | School/person/lesson soft deletion and cancellation retain data. No lifecycle purge. Notes can contain personal information despite having no medical-specific fields |
| P05 Invitations | `school_invitations`: invited email, roles, inviter, hashed token, status, expiry and acceptance links | Invited person, authorised school staff, operator and future sending provider | School-directed invitation processing plus operator access-security purpose; school documents basis and source | Schema exists; sending/acceptance flows not live. B4 implements expiry, notification and purge |
| P06 Nearest spot and preferences | Browser geolocation returns latitude/longitude to React memory; distance computed locally. Theme in local storage; selected spot/date/time in navigation URL | Browser/device location provider and person. App server receives selected public spot, not device coordinates from this flow | Optional user-requested location feature; browser permission plus clear purpose information. No consent to tracking inferred | Position is not written to DB/storage by the app; A–Z stops using it for sort but does not clear existing React position. Cleared on provider unmount/page lifecycle. Theme has no app expiry |
| P07 Forecast configuration/provenance | Public spot coordinates, tide/model data/cache; `changed_by` UUID in calibration history/profiles; free-text notes/sources | Forecast consumers receive public forecast fields; configuration access platform-admin only | Mostly non-personal environmental data; operator controller for identifiable staff change history, proposed legitimate interest | No calibration-author deletion policy; preserve scientific versions while separating or removing unnecessary author identity |
| P08 Hosting and diagnostics | Vercel receives IP, URL, headers and request metadata; several API catch blocks log entire error objects. Browser boundary uses `console.error`, no central reporting | Restricted operator/provider access; potential SQL details in error objects require review | Operator controller; security/reliability legitimate interest, minimum necessary diagnostics | Provider log retention/export/location not verified. No claim of systematic redaction. A6 adds allowlisted errors, retention, access and alerts |
| P09 External browser resources | Google Fonts CSS/font/preconnect on every page; arbitrary stored profile URL may load an image from its host; OpenStreetMap link when clicked | Google or chosen image/map host sees request metadata/IP when browser connects | Provider role/basis must be assessed, not automatically called our processor | A4/B6 follow-up: serve Poppins locally with the same design; B7 approved media origins and lifecycle. No map iframe found |
| P10 Legacy/recovery copies | Live legacy tables removed; old US project deleted. EU history, reusable rehearsal and staging ancestor remain | Restricted operator/provider administrators | Original purpose/basis during a justified recovery/test need | Seven-day history; dump and native restores plus later erasure/revocation replay tested. Branches have separate lifecycles; A6/B8 must automate operational retention and replay. [Inventory](EU_DATA_MIGRATION_PLAN.md) |
| P11 Business/support correspondence | Operator contact/contract details with hosting, domain, email and development providers; support requests sent by owner through Proton | Operator, recipients and their mail providers | Operator controller for business correspondence; contracts/legal obligations or assessed legitimate interest as applicable | No MyWavePlan support mailbox/ticket retention established. A6 assigns request owner, retention and secure handling |

`users.role`/`school_id` are legacy compatibility fields; they are not the current membership authority. Preserve their migration constraints until deliberately removed. Schema inspection is not an audit of actual provider access or all backups.

Code references: [account API](../pages/api/users/index.js), [deactivation API](../pages/api/users/[id].js), [auth](../lib/auth.js), [session store](../lib/auth-store.mjs), [login counters](../lib/login-limits.mjs), [location](../components/spot-select.js), [theme](../lib/theme.mjs), [public lesson projection](../pages/api/public/lessons.js), [font loading](../pages/_document.js), [membership migrations](../db/migrations/20260909_global_memberships.sql). [Permissions matrix](ACCESS_CONTROL.md) remains authoritative for route access.

## Browser storage and recipients

| Item | Purpose / content | Current duration | Decision |
| --- | --- | --- | --- |
| `msp_session` cookie | Signed opaque session token and issued time; no profile/email in current payload; HttpOnly, SameSite=Lax, Secure in production | 7-day maximum; logout clears cookie and revokes its session | Necessary authentication, including demo. Explain in storage notice; no marketing consent gate for login |
| `mywaveplan:appearance` local storage | System/light/dark preference | Until replaced or cleared by browser/user; login always uses system theme | Requested appearance preference; provide reset and document persistence |
| Device coordinates | Temporary React state, no app persistent storage | Page/provider lifetime, not a saved location history | Keep on device; provide A–Z fallback. Browser/OS location services have their own processing |
| GTM, GA4, session replay | No integration found in inspected app sources/dependencies | Not applicable today | C5 before C6, no optional tags before consent. Verify deployed network behaviour and provider-injected scripts before publication |

Open-Meteo requests are server-side and contain **spot** coordinates, selected model and forecast variables, not visitor coordinates, names or emails. The service sees our server’s request metadata. Tides and daylight are calculated locally; the tide-data GitHub request is server-side. Do not equate a spot selected in a URL with proof of a person’s presence or surf session.

## Retention proposal

The durations below are proposed operational defaults, not statutory periods and not existing guarantees. The operator must approve them and schools must confirm their purposes. An expiry timestamp prevents use; a separate deletion job is needed to bound storage. A6/B8 must cover logs, branches, email providers, exports and restore copies too.

| Record | Proposed trigger / duration | Deletion or exception rule | Delivery |
| --- | --- | --- | --- |
| Unverified signup | 30 days after creation without verification | Remove pending account and tokens; never delete an established legacy account on this basis | B3/B8 |
| Verification/recovery tokens | Short purpose-specific validity decided in B3; delete used/expired hashes within 24 hours | Raw token only in short-lived encrypted outbox payload when durable delivery needs it; never logs/analytics | B3/A6 |
| Sessions / login buckets | Delete expired session rows within 24 hours; rate buckets within 24 hours after window expiry | Keep no raw IP to achieve cleanup; aggregate security counts separately | A6/B8 |
| Active account / profile | While used for the service; review inactivity after 24 months, notify before proposed closure | No automatic unannounced deletion of active school owners or records under a documented retention duty | B8 |
| Erasure request | Revoke access after verified request; target primary-store cleanup within 30 days, subject to lawful exceptions and the statutory response process | Keep only purpose-limited evidence/exceptions; explain retained categories. No promise that soft deletion completes erasure | B8 |
| Invitations | Delete recipient/token payload 30 days after expiry/revocation/acceptance | Retain minimal membership grant evidence separately, not a permanent invitation email history | B4/B8 |
| Ordinary support tickets | 12 months after resolution, then delete/anonymise | Disputes/incidents retained only under a recorded reason and review date | A6/B8 |
| Operational diagnostics | Target up to 30 days for new app-owned minimal logs; shorter where sufficient | Provider defaults must be verified; separately restricted incident evidence expires after resolution/legal review | A6 |
| Email jobs | Erase sensitive payload on completion/expiry; completed metadata 30 days, inspected failure payload at most 7 days | Provider retention/suppression needs a separate reviewed setting; do not remove a necessary bounce suppression blindly | A6/B3 |
| School bookings, attendance and staff evidence | Keep for the active service and a school-approved operational/claims period; exact durations unresolved | No arbitrary multi-year school default. Archive/anonymise completed records where justified; resolve before real lesson collection | A4/B8/C3 |
| Legal acceptance and privacy requests | Minimal evidence while needed for accountability/claims; final period to be reviewed | Document version/action/time/subject, restricted access. Privacy delivery is not consent | B6/B8 |
| Billing, invoices and disputes | Exact Portuguese obligations and merchant model must be confirmed with accountant | Restrict retained financial records from normal account use; do not erase legally required evidence with profile | D/E before paid launch |
| Media | Remove replaced/orphaned/unpublished files through a bounded job; final grace period in B7 | Remove thumbnails, EXIF and CDN copies; no public child media in initial scope | B7/B8/F11 |
| Backups, branches, developer exports | Shortest tested recovery window; live Neon history seven days; owner waived the separate US migration rollback copy, which was deleted on 12 September | No indefinite backup branch. Restrict access, expire copies, reapply deletion/revocation records before a restore is served | A6/A8/B8 |

## Controller/processor and provider register

Do not use one blanket role for every purpose. The operator controls personal accounts, platform security and its own billing/support. A school decides how to deliver lessons and administer its staff/customer records; for those instructed processing purposes MyWavePlan is proposed as processor. School business contacts can also be personal data. Review whether any shared purpose entails joint control before launch; a contract label alone does not settle it.

| Provider / status | Data path and location evidence | Agreement / action before relevant use |
| --- | --- | --- |
| Neon, live, Vercel-managed Launch | App DB and auth/security data in `aws-eu-central-1`; seven-day history, tested restores. Old US project deleted 12 September | Retrieve applicable Marketplace contract, DPA, subprocessor list and transfer terms; record accepted version and party. Region evidence does not establish all provider processing locations |
| Vercel, live app/DNS | Both application deployments verified in `fra1`; requests, global CDN, logs, builds and environment secrets have separate processing paths | [DPA](https://vercel.com/legal/dpa) and [subprocessor register](https://security.vercel.com/). Record actual acceptance, roles, transfers, log retention and access; no blanket EU-only claim |
| Mailjet, account/domain verified; app sending pending | Future email recipient/body/delivery metadata. Published storage: Frankfurt and Saint-Ghislain | Verify effective DPA/subprocessors, support access, recipient-mail routing and retention before tests. Turn off open/click tracking for operational mail. [Storage statement](https://documentation.mailjet.com/hc/en-us/articles/360042712274-Where-is-my-personal-data-stored) |
| home.pl, selected; MyWavePlan receiving not active | Future business/support inboxes, message bodies/attachments; exact primary/backup locations not verified | Confirm contract, DPA, processing locations, backups, deletion/export and mailbox isolation; wait for owner-sent support response |
| Google Fonts, live browser dependency | Visitor IP/request metadata reaches Google from the browser | Remove remote dependency by self-hosting the same approved font; verify page layout and requests. Do not call this GA4 |
| Open-Meteo / tide data GitHub, live server requests | Public spot data, server IP and provider-key metadata where configured; no user details in adapter | Provider/source register in A5; keep user data out of requests and error logs. No runtime Surfline integration |
| OpenStreetMap / profile image hosts | External browser request when link/image is used | OSM is a link, not embedded tracking. Audit and constrain arbitrary avatar origins in B7 |
| GoDaddy, GitHub, Figma, Codex and operator email provider | Domain/admin/development records, potential documents/screenshots; no customer database export required for routine work | Include applicable business/development agreements in operator register; no production personal data or secrets in designs, source control or AI prompts by default. Owner’s Proton support correspondence is separate from the future home.pl mailbox |
| Future media, payment, analytics, error-reporting providers | Not implemented or not selected yet | Add purpose, exact contracting entity, data, recipients, regions, transfer mechanism, retention, DPA/version and deletion evidence before enabling |

A link to a supplier policy does not prove contract acceptance or adequate transfer safeguards. Retain agreement evidence in restricted operator storage, not credentials or signed private documents in a public repository. Assess legitimate interests, DPO/DPIA requirements and records-of-processing applicability before real onboarding; keep this inventory regardless of any small-business exemption. Revisit the DPIA screening for children, precise-location history, profiling or public rankings.

## Rights and incident operations

Route requests to the selected support inbox once active, or the supplied correspondence address. A6 must assign a monitored owner, ticket ID, receipt date and response deadline. Verify identity proportionately, separate global-account requests from school-controlled records, and provide access/correction/export/erasure/restriction/objection/consent withdrawal as applicable. Do not make a login or an ID scan the only possible request route. Respond within one month under the applicable rules; document any lawful extension and notify the person within the first month. [CNPD rights guidance](https://www.cnpd.pt/cidadaos/direitos/).

An export must exclude other students’ data, secrets, password hashes and recovery/session tokens. Resolve school ownership before account closure without indefinitely blocking a valid erasure request. Retained records need a purpose, access restriction and expiry/review date. Restore rehearsal must reapply later erasure, disabled-account and revoked-role/session decisions before opening traffic.

For a suspected breach, A6 contains/records the incident, identifies affected purposes and controllers, and assesses notification duties. A processor alerts the school without undue delay; the operator assesses its own authority/individual notifications. Preserve proportionate evidence without logging the affected secrets again. No central incident automation is claimed as implemented.

## Delivery and open decisions

| Work | Owner / roadmap | Completion evidence |
| --- | --- | --- |
| Minimal signup/booking fields and no fake child emails | B3/C3/F11 | FE and API enforce the same minimum; tests cover legacy logins and participant/purchaser distinction |
| Same-font self-hosting and external-resource audit | B6, with A6/B7 follow-up | No remote Google font requests; unchanged desktop/mobile light/dark typography; allowed image hosts |
| Reviewed notices/terms and separated evidence | Operator/reviewer, A4/B6 | Working contact, agreed purposes/bases/periods; accessible versioned notices; withdrawal separate from account contract |
| EU move and provider contracts | A8/A7 | Approved destination, tested cutover/restore, documented exceptions and expiring US copies |
| Lifecycle cleanup and privacy rights | A6/B8 | Scheduled purge, export/erasure tests including no-traffic periods, provider copies and restore replay |
| Logs/security LIA and DPO/DPIA screening | Operator, A4/A6 | Purpose/necessity/balancing record; retention/access; reasoned screening, not an assumed exemption |
| School role split and operational retention | Operator + pilot school, A4/B6 | Agreed processing instructions, notices and periods before real school records |
| VAT, invoices, seller/refund obligations | Operator + accountant, A4/D/E | Per-flow documented responsibility before charging; does not block read-only migration preparation |

A4 preparation is complete enough to review and prepare A8; A4 remains open for contract/legal review and unresolved fiscal/retention decisions. Do not publish these drafts or start real onboarding based on this document alone.

Sources checked 12 September: [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj), [EDPB data minimisation](https://www.edpb.europa.eu/sme/learn-the-basics/data-protection-basics_en), [EDPB lawful processing](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en), [CNPD consent](https://www.cnpd.pt/organizacoes/areas-tematicas/consentimento/). The tables are MyWavePlan-specific design recommendations and code findings, not quoted regulatory retention schedules.
