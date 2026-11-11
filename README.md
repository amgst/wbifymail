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

This is a webmail prototype, not an IMAP/SMTP server. Attachments, drafts, search, pagination, password resets, rate limiting, audit trails, spam filtering, and retention policies remain future work. HTML emails are sanitized and displayed in an isolated iframe with scripts and forms blocked; remote images stay blocked until Load images is selected for that message. Do not use for sensitive production correspondence until authentication and webhook behavior are reviewed and tested. No real email is sent by the automated checks.

## Mobile and Web Push

The app uses a single-pane list/reader on screens up to 760px, with touch-friendly controls and a standalone web-app manifest. It refreshes the current folder every 30 seconds while visible.

Web Push is delivered from the incoming Resend webhook after a new message is stored. Enable receiving and DNS in Resend, ensure the email.received webhook reaches the deployed site, and create the Firestore message index first. Notifications do not fix inbound routing.

Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT in Vercel Production, then redeploy. A local key pair is generated in .env.local; copy it privately to Vercel. Keep keys stable between deployments. To generate a replacement pair manually, use the web-push library's generateVAPIDKeys(), then update both values together; existing devices need to disable and re-enable alerts after rotation.

Open the site over HTTPS, sign in, and tap Enable email alerts to grant permission. On iPhone/iPad (16.4+), first use Share > Add to Home Screen and open that installed app. Delivery depends on browser/OS notification permissions and connectivity. Generic alerts contain no sender, subject, or body. Each subscription belongs to the signed-in mailbox; sign-out removes that device subscription. Expired subscriptions are removed after the push provider returns 404/410. Notification sending is best effort and does not block email storage. No email content is cached by the service worker.

## HTML email

Incoming webhooks store both text and HTML. The viewer sanitizes HTML, isolates it in a sandbox, and blocks scripts and blocks remote images until explicitly enabled for the current message. Use View plain text for the text version. Opening a legacy incoming message without HTML attempts to recover it from Resend and save it to the owning mailbox; this depends on provider retention and the receiving API permission. Redeploy to Vercel to enable these changes online.

Image display: HTTPS/HTTP image URLs are retained in sanitized HTML. Load images enables external images for the selected message; Block images disables further loading. Opening older stored messages attempts to recover image URLs from Resend once, marked by body_html_version=2. Remote image loading may reveal that the message was opened. Embedded CID attachment images are not implemented.
