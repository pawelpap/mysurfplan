# Business mailbox setup

Updated 13 September 2026. **Mail Lite is active. External delivery and replies are verified for Pawel and Support.** Apple Mail is configured with Mail only, Notes disabled, and separate personal/Support signatures without phone numbers.

## Current decision

- Receiving provider: **Zoho Mail EU**, existing owner account, organisation name **MyWavePlan**.
- Main mailbox: **`pawel@mywaveplan.com`**, display name Paweł Papliński.
- Alias in that same mailbox: **`support@mywaveplan.com`**, display name MyWavePlan Support. It is not a second user or independent inbox. The owner explicitly selected this arrangement.
- Paid plan: **Mail Lite, 5 GB, one user, annual billing**. The owner completed payment. Zoho Store confirms successful subscription and the next renewal on **13 September 2027**. The selected annual subtotal was **€10.80 before applicable tax**; do not treat this as the final tax-inclusive invoice total.
- **Mailjet remains the chosen transactional app-email provider.** The owner preferred its initial free allowance and future marketing capability after considering ZeptoMail. ZeptoMail was not enabled or configured.
- GoDaddy retains domain registration. Vercel retains authoritative DNS and both websites. Growthmatics mail and hosting are unchanged.

## Completed in this session

1. The reopened Zoho flow was waiting for ownership verification. Public DNS contained the existing Mailjet SPF but no Zoho verification record.
2. Added the exact verification TXT requested by Zoho, then successfully verified domain ownership.
3. Created the main domain address on the existing owner account and added Support as an alias, preserving Pawel as the mailbox address. The console lists one user.
4. Published Zoho's three EU MX records and the generated DKIM public key. Updated the existing SPF record atomically to include both Zoho and Mailjet, with a soft-fail policy. No duplicate SPF record was added.
5. Completed the setup wizard without importing unrelated mailboxes. The admin dashboard confirms **MX 1/1, SPF 1/1 and DKIM 1/1**. Initial DKIM verification was pending propagation; the subsequent dashboard confirms it.
6. Independently checked authoritative DNS and public resolver propagation. Both `https://mywaveplan.com/login` and `https://staging.mywaveplan.com/login` returned HTTP 200 after the DNS changes.
7. Opened the Mail Lite 5 GB checkout with one user. Stopped for owner payment, as explicitly requested.
8. After owner payment, verified the Mail Lite activation and renewal date. Enabled IMAP for Apple Mail; POP remains disabled. Primary/default From is Pawel and Support is available as an alias.
9. Created the **Support** folder and an incoming rule: **Delivered To is `support@mywaveplan.com` → move to Support**, before the built-in smart filters. Notifications are enabled for the folder.
10. Published initial DMARC monitoring and checked public DNS. No restrictive DMARC policy is enabled yet; tighten it after Mailjet application delivery has been verified in A6/A7.
11. With explicit owner permission, sent separate tests from the owner's Gmail account to Pawel and Support. Both arrived in Zoho; Support routed to its folder. Replies from each address arrived in Gmail's Inbox. Gmail's authentication headers reported **SPF pass, DKIM pass (`zmail`) and DMARC pass** for both replies. Zoho automatically chose Support when replying to the Support test. No Proton message was sent; the unsent Proton draft was discarded. Proton has no operational role in MyWavePlan email.

## DNS configuration

| Type | Host | Value / purpose |
| --- | --- | --- |
| TXT | `@` | `zoho-verification=zb39864457.zmverify.zoho.eu` |
| MX | `@` | `mx.zoho.eu`, priority 10 |
| MX | `@` | `mx2.zoho.eu`, priority 20 |
| MX | `@` | `mx3.zoho.eu`, priority 50 |
| TXT | `@` | `v=spf1 include:zohomail.eu include:spf.mailjet.com ~all` |
| TXT | `zmail._domainkey` | Zoho-generated DKIM public key, published and verified |
| TXT | `mailjet._domainkey` | Existing Mailjet DKIM key retained |
| TXT | `mailjet._56a7c46b` | Existing Mailjet verification retained |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:pawel@mywaveplan.com` |

Nameservers remain `ns1.vercel-dns.com` and `ns2.vercel-dns.com`. Existing website ALIAS and CAA records are unchanged. DMARC is in monitoring mode and requests aggregate reports to Pawel; it does not request rejection of unauthenticated mail. Do not replace the combined SPF with Zoho's single-provider example shown in its wizard.

## Clients, security and remaining work

The account uses the owner's existing Google sign-in. Zoho Accounts confirms the EU data centre and no separate Zoho account password. The owner completed Google re-verification for the client setup. Apple Mail needs a Zoho application-specific password, not the Google password. Credential generation/entry is handed to the owner; never put the credential in project files or chat. Existing recovery addresses and authentication factors are unchanged. A broader MFA/recovery review remains in operational readiness.

The owner requested an Apple Mail account named `pawel@mywaveplan.com`, a website-matching signature without a phone number, and iPhone instructions. [Mail client setup](MAIL_CLIENT_SETUP.md) records the verified servers and the signature assets. The owner generated and entered the Mac app password. Apple Mail is online, named `pawel@mywaveplan.com`, with Mail enabled and Notes disabled. Both sender identities and both signatures are installed. Personal is the default; choose the Support sender and Support signature together in the composer. Both Mac test messages reached Gmail with SPF/DKIM/DMARC passing. Both final signatures use the public website logo and were visually verified in Gmail. Gmail replies arrived in the Mac’s Inbox and Support folder respectively. iPhone instructions are provided; no physical iPhone has been configured or tested.

Next development task: **A4/B6 legal pages and acceptance records**. Review the actual operator/provider/retention details, then implement versioned privacy/terms pages, terms acceptance and separate optional preferences before public signup. A9 localisation foundations precede B3 registration. Finish the deferred Mailjet delivery tests and Vercel Pro scheduler before activating registration. **C5 cookie consent precedes C6 GTM/GA4 tracking**; optional tracking stays off until both are verified. Search Console/basic SEO do not require analytics consent. The A6 email/job foundation is deployed disabled. Confirm credentials, staging sender/isolation, delivered Mailjet messages and quotas before enabling it or tightening DMARC. See [runbook](EMAIL_JOBS_RUNBOOK.md).

## Previous provider decision and future Growthmatics migration

The unused `mywaveplan.com` external-domain entry was removed from home.pl on 12 September after explicit confirmation. It had no attached hosting or mailbox. The panel retained only `growthmatics.com` and its four existing mailboxes; no Growthmatics mailbox, password, FTP access or website was changed. home.pl required its own nameservers (with a supported Cloudflare exception) and proposed new mailboxes plus migration to narrow the existing all-domain accounts. Full private correspondence notes remain in ignored `private/MAILBOX_SETUP.md`.

The earlier Proton alternatives are preserved in [the 12 September options archive](archive/decisions/MAILBOX_OPTIONS_2026-09-12.md). Zoho now supersedes that proposal. Paid Zoho Mail supports multiple domains, so adding Growthmatics later does not itself require a higher tier. Independent mailboxes require additional licences. Preserve the requested separation between Pawel's MyWavePlan and Growthmatics mailboxes during that future migration.

Before the owner-reported January home.pl renewal, separately assess Growthmatics website and mail migration. Keep its current service until website, mail, redirects, forms and remaining dependencies pass verification. No Growthmatics migration is authorised by this MyWavePlan mailbox setup.

## Sources

- [Zoho Mail pricing](https://www.zoho.com/mail/zohomail-pricing.html)
- [Zoho email hosting setup](https://www.zoho.com/mail/help/adminconsole/email-hosting-setup.html)
- [Aliases and user settings](https://www.zoho.com/mail/help/adminconsole/user-settings.html)
- [Combined SPF configuration](https://www.zoho.com/mail/help/adminconsole/spf-configuration.html)
- [Mailjet plans](https://www.mailjet.com/pricing/)
- [ZeptoMail integration, assessed but not selected](https://www.zoho.com/mail/help/adminconsole/transactional-email-integration.html)
