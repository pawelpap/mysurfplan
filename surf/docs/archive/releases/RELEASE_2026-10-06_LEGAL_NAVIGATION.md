# Compact legal navigation

Staging-only correction, 6 October 2026.

The sidebar footer has one compact Legal control, opening Privacy and agreements inside the workspace. It replaces the duplicate standalone link and oversized navigation tile. The control keeps a 44-pixel touch target, keyboard focus and a subtle active indicator. Data licences are available in an expandable section of this page, using the same content as the existing public /legal route.

Students see their own terms and acceptance history. Only active owners and school administrators can accept a school agreement. The staging indicator remains conditional on verified staging boundaries; a production response has preview=false. An additional test covers the production indicator and a student membership without representative rights.

Terms acceptance currently takes place explicitly on this page. First-account onboarding and a mandatory updated-terms step are separate pending work. Optional tracking remains off. A tracking-consent banner and persistent purpose choices must be implemented before those tools are enabled. Privacy-notice delivery is separate from acceptance.

Validation: 147 tests passed; lint and build passed with the existing Avatar image warning. Local browser checks passed at desktop and mobile sizes, including compact Legal navigation, drawer closure, expandable licences and 320/768-pixel document menus. No immutable legal document, tracking installation or production deployment changed.
