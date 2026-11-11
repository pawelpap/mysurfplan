# B5 private school setup

11 November 2026. Release 1 implementation is authorised for staging, followed by independent user verification. Production promotion needs the owner's explicit approval. [Release sequence](B5_RELEASE_PLAN.md) · [Figma](https://www.figma.com/design/WVjUwzfOIGOuAID23GPIdZ?node-id=453-82).

A verified registered account creates a private draft using school name and timezone. The database creates its explicit owner membership atomically. Actor-scoped request IDs and a stored payload fingerprint make retries safe; a changed retry is rejected. A user lock serialises creation with account closure and administrative deactivation. Existing-school ownership is never inferred.

School settings hold name, description, timezone, contact email/phone, website, up to five HTTPS social links and active operating spots. Drafts are editable by their explicit owner; operational legacy schools preserve existing owner/administrator rules. Platform authority can inspect but cannot edit another person's draft. Revision checks reject stale writes without overwriting edits. Name changes retain the existing generated-slug behaviour, so shared addresses can change and duplicate slugs conflict.

Draft, listing and pilot-access states are independent. Saving or completing a checklist does not activate a workspace or publish it. Release 1 has no activation, pilot-approval or publication endpoint. Drafts cannot use lessons, team invitations, bookings or student affiliation. Anonymous school listings expose only public/legacy names and addresses, without private contact fields.

The checklist uses saved name/timezone, description, contact details, operating spots and exact acceptance of the published school-processing agreement. Staging-preview evidence cannot complete its published-agreement step. Draft owners can open existing Legal and explicitly review the agreement; no agreement is accepted by creation or replay. Published agreement acceptance and a separate access decision remain gates before independent operational onboarding. The new timezone is a school setting; existing lessons continue using spot timezones.

The additive, checksummed migration is `20261111_school_onboarding.sql`. Rehearse with rollback and fingerprints, apply to the isolated rehearsal database for real race checks, then rehearse/apply staging. Do not edit installed SQL. Production requires explicit approval. Retain B4 membership history and immutable legal records on rollback; do not revert to code that anonymously lists private drafts.

Initial verification: 207 unit tests and production build passed; seven transactional groups, six real concurrency groups and 21 B4 invitation/retention regression groups passed on the isolated rehearsal database. Responsive UI checks and staging human verification are still in progress. This record must be updated with final deployment and cleanup evidence.

Release 2 remains school branding/publication and B7 secure media, including personal profile photo upload/crop/replace/remove. Release 3 remains explicit school claims and ownership transfer. No stores, subscriptions, payments or connector account changes are included in release 1.
