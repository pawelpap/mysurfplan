# MyWavePlan documentation

Organised 9 September 2026. Start with the handover to resume work, then use the implementation roadmap to choose a task. Top-level files are maintained documents; their status below distinguishes implemented behaviour from future designs.

## Start here

| Document | Role and current status |
| --- | --- |
| [HANDOVER.md](HANDOVER.md) | **Current handover.** Latest recorded release, pending work, decisions and next development step. |
| [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) | **Current task list.** Canonical remaining tasks, S/M/L estimates, dependencies and launch gates. Updated 9 September, including EU location and launch languages. |
| [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) | **Current product plan.** Direction, commercial proposals and delivery phases. The roadmap owns individual task status and ordering. |
| [ENVIRONMENTS.md](ENVIRONMENTS.md) | **Current operating reference.** Local setup, staging/production mapping, migrations and release workflow. Replaces README-staging.md. |

## Maintained design and planning references

| Document | Status and purpose |
| --- | --- |
| [Registration and membership](REGISTRATION_AND_MEMBERSHIP_PROPOSAL.md) | Accepted target design; implementation pending. One account, multiple school memberships and independent roles. |
| [Commercial and privacy architecture](COMMERCIAL_AND_PRIVACY_ARCHITECTURE.md) | Target architecture. Billing, entitlements, privacy and consent are planned; final provider and policy decisions remain open. |
| [Infrastructure capacity and upgrades](INFRASTRUCTURE_CAPACITY_AND_UPGRADES.md) | Account observations dated 8 September and current upgrade/EU-region decisions. Recheck live quotas before changes. |
| [Launch cost estimate](LAUNCH_COST_ESTIMATE.md) | Budget checked 9 September, with assumptions and sources. An estimate, not an invoice or spending approval. |
| [Product expansion assessment](PRODUCT_EXPANSION_ASSESSMENT.md) | Conditional later opportunities: reviews, progress, forecast evaluation, vendors, advertising and mobile apps. |

## Implemented feature references

| Document | Purpose |
| --- | --- |
| [School access and privacy](ACCESS_CONTROL.md) | A1 route permissions, public/private fields, demo isolation and verification. |
| [Conditions architecture](CONDITIONS_ARCHITECTURE.md) | Forecast calculation, providers, freshness and tide model. Dated calibration examples remain historical. |
| [Spot data model](SPOT_DATA_MODEL.md) | Generic spot schema, database-owned coefficients and admin workflow. Live database revisions are authoritative for numerical settings. |
| [Swell energy and water temperature](SWELL_ENERGY_AND_WATER_TEMPERATURE.md) | Calculations, units, sources and presentation decisions. |
| [Home-screen installation](HOME_SCREEN.md) | iPhone/Android installation, icons, manifest and recorded verification limits. |

## Historical records

[archive/README.md](archive/README.md) indexes superseded plans, the previous long handover, dated releases, UX audits and calibration evidence. Archiving a release or calibration report preserves its evidence; it does not mean the released feature has been removed. Numerical snapshots are not live database exports and must not overwrite newer configurations.

## Keeping the documentation clear

- Keep one current HANDOVER.md, one task roadmap and one product plan at this level. Update them in place.
- The handover owns the latest recorded runtime status; the roadmap owns remaining implementation status; the development plan explains product decisions. Supporting proposals do not mark a feature as implemented.
- Add a dated release record under archive/releases after verification and link it from the handover. Archive replaced handovers and plans with dates rather than leaving competing current versions here.
- Keep provenance, verification and rollback evidence. Historical approvals and commands apply to their original release, not to new work.
- Update this index and relative links when moving a document. Update status only from evidence; a documentation tidy-up does not constitute a deployment or live account check.
