# Account, membership and removal interfaces after B2

Recorded 9 September 2026 from the owner's B2 review. This is an explicit follow-up within B3/B4/B5/B8/C4, not a new data model or a completed UI redesign. [Roadmap](IMPLEMENTATION_ROADMAP.md) · [B2 runtime contract](MEMBERSHIP_AUTHORISATION.md).

## What B2 already supports

An account is global. It may have no school, several schools, or both administrator and instructor roles within a school. Platform authority is separate. A school administrator controls school access, not a person's global credentials or account status.

The platform's Accounts screen still reuses the older person form. Creation offers one optional initial school and one initial role. This is a form limitation, not a database restriction. After creation, a platform administrator can select each school, open People, and add the existing account with independent administrator/instructor checkboxes. Existing access can be edited by that school's administrators. New school affiliations remain platform-controlled until verified invitations ship in B4.

Current removal controls are in detail screens:

| Action | Current location and authority | Meaning |
| --- | --- | --- |
| Remove school | Schools → school details → Remove school; platform administrator | Soft removal from operations/public schedule. Personal accounts survive. This is not the complete owner closure/retention flow. |
| Remove lesson | School lessons → lesson details → Remove lesson; school/platform administrator | Soft removal from the schedule. Future cancellation, notification and refund rules belong to C4/E5. |
| Remove school access | People → School access → Removed; authorised school/platform administrator | Removes that membership's staff access. Keeps the person's login, personal bookings and other schools. Owner and self-removal safeguards apply. |
| Deactivate account | Accounts → person details → Deactivate person; platform administrator | Global account deactivation with session invalidation. Self-deactivation and active-owner removal are protected. This does not erase personal data. |

## Required follow-up

- **B3, FE/BE:** make account creation clearly personal and school-independent. Use consistent Accounts/Create account wording. Keep optional school access as a separate step; do not suggest a permanent student/instructor account type. Self-registration and profile editing use the same model.
- **B4, FE/BE/DB:** provide an accessible membership list per account, showing each school, independent role checkboxes and active/suspended/removed status. Make adding another school and editing existing access clear. School administrators see only their school; they invite people instead of creating global credentials. Implement verified acceptance before opening affiliations beyond platform operators. Test one person teaching at two schools and administering either or both.
- **B5/B8, FE/BE/DB/Ops:** make school closure, ownership transfer, global deactivation and permanent account deletion separate named actions. Put relevant actions consistently in detail/settings views with mobile access. Explain effects and require confirmation. B8 adds self-service deletion/export, retention rules and erasure of media/caches; never describe current deactivation as completed GDPR erasure.
- **C4, FE/BE/DB/Ops:** make lesson cancellation and removal easy to find, with booking impact, notifications and attendance/history handling. Payments later add refunds. Do not implement indiscriminate permanent lesson deletion as a substitute.

Deliver this as small UI releases after B2 within the existing roadmap tasks. Keep the same visual language and test desktop, mobile, keyboard access and role boundaries. The owner explicitly accepts this work following B2. Piotr's Conditions redesign remains separate F17/F18 work and requires Figma review first.

## One-off test-data cleanup

The owner separately authorised removing irrelevant staging data and matching production, while retaining the owner’s platform administrator account and `teststudent`. This operator cleanup is not an end-user deletion feature. Retain Demo Surf School and the test student's existing customer link, plus all forecast spots/configuration. Preserve each environment's protected credentials and active sessions; do not clone login tokens or security counters between environments. Record execution and verification in the B2 release evidence.
