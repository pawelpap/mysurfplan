# Staff invitations and team administration

B4 staging candidate, 11 November 2026. [Roadmap](IMPLEMENTATION_ROADMAP.md) · [Membership authority](MEMBERSHIP_AUTHORISATION.md) · [Editable Figma review](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ?node-id=449-147).

## User journeys

People opens the selected school's Team screen. A manager can invite staff by email, choose independent Instructor and Administrator roles within their authority, and select the invitation language. A matching provisional instructor record must be selected explicitly. The recipient signs in or registers, reviews the school and roles, and accepts. The link expires after seven days. Reissuing invalidates the old link; revocation grants no access.

Owners and platform administrators control administrator roles and changes to administrator memberships. Ordinary administrators manage instructors within their school. They cannot change an owner, appoint an administrator or restore suspended access. An owner may teach without holding an administrator role. Removing school access preserves the personal account, bookings and other schools. Removed members return through a new invitation. Existing unverified accounts must use Support; neither login nor possession of an invitation marks an email verified.

My profile lists the person's own schools and access. Platform Accounts additionally shows each account's school memberships with links to the relevant team. School administrators cannot browse global accounts or change global credentials.

## Security and delivery

The invitation token travels in the email fragment, is stripped from the address before client requests and is posted to the preview/accept endpoints. Login and registration return destinations contain no token. The tab's session storage keeps continuation for at most seven days, without extending the saved deadline on reload or reopening the same link. Accepting, dismissing or detecting an invalid link clears it. Cross-tab signup guidance explains reopening the original invitation email.

SQL transactions serialise changes within a school and recheck current inviter authority, matching verified identity, account/school lifecycle and membership status. Acceptance is single-use, preserves active roles and restores only newly invited roles for a removed membership. Explicit instructor claims preserve the historical record ID. No account or record is claimed from an email match alone.

Invitations use the existing encrypted Mailjet outbox, staging recipient allowlist, quotas, retries and delivery callbacks. There is no new provider or optional tracker. A worker rechecks pending status, expiry and current inviter authority before dispatch. A request can trigger a targeted delivery attempt; the existing scheduled worker handles retries. No per-school subscription quota is invented by B4.

Expired invitations are marked in bounded batches. Invitation recipient/token records are removed thirty days after acceptance, revocation or expiry. The audit retains actor, recipient account, school, granted roles and time, without retaining the invitation email address. Associated encrypted payloads are cleared. Remaining school audit retention and erasure/export are B8 work.

## Verification and release

Run `npm test`, `npm run build`, the endpoint-pinned migration runner and the rehearsal-only race suite. The runner verifies checksums, deployed prerequisites and existing-data fingerprints. Production requires the explicit --production-approved release flag. The two historical locale changes are verified structurally on staging because their rollout did not add ledger rows; the runner does not invent those records.

```sh
node scripts/migrate-staff-invitations.mjs rehearsal --rehearse
node scripts/migrate-staff-invitations.mjs rehearsal --apply
node scripts/check-staff-invitation-races.mjs rehearsal
node scripts/migrate-staff-invitations.mjs staging --rehearse
node scripts/migrate-staff-invitations.mjs staging --apply
```

All three B4 SQL files are additive and checksummed. Retain the schema if application code is rolled back. Existing B2-compatible code remains required; never restore legacy role authority. A rollback to pre-B4 code also loses the stricter interface, so disable affected staff mutations while repairing forwards if necessary. Do not restore a database or discard membership/audit history to undo the interface.

Staging testing uses exact disposable fixture IDs and a designated test inbox. Remove those fixtures and any temporary staging cron at closeout, then verify the cron registry. Production scheduling remains separate. Production publication requires the owner's release approval and the data-use review below.

## Data-use and publication review

The existing school-record disclosures cover school-supplied contact details and role links. B4 adds invitation delivery through the already configured Mailjet service, school access audit records and necessary tab storage. The versioned browser-storage notice is updated to 2026-11-11.1 in all four languages; historical versions remain available unchanged.

B4 requires publication and verification of privacy notice and browser-storage notice version 2026-11-11.1 in all four languages. The privacy update covers school-directed invitations, application cleanup, provider retention and access history. Terms remain unchanged. This release remains limited to operator-controlled school access. Before independent schools are onboarded through B5, publish the school-processing agreement and record acceptance by an authorised school representative. This review checks implementation and disclosure consistency; it does not establish legal approval or completion of broader school onboarding.

The shared service-email footer includes a language-specific link to the published privacy notice in HTML and plain text. Open/click tracking remains disabled. The [Mailjet sending policy](https://www.mailjet.com/legal/sending-policy/) requires the privacy link. The [Send API documentation](https://dev.mailjet.com/docs/email-api/send-api-v31/send-basic-email) describes automatic recipient contacts, and the [provider retention record](https://documentation.mailjet.com/hc/en-us/articles/360042755094-How-long-are-my-statistics-kept) distinguishes provider contacts/statistics from application cleanup. Existing-account addresses and provider records are not removed by the invitation cleanup.

The additional visual acceptance check compares live language changes in English, European Portuguese, Spanish and French on desktop and mobile. Shared controls and text slots reserve room for the enabled translations while keeping all text visible. This must pass before the staging deployment.
