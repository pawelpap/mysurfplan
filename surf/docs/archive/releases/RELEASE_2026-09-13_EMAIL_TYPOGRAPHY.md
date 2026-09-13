# Email typography, 13 September 2026

Deployed and verified on staging and production. Runtime commit
`e6cfee77ee0517950107d0f01a76b7e0f900373f`.

The shared Support email shell now uses Poppins to match the website. Regular and
bold Latin/extended Latin WOFF2 files are self-hosted with their SIL Open Font
License. Text has inline Arial, Helvetica and sans-serif fallbacks; Word-based
Outlook receives an explicit Arial override. Colours, logo, spacing and copy are
preserved. The font URLs are public and static, with no recipient identifiers or
Google font requests. Font-only CORS headers allow loading from email documents.

`npm run preview:email` generates the local preview and the non-indexed public
sample from the actual delivery-check renderer. The hosted sample uses relative
font URLs so the same file works on either environment. No real recipient, job
identifier or credential appears in the preview.

- [Production preview](https://mywaveplan.com/email-preview/support.html)
- [Staging preview](https://staging.mywaveplan.com/email-preview/support.html)
- [Template and activation runbook](../../EMAIL_JOBS_RUNBOOK.md)

## Verification

- All 119 automated tests and the Node.js 22 production build passed. The only
  lint warning is the existing avatar image warning in `components/workspace/ui.js`.
- Staging deployment `dpl_DorV2VyN9WG5faoxdBtn9WhwozqD` and production deployment
  `dpl_Eix7hiuNPkiBoJesFd9sdQjX3xLR` are Ready from the same runtime commit, with
  the correct domains and `fra1` functions.
- Both hosted previews match the generated file. All four font downloads match
  the local binaries and return `font/woff2` with the intended cross-origin header.
  Preview responses contain `X-Robots-Tag: noindex, nofollow`.
- Browser previews were visually reviewed on staging and production. At a 390 px
  layout viewport, the page width is 390 px and all text/image bounds fit inside
  it. Browser screenshot scaling was inconsistent during viewport emulation;
  responsive dimensions were also checked directly. Production preview captured
  no console errors. Temporary test tabs were closed; the final preview is left
  open for the owner.
- Each environment passed seven app checks covering blank-field demo access,
  session isolation, 17 spots/16-day forecast, student permission boundaries,
  logout, invalid/cross-origin login denial and normal teststudent login. Only
  the check's temporary sessions were revoked.
- Health returns 200 and the internal email endpoint still returns
  `503 email_disabled` on both environments. No email was sent, and no worker,
  credential, account, database or forecasting change was made.

Actual received rendering in Apple Mail, Gmail and Outlook remains part of the
approved Mailjet activation checks before registration. Browser rendering is not
an inbox-delivery test. Website font loading and the Mac Mail signatures are
outside this change. Next roadmap task remains A4/B6 legal pages and acceptance
records.

Rollback: revert the typography runtime commit if required. No database rollback
is needed. Retain public font assets once real messages have been sent using them.
