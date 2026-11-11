# WBIFY Mail ? Next.js + Firebase + Resend

Private webmail for wbify.com. Firestore stores mailboxes and messages. The Next.js server handles password login and mailbox authorization; Firebase Authentication is not used. Resend sends email and delivers inbound notifications.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`. Set Firebase Admin credentials, Resend keys, MAIL_DOMAIN, and independent random SESSION_SECRET and SETUP_SECRET values. Keep credentials server-side and out of Git.
3. Create a Firestore database in the wbifymail project. Publish `firestore.rules` and the index in `firestore.indexes.json`. With Firebase CLI authentication, run `firebase deploy --only firestore --project wbifymail`.
4. Run `npm run dev`.
5. For preview only, use LOCAL_AUTO_LOGIN=true. This mode returns an empty inbox and does not send real mail or create accounts. Production always disables this bypass.
6. For real use, set LOCAL_AUTO_LOGIN=false, restart, select First time? Set up admin, enter SETUP_SECRET from the local environment file, and choose a password of at least 12 characters. Then sign in as admin@wbify.com.

## Firebase data

Mailboxes are documents in `mailboxes`. Each mailbox has a `messages` subcollection. `mailboxEmails` reserves unique addresses; `settings/setup` prevents repeated initialization. First admin creation and address reservation use transactions. Provider IDs determine message document IDs so webhook retries do not duplicate messages.

Browser access to Firestore is denied. The Admin SDK uses server credentials and bypasses Firestore rules. API routes must enforce mailbox ownership and administrator roles. No PostgreSQL database or DATABASE_URL is required. `schema.sql` is a legacy reference only.

## Real email

Verify your sending domain in Resend and add the exact DNS records it provides. Configure receiving separately. Review existing MX records before changing them because changing MX can redirect domain mail away from an existing provider.

Deploy this app at a public URL such as https://mail.wbify.com. Register https://mail.wbify.com/api/webhooks/resend in Resend with only email.received selected, and save its signing secret as RESEND_WEBHOOK_SECRET. Local receiving requires a public tunnel.

Set the same server environment values on the host. The browser Firebase config alone cannot authorize the Admin SDK. Outbound email needs RESEND_API_KEY; incoming email also needs RESEND_WEBHOOK_SECRET and Resend receiving configuration.

## Limitations

This is a webmail prototype, not an IMAP/SMTP server. Attachments, drafts, search, pagination, password resets, rate limiting, audit trails, spam filtering, and retention policies remain future work. HTML-only emails show a placeholder. Do not use for sensitive production correspondence until authentication and webhook behavior are reviewed and tested. No real email is sent by the automated checks.
