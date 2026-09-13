# MyWavePlan email on Mac and iPhone

Updated 13 September 2026. Main account: **pawel@mywaveplan.com**. **support@mywaveplan.com** is an alias in the same mailbox, with no second licence or password. Zoho webmail sends and receives correctly at both addresses; separate Gmail round trips passed SPF, DKIM and DMARC checks.

## Credentials and servers

The owner signs into Zoho with Google. Apple Mail uses a **Zoho app password**, not the Google password. In [Zoho Accounts EU](https://accounts.zoho.eu/), open **Security → App Passwords → Generate New Password**. Complete Google verification if prompted. Use a separate app password for each device, named **Apple Mail - Mac** and **Apple Mail - iPhone**, so access can be revoked independently. The owner generates and enters these directly; do not send them in chat or save them in the repository.

These settings were read from this mailbox's Zoho settings, rather than copied from US-server examples:

| Setting | Value |
| --- | --- |
| Account type | IMAP |
| Email and username | `pawel@mywaveplan.com` |
| Incoming server | `imappro.zoho.eu` |
| Incoming port / encryption | `993` / SSL-TLS |
| Outgoing server | `smtppro.zoho.eu` |
| Outgoing port / encryption | `465` / SSL-TLS |
| Outgoing authentication | Password; same full username and device app password |
| Account description | `pawel@mywaveplan.com` |

IMAP is enabled in Zoho. Enter outgoing username/password even if the device labels them optional. Use the `.eu` servers. Keep credentials in the device's normal secure account storage.

## Apple Mail on Mac

1. In Mail, choose **Mail → Add Account**. Choose **Other Mail Account**. On newer macOS, choose the provider list, then **Add Other Account → Mail Account**.
2. Enter Paweł Papliński, `pawel@mywaveplan.com` and the Mac-specific Zoho app password.
3. If automatic discovery fails, choose IMAP and enter the incoming/outgoing servers above. Sign in and enable **Mail only; leave Notes disabled**.
4. In **Mail → Settings → Accounts**, set the description to `pawel@mywaveplan.com`. Check both servers and SSL ports under Server Settings; disable automatic connection settings only if needed to enter the verified values.
5. In **Account Information → Email Address → Edit Email Addresses**, keep Pawel and add **MyWavePlan Support / support@mywaveplan.com**. Both use the same IMAP account.
6. Under **Mailbox Behaviours**, use the corresponding server Drafts, Sent and Trash folders. The Support folder syncs through IMAP.

The signature follows the existing Growthmatics structure, using the MyWavePlan website wave mark. It contains the owner's name, Founder, MyWavePlan, email and website. **No phone number.** Sources: [personal signature HTML](assets/email/mywaveplan-signature.html), [Support signature HTML](assets/email/mywaveplan-support-signature.html), [logo PNG](assets/email/mywaveplan-logo.png). The logo is the existing website artwork, displayed at 42 px; the wordmark is text. Assign this signature only to the new MyWavePlan account and make it the default for that account. Preserve other accounts and signatures.

Installed and verified on 13 September: account `pawel@mywaveplan.com` is online, Mail is enabled and Notes is disabled. The owner generated and entered the Mac app password. Both sender identities are available. Both Mac sending tests reached Gmail with SPF, DKIM and DMARC passing. Both delivered signatures were visually checked in Gmail, including the 42 px logo. Gmail replies then arrived in the Mac’s MyWavePlan Inbox and Support folder respectively.

**Personal signature:** `MyWavePlan`, the account default. **Support signature:** `MyWavePlan Support`, with Support Team, MyWavePlan, support email and website. In the composer, choose `support@mywaveplan.com` in **From** and **MyWavePlan Support** in **Signature**. Apple Mail applies the default per account, so changing to an alias does not automatically choose its matching signature.

The installed HTML uses the existing public website PNG. A data-URI image looked correct locally but was removed from Gmail's rendered message, so it was replaced. External-image blocking in a recipient's client can still hide the logo; all contact details and the wordmark remain text. Keep the public icon URL stable. No application code or deployment was required.

## iPhone Mail

1. Generate a separate **Apple Mail - iPhone** app password in Zoho Accounts.
2. Open **Settings → Apps → Mail → Mail Accounts → Add Account**. On older iOS, start at **Settings → Mail → Accounts**.
3. Choose **Other → Add Mail Account**. On newer versions, enter the address first, then choose **Add Other Account → Mail Account**.
4. Enter your name, `pawel@mywaveplan.com`, the iPhone-specific Zoho app password and description `pawel@mywaveplan.com`.
5. Choose **IMAP** and enter both server names above. Use `pawel@mywaveplan.com` and the same iPhone app password in both incoming and outgoing sections. Save with **Mail enabled and Notes disabled**.
6. Check **Account Settings → Advanced**: incoming SSL on, port `993`. Under **SMTP → Primary Server**, use SSL, port `465` and Password authentication. Map Drafts/Sent/Deleted to the server folders if necessary.
7. To send as Support, open **Account Settings → Email → Add Another Email Address**, enter `support@mywaveplan.com`, press Return and save. This applies to a manually configured IMAP account. Choose the address in the **From** field when composing or replying; check it before sending a Support reply.
8. Send a test to your own Gmail address and reply. Check both Inbox and Support. Apple Mail may fetch periodically; the Zoho Mail iPhone app is an alternative if you prefer Zoho's own sign-in and notifications.

iPhone signature settings are separate from the Mac: **Settings → Apps → Mail → Signature → Per Account**. Assign a MyWavePlan-only signature; leave existing account signatures unchanged. A reliable plain-text version is:

```text
Dr Paweł Papliński
Founder, MyWavePlan
E: pawel@mywaveplan.com
W: mywaveplan.com
```

For Support, use `Support Team`, `MyWavePlan`, `E: support@mywaveplan.com` and `W: mywaveplan.com`. iPhone signatures are per account, not per alias; check the signature when sending as Support. You can copy a formatted signature from the verified test email, but image persistence depends on the client.

No physical iPhone setup has been performed or tested by the agent.

## References

- [Zoho application-specific passwords](https://www.zoho.com/mail/help/adminconsole/two-factor-authentication.html)
- [Zoho IMAP in Apple Mail](https://www.zoho.com/mail/help/apple-mac-imap.html)
- [Apple: add an account on iPhone](https://support.apple.com/en-gb/102619)
- [Apple: email aliases on Mac](https://support.apple.com/en-gb/guide/mail/mlhlp1205/mac)
- [Mailbox provider guide: IMAP aliases on iOS 18–26](https://kb.mailbox.org/en/business/e-mail/tip-how-can-i-setup-an-alias-for-ios/)
