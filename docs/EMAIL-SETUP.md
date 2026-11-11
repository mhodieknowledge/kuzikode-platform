# Email set-up (Resend + your domain)

Kuzikode sends transactional email (invitations, password resets, quotations, invoices, receipts, reminders, enquiry
notifications) through **Resend**. Every email is queued in the outbox and sent by the background queue, so a Resend outage
only delays mail; nothing is sent twice.

## Today (no domain yet)

- Sender: `Kuzikode <onboarding@resend.dev>` (Resend's shared test sender, `EMAIL_FROM` in `wrangler.jsonc`).
- Resend delivers mail from that sender **only to the email address of your Resend account**. Staff invitations, client
  emails and the bootstrap email reach other people only once your domain is verified. This is why staging is fine for
  your own testing but production needs the domain before you invite anyone.
- The key: Worker secret `RESEND_API_KEY` (staging is set; production takes it from the GitHub secret on deploy).

## With kuzikode.com (or your chosen domain)

1. **Domain on Cloudflare** (docs/09 §8): add the zone, change the nameservers at your registrar.
2. **Resend → Domains → Add domain** → `kuzikode.com` (or a sending subdomain such as `mail.kuzikode.com`; it keeps the
   main domain's reputation separate). Region: the default is fine.
3. Resend shows DNS records. In Cloudflare → DNS → Records add each one exactly, with the proxy **off** (grey cloud):
   - the **MX** and **TXT (SPF)** records on the `send` subdomain (bounce handling),
   - the **TXT (DKIM)** record `resend._domainkey`,
   - add a DMARC record yourself: TXT `_dmarc` = `v=DMARC1; p=none; rua=mailto:you@kuzikode.com` (start with `p=none`,
     move to `p=quarantine` after a few weeks of clean reports).
4. Resend → **Verify DNS records**. Usually minutes; can take up to a few hours.
5. Change the sender in `wrangler.jsonc` (both `env.staging` and `env.production` `vars`):
   `"EMAIL_FROM": "Kuzikode <hello@kuzikode.com>"`, and optionally `"EMAIL_REPLY_TO": "hello@kuzikode.com"`; also set
   `ADMIN_ALERT_EMAIL` to where system alerts should go. Commit to `main` (staging redeploys), then run Deploy production.
6. Admin → Settings → Integrations → **Send a test email to me**, and check it arrives with "via resend.dev" gone and
   SPF/DKIM "pass" (Gmail: ⋮ → Show original).

## Delivery status webhook

So the email log knows whether mail was delivered, bounced or marked as spam:

1. Resend → **Webhooks → Add endpoint** → URL `https://<site>/api/webhooks/resend` (staging:
   `https://kuzikode-staging.mhodieknowledge.workers.dev/api/webhooks/resend`).
2. Events: `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed`.
3. Copy the endpoint's **signing secret** (`whsec_…`) and set it as `RESEND_WEBHOOK_SECRET`: staging
   `npx wrangler secret put RESEND_WEBHOOK_SECRET --env staging`; production as a GitHub secret, then Deploy production.
   Use a separate endpoint (and secret) per environment.

Without the secret the endpoint answers 404 and emails simply stay "sent". Bounced and complained addresses are not mailed
again automatically.

## Receiving email (hello@, billing@)

Resend only sends. To receive mail at your domain for free, use **Cloudflare Email Routing** (Cloudflare → your domain →
Email → Email Routing → enable → add `hello@kuzikode.com` → forward to your personal inbox). For full mailboxes use a paid
provider (Google Workspace, Zoho Mail); their MX records then replace Email Routing's.

## Limits (Resend free plan)

100 emails per day, 3 000 per month, one domain. Invoice runs and reminders count. Upgrade in Resend when you get near it;
nothing in Kuzikode changes.
