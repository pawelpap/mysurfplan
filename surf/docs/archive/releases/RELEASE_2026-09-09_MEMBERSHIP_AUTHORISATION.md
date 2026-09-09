# B2 membership authorisation release

Verified 9 September 2026. [Current handover](../../HANDOVER.md) · [Runtime/migration contract](../../MEMBERSHIP_AUTHORISATION.md) · [UI follow-up](../../ACCOUNT_AND_LIFECYCLE_UX_FOLLOWUP.md).

## Scope and deployment

One global identity now supports no-school access, several school relationships and independent administrator/instructor roles. Sessions remain valid independently of a school. Membership removal/suspension affects only that school's staff capabilities. Platform authority, ownership and ordinary personal bookings are separate. School administrators can no longer edit global credentials, email or account status.

The UI adds personal bookings/teaching across schools, a workspace selector and independent school-role controls. Conditions remains first. Booking identity uses explicit user/customer links, with separate staff booking-on-behalf and transactional capacity checks. Forecast algorithms, spot calibrations, prices and email services were not changed.

| Environment | Application revision | Fully checked deployment | Canonical alias |
| --- | --- | --- | --- |
| Staging | `bcb5ceaa640571915129b070ad4ad94b188ea80f` | `dpl_DHN9eYgHAo8jtXp3v9mU3BtNkEAL` | `staging.mywaveplan.com` |
| Production | Same | `dpl_FETHv1xL5N3Cgiq5y7LoRLCzaGif` | `mywaveplan.com` |

Both deployments were READY before activating membership authority. Production followed the passing complete staging suite. Documentation-only follow-ups have the same application code and may create newer deployment IDs.

## Database transition

Neon project `shy-paper-68550619`: existing isolated rehearsal `br-morning-glade-adu8v769`, staging `br-small-salad-adx0nsj2`, production `br-weathered-silence-adp30k9s`. No branch creation, reset, provider account change, paid upgrade or region migration.

| Migration | SHA-256 |
| --- | --- |
| `20260909_membership_runtime` | `84aa414883a82b85bdaccc55d8e6c692daa703c61020b0bce2a18ae939309169` |
| `20260909_membership_authority` | `6aa5a701e02230a422fada48e4b94360ed74d936fa26323f6af74c921a3ac736` |

The preparation adds generic capability/account/membership/booking functions and a school-access view compatible with the old phase. Activation reconciles under locks, retires the B1 bridge, switches authority, guards retired writes and replaces the single-school constraints. Source-table fingerprints passed in the migration transactions. Applied SQL files are immutable. Both live ledgers match, both report `memberships`, and full schema comparison returned an empty diff.

## Verification

- Local: 88 regression tests; Node.js 22 production build and lint passed, with the pre-existing avatar-image warning. Dependency tree passed; npm audit returned zero findings. No dependency versions changed.
- Rehearsal: complete preparation/activation and database cases rolled back successfully before applying to the isolated branch. Activation and ownership constraints were exercised before either live cutover.
- Each live environment: nine database scenarios in a rolled-back transaction. They cover no-school/multiple memberships, per-school customer links, global-account boundaries, suspension, ownership constraints, school closure/deletion, retired writes, booking identity/email changes/idempotency/capacity and platform account administration. Source fingerprints were unchanged by the fixtures.
- Each live environment: 20 real API groups covering private/public boundaries, malformed IDs, school/platform controls, lesson assignment, student identity/privacy, legacy-link rejection, no-school accounts, combined roles, two-school teaching/bookings, immediate suspension, concurrency, demo forecast and school closure. Production ran after the cleanup below. Staging's full suite ran before cleanup; seven affected API groups were repeated after it.
- Each live environment: seven native Chrome browser checks. School access exposes independent role checkboxes without global credentials. Multi-school personal views work. Suspended staff access disappears while personal bookings remain. Synthetic location near Bico selects it first among 17 spots; 16 daily tiles load and student spot settings stay hidden. Native arrow-key tide selection changes time. At 390×844 in dark mode the menu/bookings flow has no horizontal overflow. No page errors. Staging repeated these checks after cleanup.
- A saved pre-migration teststudent session remained valid after activation and cleanup on both environments. Only those release-test sessions were revoked afterwards. The API runner also revoked its own demo logins and removed its exact fixtures.
- Bounded Vercel error/fatal scans on both deployments returned no matching entries. This does not establish continuous monitoring; A6 remains open.

All test browser contexts were closed. The temporary local server was stopped. Physical iPhone/Safari was not exercised in this release. Two early local browser-harness assertions were corrected to target the main People view and forecast day buttons accurately; the stable full staging/production suites passed.

## Owner-authorised disposable-data cleanup

During staging review the owner explicitly authorised removing irrelevant records and matching production, retaining the existing platform administrator and `teststudent`. A separate cleanup was rehearsed in a rollback transaction in each environment, then committed with bounded locks and assertions against unexpected accounts/schools.

Each environment removed three disposable accounts, six schools, nine instructor records, seven customer records, seven current lessons, five current bookings and four instructor assignments. Seven legacy `surf_lessons` rows and seven legacy `surf_bookings` rows were also removed. One obsolete staff membership and its role were removed. No invitation rows existed. Session rows belonging to removed accounts followed their foreign-key cascade.

The retained baseline is two accounts, one active platform assignment, Demo Surf School, its existing explicitly linked test-student customer record and 17 active spots. There are no staff memberships, instructors, lessons or bookings in the retained demo dataset. The demo school remains a legacy workspace without an inferred owner, the sole reconciliation issue. Platform administration can still manage it; future owner claiming/setup belongs to B5.

Protected account records, passwords, email-verification values, session records, platform grant and the full forecast configuration were fingerprinted before and after each cleanup transaction and remained unchanged. The previously reported unlinked past booking belonged to discarded test data and is no longer a pending production issue. No name/email-based claim was inferred.

After all release fixtures were removed, operational records matched between environments. All 17 current spot rows, profile/settings/schema data and tide constants matched after excluding environment timestamps. All 58 historical calibration values and sources matched as well. Historical audit IDs/timestamps and 17 `change_note` entries differ intentionally: staging records the local review; production records its approved promotion. Those audit records were preserved. Authentication sessions, login counters, account security fields and caches were not cloned. This is matching application state, not a byte-for-byte database copy.

## Remaining work and recovery

B2 is complete; the canonical roadmap has five completed items and 65 open. The owner accepts the remaining account/lifecycle interface work as following B2. The platform's reused Add person form still offers one initial school/role; it does not restrict the membership schema. B3/B4 add clearer global account creation and a per-person school membership overview. B5/B8/C4 improve school closure, account erasure and lesson lifecycle controls. Existing detail screens already expose soft removal/deactivation and school-access removal. See the linked UI follow-up for exact locations and acceptance criteria.

Recommended next design task: F17, Piotr's Conditions proposal in Figma and owner review. F18 implementation requires that review. B3 self-registration/email depends on its policy, EU, localisation and delivery prerequisites. No email or provider account setup was performed for B2.

After activation, an old B1-only application is not a safe rollback. Use B2-compatible code or a forward repair; temporarily restrict affected mutations if necessary while preserving login/forecasts/bookings. Do not reset a database, restore the deleted test data or drop memberships to make old code fit. The one-off cleanup does not implement permanent user-facing data erasure or a production restore procedure; those remain B8/A6.
