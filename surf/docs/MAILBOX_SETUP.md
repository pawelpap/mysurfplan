# Business mailbox setup

Updated 12 September 2026. Mailboxes remain pending. Full panel findings and owner-sent Polish support requests are saved locally in `surf/docs/private/MAILBOX_SETUP.md`, excluded from the public repository.

The intended separate inboxes are `pawel@mywaveplan.com` and `support@mywaveplan.com` on the existing home.pl Hosting Business service. Preserve all existing Growthmatics mailboxes and their contents. Domain registration stays at GoDaddy; authoritative DNS and both app environments stay at Vercel. Mailjet is the separate automated sending service.

The domain was added to the home.pl panel, but attachment to hosting was refused because it expects home.pl nameservers. Neither new inbox was created. The owner reports sending both support requests; await external-DNS and mailbox-isolation guidance before changing configuration. No nameserver change is authorised.

Next, during A6/A7 email readiness: confirm supported external DNS, obtain exact provider MX/SPF/DKIM records, configure separate mailboxes, merge authorised SPF senders into one record, check DMARC, and verify inbound mail and replies. Keep existing Mailjet authentication records. If home.pl cannot support this arrangement, obtain the owner's choice of another mailbox provider. The support/privacy inbox must work before B3 registration or B6 policy publication.

A8 moved application data/functions to Frankfurt. It changed no mail or DNS settings. See [email architecture](AUTH_EMAIL_AND_JOBS_DECISION.md) and [environment guide](ENVIRONMENTS.md).
