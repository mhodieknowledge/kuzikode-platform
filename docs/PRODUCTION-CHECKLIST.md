# Production checklist

Everything to do, in order, before Kuzikode production takes real clients and real money. Owner steps are marked
**(you)**; links go to the detailed guide. Tick items here as you go.

## A. Accounts and plan
- [ ] **(you)** Cloudflare: fix the Workers daily request limit problem (BLOCKERS, Error 1027): stop the other Worker
      using the free 100 000 requests/day, or upgrade to **Workers Paid ($5/month)**, which is also recommended for payments.
- [ ] **(you)** GitHub → Settings → Environments → `production` → Required reviewers: you. Deployment branches: `main`.
- [ ] **(you)** GitHub secrets (Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
      (present), `BACKUP_ENCRYPTION_PASSPHRASE` (present; keep a copy in your password manager), `TURNSTILE_SECRET_KEY`,
      `RESEND_API_KEY`, and once live keys exist `PAYNOW_USD_INTEGRATION_ID` / `PAYNOW_USD_INTEGRATION_KEY`.

## B. Domain and email ([EMAIL-SETUP.md](EMAIL-SETUP.md), [09-DEPLOYMENT.md](09-DEPLOYMENT.md) §8)
- [ ] **(you)** Register the domain, add it to Cloudflare.
- [ ] Uncomment the `routes` (apex + `www`, `custom_domain: true`) in `wrangler.jsonc` → `env.production`, set
      `PUBLIC_SITE_URL` to `https://kuzikode.com`, `EMAIL_FROM` to your domain address. (Ask the build agent, or edit and
      push to `main`.)
- [ ] **(you)** Resend domain verified (SPF, DKIM, DMARC), delivery webhook + `RESEND_WEBHOOK_SECRET`.
- [ ] **(you)** Turnstile → your widget → Hostnames: add `kuzikode.com`, `www.kuzikode.com` (and the workers.dev hostnames).
- [ ] **(you)** Email Routing (or mailboxes) for `hello@` / `billing@`.

## C. Legal and business details
- [ ] **(you)** Legal review of the Privacy Policy, Terms and Cookie notice (Admin → Pages).
- [ ] **(you)** Company registration status and numbers in Admin → Settings → General (shown only once entered).
- [ ] **(you)** VAT: confirm registration and rate before adding a tax rate (Settings → Billing & taxes).
- [ ] **(you)** Bank details for transfers, payment terms, reminder schedule, document logo.

## D. Payments ([PAYMENTS-ONBOARDING.md](PAYMENTS-ONBOARDING.md))
- [ ] **(you)** Faked Success test on staging (BLOCKERS P6.5).
- [ ] **(you)** Paynow "Request to be Set Live"; live keys into GitHub secrets.
- [ ] After the first production deploy: Paynow USD → Mode Live; one small real EcoCash and card payment, refunded.
- [ ] Optional: ZWG integration; PesePay keys; Paynow tokenization for saved cards.

## E. Deploy
- [ ] Actions → **Deploy production** → `deploy production` → approve. It backs up, migrates, seeds, deploys and runs the
      production smoke test (HSTS, real Turnstile key, indexable robots.txt).
- [ ] Actions → **Bootstrap first admin** → `production` → your email. Set your password and two-step sign-in.
- [ ] Walk the post-deploy checklist ([RUNBOOK.md](RUNBOOK.md) §7).
- [ ] Settings filled in (section C); real portfolio entries and approved testimonials only.
- [ ] Invite staff (Admin → Users) with the narrowest role that fits.

## F. Operations
- [ ] Nightly **Backup** workflow green for production (Actions → Backup); first production restore drill once real data
      exists ([RUNBOOK.md](RUNBOOK.md) §4), then monthly.
- [ ] Cloudflare → Notifications: alerts for Worker errors and the Workers usage limit, to your email.
- [ ] Download a monthly copy of a backup off Cloudflare (docs/09 §7).
- [ ] Rotate any key that was ever pasted somewhere unsafe ([RUNBOOK.md](RUNBOOK.md) §5).
