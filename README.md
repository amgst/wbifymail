# WBIFY Mail — Next.js + Resend + Neon

Private webmail prototype for `wbify.com`, with per-user logins, inbox, sent mail, deletion to trash, replies, admin mailbox creation, outbound sending through Resend, and inbound via verified Resend webhooks.

## Deploy to Vercel

1. Create a **Neon PostgreSQL** database. Run `schema.sql` in its SQL editor.
2. Create a **Resend** account and verify `wbify.com` as a sending domain. Enable receiving for the domain, and add the exact DNS records Resend provides at **GoDaddy**. **Review existing MX records first**: replacing them diverts all incoming email for the domain.
3. In Resend create a webhook listening to `email.received` at `https://mail.wbify.com/api/webhooks/resend`. Copy the webhook signing secret.
4. Import this repository into Vercel, add the `.env.example` keys in Project Settings → Environment Variables, using your actual secrets. Never use the example values. Generate SESSION_SECRET and SETUP_SECRET independently with cryptographically secure random bytes.
5. Set `MAIL_DOMAIN=wbify.com`; point `mail.wbify.com` to Vercel using the DNS record Vercel provides (this is the **web app** hostname, not an SMTP server).
6. After the first deploy, visit `https://mail.wbify.com`, choose **First time? Set up admin** and enter `SETUP_SECRET` and a strong new password. Admin `admin@wbify.com` is created in the database. Then log in.
7. Send an email to a test Gmail mailbox, and reply from Gmail. Check Resend webhook delivery logs and the WBIFY Inbox.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Use a **separate test domain/subdomain** for local trials if the production domain already receives email elsewhere.

## Current scope and known limitations

- Resend is the transport, **not** an IMAP/SMTP mailbox server. Accounts exist in this app's database. Normal mail clients such as Outlook or Apple Mail won't connect via IMAP in this MVP.
- Initial setup uses `SETUP_SECRET`; treat it as an administrator secret. Only the very first account can be initialized through `/api/setup`.
- Mailbox creation doesn't create an account at Resend. Domain-level inbound routing is delivered to the app; recipient lookup assigns email to existing app mailbox accounts. Exact Resend inbound custom-domain configuration is required.
- Text-only message reader; HTML-only emails display a placeholder. Attachments, drafts, search, pagination, delivery status tracking, password reset, and mailbox disable/delete are future features.
- Incoming webhook verifies signature and handles duplicate delivery idempotently. Received emails are fetched by ID from Resend and stored in Neon. Resend's own retention policy is separate.
- No external email delivery was tested during generation. Domain records, database, production secrets and webhook must be set before using real email.
- Production hardening recommended: login rate-limiting/WAF, audit trails, mailbox quotas, provider-error monitoring, retention/backups, more robust RFC email address parsing, spam filtering and malware/attachment handling.
- Do not use for sensitive production correspondence until authentication, abuse controls, storage policy and webhook correctness have been tested.

## Data model

`mailboxes` — domain email, password hash, role, status.
`messages` — per-mailbox sent/received text messages, read status, trash state, provider ID for webhook deduplication.

No email bodies are rendered as unsafe HTML. API key, webhook secret, database credentials and session secret remain server-side.
