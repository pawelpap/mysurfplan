# Business mailbox setup

Updated 12 September 2026. **home.pl entry removed; new email setup paused at the owner's request.**

The unused `mywaveplan.com` external-domain entry was removed from home.pl after explicit confirmation at its final deletion step. It had no attached hosting service or mailbox. The panel now lists only `growthmatics.com`; its four existing mailboxes and Pawel's FTP scope remain unchanged. Domain registration stays at GoDaddy, authoritative DNS and the app stay at Vercel, and Mailjet remains the automated sending service. Both application login URLs returned HTTP 200 after removal; public nameservers and the single Mailjet SPF record are unchanged. There is still no root MX record or working MyWavePlan receiving inbox.

The provider's replies were read in the owner's existing Proton session. home.pl requires its own nameservers for this mail hosting, with a supported exception for Cloudflare. It also advises creating replacement domain-specific mailboxes and migrating messages instead of narrowing the existing all-domain accounts in place. This does not fit the chosen Vercel DNS arrangement. Full private panel/support notes remain in `private/MAILBOX_SETUP.md`, excluded from Git.

## Proposed Proton options

No subscription upgrade, purchase, new account, address, MX/SPF/DKIM change or migration was performed. Prices below were checked on Proton's public EUR pricing pages in Chrome on 12 September 2026. Business prices may have additional tax.

| Plan | Inbox structure | Domains | Current price |
| --- | --- | --- | --- |
| Mail Plus | One user/inbox, 15 GB; both Pawel and Support addresses would share it | 1 custom domain | €4.99 monthly, or €47.88/year (€3.99/month equivalent) |
| Mail Essentials, two users | Two independent logins/inboxes, 15 GB each, 10 addresses per user | 3 custom domains per organisation | €15.98 total monthly, or €167.76/year (€13.98/month equivalent) |
| Workspace Standard, two users | Two users, 1 TB each plus wider workspace tools | 15 custom domains | €29.98 total monthly, or €311.76/year (€25.98/month equivalent) |

**Recommendation:** Mail Essentials with two users if the original requirement for separate `pawel@mywaveplan.com` and `support@mywaveplan.com` inboxes remains. Mail Plus is suitable only if the owner explicitly accepts two addresses sharing one login/inbox. The later request to consider Mail Plus does not establish that it supports two inboxes. Do not configure shared credentials or substitute aliases silently.

Mail Essentials already has domain capacity for MyWavePlan and Growthmatics. Later add licences for additional independent inboxes rather than upgrading solely to add the second domain. Preserve independence of Pawel's Growthmatics and MyWavePlan accounts if still required. Adding the two addresses to one user would combine their inboxes.

On iPhone, plan to use Proton's app or webmail. Proton Bridge supports desktop mail clients on macOS, Windows and Linux, not mobile Apple Mail. Check this preference before committing to the provider. Proton is Swiss-based; do not describe all business email as EU-only. Review its DPA and product-specific processing locations before publishing legal text.

Alternatives: Fastmail Standard for conventional third-party email-client support and multi-domain/team administration; Zoho Mail Lite for a smaller mail-only plan with an EU account option; Microsoft Exchange Online Plan 1 for an Outlook-based business mailbox service. Compare actual regional checkout and user requirements before any purchase.

## Resume only on the owner's request

1. Confirm independent users versus shared-inbox addresses, monitoring responsibility and final provider/plan; the owner approves any purchase.
2. Set up the approved inboxes and then provider-supplied mail DNS records in Vercel. Preserve website records and Mailjet authentication. Merge authorised SPF senders into one record and configure DKIM/DMARC.
3. Test inbound mail and replies for both addresses. Do not advertise `support@mywaveplan.com` as a working privacy/support contact before this passes.
4. Continue A6/A7 Mailjet credentials, staging isolation, delivery and scheduler checks before B3 registration/B6 policy publication.
5. Separately assess Growthmatics website and email migration before the owner-reported January renewal. A WordPress website requires an architecture/content migration assessment before moving to Vercel; an existing Pro subscription alone does not make it a drop-in migration. Keep home.pl live until website, mail, redirects, forms and remaining services are independently verified.

Sources: [Proton personal plans](https://proton.me/mail/pricing), [business plans](https://proton.me/business/mail/pricing), [addresses versus inboxes](https://proton.me/support/addresses-and-aliases), [client and mobile support](https://proton.me/support/imap-smtp-and-pop3-setup), [Proton DPA](https://proton.me/legal/dpa), [Fastmail](https://www.fastmail.com/pricing/), [Zoho Mail](https://www.zoho.com/mail/zohomail-pricing.html), [Exchange Online](https://www.microsoft.com/pt-pt/microsoft-365/exchange/exchange-online-business-plans-and-pricing), [WordPress and Vercel](https://vercel.com/kb/guide/wordpress-with-vercel).
