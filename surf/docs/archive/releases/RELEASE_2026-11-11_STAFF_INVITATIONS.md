# Staff invitations release, 11 November 2026

B4 is released on staging and production after the owner authorised production following independent staging tests. The same application source is deployed to both environments. The expected configuration difference is staging cron off and production cron every ten minutes.

## Runtime and scope

| Environment | Verified alignment commit | Verified runtime deployment |
| --- | --- | --- |
| Staging | 3bc0261aa545a096c541b106254fee2c5018f85c | dpl_8hKTfymX6Ndmm7A6xewUfjpH52VE |
| Production | a945a3668b06a09c33ea4e42da5903078469fe34 | dpl_H2xca51o6soE4tsUyJatoZUjEDsi |

Documentation-only closeout commits may follow these verified runtime receipts. [Staging](https://staging.mywaveplan.com) · [Production](https://mywaveplan.com) · [Figma review](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ?node-id=449-147).

The release adds school staff invitations, verified single-use acceptance, explicit instructor-record claims, independent roles, owner-controlled administration, suspension/removal, per-account memberships, minimal access events and bounded invitation retention. Existing account, booking, other-school and forecast behaviour is preserved. Unverified legacy accounts use Support. Independent-school onboarding and school-processing acceptance remain B5 work.

## Database and privacy

Three additive, checksummed migrations were rehearsed and applied independently to staging and production: 20261111_staff_invitations, 20261111_invitation_retention and 20261111_invitation_reissue. The latter two preserve the immutability of SQL already applied during rehearsal. Existing-data fingerprints passed; synthetic transaction fixtures were rolled back. No environment copy or owner inference occurred.

Privacy and storage notice version 2026-11-11.1 are available in English, European Portuguese, Spanish and French. Historical versions and existing acceptance records remain unchanged; production terms remain 2026-11-04.4. App invitation recipient/token records expire through scheduled cleanup after thirty days, with minimal grant evidence separate. Existing-account addresses and Mailjet's separately retained contacts/statistics are not erased by that cleanup. Shared service-email footers include published, language-specific privacy links in HTML and text. The implementation/disclosure review is not a claim of legal approval.

## Validation

- 193 automated tests and a Node.js 22 production build passed. Lint retained one existing avatar-image warning. Runtime dependency audit had no findings; three moderate development-tool dependency advisories remain recorded for maintenance, without a forced upgrade.
- Twelve transactional groups covered matching verified identity, permission boundaries, expiry/replay, revocation, removed/suspended access, explicit claims, retention and expired reissue. Six real concurrent groups covered acceptance, duplicate creation, reissue/revoke and inviter-authority races; exact rehearsal fixtures were removed.
- Independent Astra security review found and helped close administrator-grant, stale invitation, removed-role restoration and lifecycle bypasses. A separate privacy review checked provider/data-use disclosures.
- Actual user journeys passed on both deployed environments, including owner/admin/instructor/platform scope, explicit acceptance, wrong-account/unverified/replay states, other-school preservation and responsive language/theme checks.
- Actual emails arrived at the owner-designated test inbox. Staging's two English test messages and production's English, Portuguese, Spanish and French messages were inspected. Production message, button, expiry/help text, invitation destination and privacy language followed the workspace language picker. Production Sent callbacks confirmed delivery. Staging jobs recorded provider acceptance and actual inbox receipt; historical staging callback metadata remains a separate operational follow-up.
- Final alignment checks covered mixed pending/expired/revoked/accepted rows, two/one/no action controls, desktop/tablet/mobile widths, four languages and both themes. Cross-row status/date columns align, visible text centres align within subpixel font rounding, and tablet actions are not clipped. Legal disclosure keyboard operation passed. Actual staging and production retakes verified the deployed corrections.

Initial language-stability checks did not prove cross-row alignment. The owner's screenshot exposed the independent-row auto-width defect. Four corrections were staged and verified before identical production promotion: fixed invitation action columns, centred mobile role/action text, centred Legal toolbar content and tablet member layout.

The first candidate commit 74fc7eace8aad309296728a2e982efcc7020d502 incorrectly packaged a test file as vercel.json. Four builds/previews failed before runtime replacement. The configuration was corrected in 02a829d0d8505cea3f0b861da677359f8b71c1c8, all uploaded file hashes were checked, and subsequent releases were READY. The failed candidates did not replace live production.

## Closeout

All task-only users, schools, invitations and related records were removed from staging and production using exact recorded fixture IDs. Both environments have zero B4 QA users/schools and retain eighteen active spots. Existing users and real records were preserved. Staging had two disposable fixture batches; production had one.

The staging cron registry is empty and its Healthchecks check is paused. Production retains the ten-minute cron and active independent monitoring. Task-created Chrome tabs were closed, the temporary B4 group removed, the existing MySurfPlan group retained and the local server stopped. Private credential exports and temporary fixture secrets were removed after verification. Screenshots and machine measurements are local under output/b4 and are not published customer data.

## Next step and recovery

Next is the proposed [B5 release sequence](../../B5_RELEASE_PLAN.md): atomic draft-school/owner creation and text settings; branding/publication and personal profile photos with B7 media after coherent Figma design; then explicit claiming/atomic transfer. School-processing acceptance precedes independent onboarding. The planning addendum authorises no B5 implementation, storage provisioning or deployment. Use High-reasoning Codex implementation with Astra High ownership/authorisation review. G1 remains a future pilot gate; billing, online payments and optional trackers are not activated by B4.

Keep the additive schema and immutable policy versions if application code is rolled back. Use B2-compatible recovery and repair forwards; do not discard membership/audit history or copy a database. Historical release approval does not authorise a later unrelated production release.
