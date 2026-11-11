# Blockers & Owner Actions

Things only the owner can do. The agent keeps building around them and records each one here with
**exact** steps. Mark `[x]` when resolved.

## Known from planning (owner, do these whenever you can)
- [x] **Cloudflare API token + account ID.** *(present in the build environment, checked 2026-11-05)* Create a token (My Profile → API Tokens → Custom) with: Workers Scripts Edit,
  D1 Edit, Workers R2 Storage Edit, Workers KV Storage Edit, Queues Edit, Workers AI Read+Edit, Account Settings Read (+ Zone DNS Edit / Workers Routes Edit
  once the domain is added). Add as `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in **both** GitHub repo secrets and the
  Claude Code cloud environment's environment variables.
- [x] **Enable R2** *(present in the build environment, checked 2026-11-05)* on the Cloudflare account (Dashboard → R2 → requires a payment method on file; free tier is $0).
- [x] **Paynow test integration:** *(present in the build environment, checked 2026-11-05)* register at https://www.paynow.co.zw/Customer/Register → add bank account → Other Ways To Get Paid → Create/Manage Shopping Carts → Create Advanced Integration (USD), leave Notification URL blank, then "Email Key To Company Address".
  Copy the Integration ID + Key into the Claude Code environment as `PAYNOW_USD_INTEGRATION_ID` / `PAYNOW_USD_INTEGRATION_KEY`, and set
  `PAYNOW_TEST_AUTHEMAIL` to your Paynow merchant login email (test-mode payments only work for that account). Enable EcoCash/OneMoney/InnBucks on the integration.
- [ ] **Paynow go-live:** after the agent's test transactions pass, click "Request to be Set Live" in Paynow (merchant KYC is yours to complete).
  If ZWG payments are wanted, create a second integration for ZWG (`PAYNOW_ZWG_*`).
- [ ] *Optional:* PesePay keys (`PESEPAY_MAIN_INTEGRATION_KEY` / `PESEPAY_MAIN_ENCRYPTION_KEY`) only if you want the alternative adapter live-tested.
- [x] **Resend account + API key** *(present in the build environment, checked 2026-11-05)* (`RESEND_API_KEY`). Free plan. Until a domain is verified, mail only goes to the Resend account owner's address.
- [ ] **Domain kuzikode.com:** register it, add to Cloudflare, then follow docs/09 §8 (custom domain, Resend DNS, Email Routing, Turnstile hostname).
- [x] **Turnstile widget:** *(present in the build environment, checked 2026-11-05)* Cloudflare Dashboard → Turnstile → add site (workers.dev hostnames now, kuzikode.com later). Give the site key (var) and secret key (`TURNSTILE_SECRET_KEY`).
- [ ] **Legal review** of Privacy Policy / Terms / Cookie notice, and company registration status (shown only when you enter it in Settings).
- [ ] **Tax:** confirm VAT registration and the current rate before enabling the tax rate in Settings.
- [ ] **Workers Paid plan ($5/month)** recommended before taking real payments in production (removes the 10 ms CPU cap).
- [ ] **GitHub `production` environment** with you as required reviewer (Settings → Environments), so production deploys need your click.
- [ ] **First admin account (staging is deployed, 2026-11-11):** GitHub → this repo → **Actions** → **Bootstrap first admin** → **Run
  workflow** → environment `staging`, your email and name → Run. Within about 10 minutes the staging site emails you a one-time
  "Set your password" link (valid 24 hours); open it, choose a password, then sign in at
  https://kuzikode-staging.mhodieknowledge.workers.dev/admin/login and set up two-step sign-in. Use the email address of your Resend
  account: until a domain is verified in Resend, Resend only delivers to that address. The link is never printed in the workflow log.
  (Alternative with a terminal: `npm run bootstrap:admin -- --env staging --email you@example.com --name "Your Name"` prints the link.)
  Do the same with `production` once production is deployed (P8.3).

- [x] **pen.dev (optional, for mockups):** *(present in the build environment, checked 2026-11-05)* pen.dev → organization settings → Developer Keys → create key. Add `PEN_CLI_KEY`
  and `PEN_CLAUDE_OAUTH_TOKEN` (run `claude setup-token` on your PC; it uses your Claude Pro plan, no API credit) to the Claude Code cloud
  environment's variables. Note: pen.dev runs then share your Pro usage limits with the build agent.
- [ ] **Figma (optional):** your seat is View on the Starter plan (20 MCP calls/month, edit rights uncertain). If the agent's probe fails
  and you want a Figma design file, upgrade to a Full/Dev seat. The build doesn't need it.

- [ ] **Confirm package prices** (docs/12 §A.2). They're suggestions for the Zimbabwe market. Production hides prices until you review them
  in Admin → Packages, clear the "price review" flags, and turn on Settings → Pricing → "Show prices".
- [ ] **Decide the email product:** Zoho Mail Lite (~$1/user/month, the default cost basis) or Google Workspace (~$7/user/month), and open a reseller/partner
  or admin account with that provider so you can actually deliver "10 business email accounts".
- [x] **Workers AI permission:** *(present in the build environment, checked 2026-11-05)* add *Workers AI: Read + Edit* to the Cloudflare API token so the agent can generate the ~20 site images during development (free).
- [x] **Optional higher-quality images:** *(present in the build environment, checked 2026-11-05)* add `OPENAI_API_KEY` or `GEMINI_API_KEY` to the Claude Code environment (pay-per-image).
- [ ] **Real team photos** (optional): if you want a team section, upload real photos. AI faces are never used for staff.
- [ ] **Booking (optional):** create a free Cal.com account and put the booking link in Settings.
- [ ] **WhatsApp business number** for the chat button (Settings → Contact).
- [ ] **Invoice payment details** (added 2026-11-06): in Admin → Settings → Billing → Documents, enter your **bank transfer details** (bank, account name, account number, branch) and a short footer line. They print on every invoice PDF from then on; invoices already issued keep the details they were issued with.

- [ ] **Note on the Cloudflare connector:** it's connected, but the agent still needs the **API token** above. GitHub Actions deploys and
  `wrangler` (Workers, Queues, secrets, migrations, domains) can't use the connector. You **don't** need to create any Workers, databases or
  buckets yourself: the agent creates them all (names prefixed `kuzikode-`) and leaves your existing `zimindex` resources alone.

- [ ] **Paynow card tokenization:** email Paynow support and ask them to **enable tokenization (`tokenize`) for your integration** so
  customers' cards can be saved and charged on Kuzikode's own checkout. While you're at it, ask: *"Do you offer embeddable card fields or a
  direct card API for merchants?"* (if yes, the agent can remove the one-time card window entirely). Until approved, cards still work through the
  one-time secure window.

- [x] **Site images (best free option):** *(done 2026-11-06: the owner's 20 Gemini images were imported from R2 and placed)* follow `design/images/PROMPT-PACK.md`: generate the 20 images in the free Gemini app
  (gemini.google.com), name them as listed, and upload them to `design/images/inbox/` on GitHub. The agent does the rest.

## Raised by the agent
- [ ] **Legal review of the website drafts (P3.9):** `/legal/privacy`, `/legal/terms`, `/legal/service-terms`, `/legal/cookies`,
  `/legal/accessibility` are honest drafts marked "awaiting legal review". Have a Zimbabwean lawyer review them (data protection under the
  Cyber and Data Protection Act [Chapter 12:07], retention periods, liability limits), then edit them in Admin → Website → Legal pages
  and remove the "draft" line. Enquiry retention (24 months) and application retention (12 months) are defaults you can change.
- [x] **Site imagery (P3.18), raised 2026-11-06:** *(resolved 2026-11-06 by the owner's images)* every generator is out of budget. The Workers AI free 10,000 neurons/day was already spent
  at 12:00 UTC (the allowance is shared with your other Workers), and the OpenAI key returns "no credits remaining". **Easiest (free):**
  the "Site images" entry above (Gemini app + `design/images/inbox/`). Alternatives: a few dollars of OpenAI API credit, or Workers Paid ($5/month). The pipeline is ready: `npm run img:gen -- --id <slot> --provider openai`. The site
  already looks finished without these images (sections without a photo render their text-only layout).
- [ ] **Optional: delete the R2 `images` bucket (2026-11-06).** The 20 Gemini originals in the R2 bucket `images` have been processed into
  `public/images/site/` (committed, 12 MB). The agent only read the bucket. Once you have checked the site, you can delete the bucket in the
  Cloudflare dashboard (R2 → images → Settings → Delete). No defects found; nothing needs regenerating. Every docs/13 §4 slot is filled
  (the "Approach" developer photo is used on /how-we-work).
- [ ] **Optional: payment method logos for the checkout (2026-11-11).** Our checkout (`/pay/…`) shows each method (EcoCash, OneMoney,
  InnBucks, O'mari, Visa/Mastercard/Zimswitch) with a neutral icon. docs/06 §3b asks for the official logos, which may only be used under
  each brand's artwork guidelines. If you want them: download the logo packs (Paynow merchant dashboard → marketing/artwork, or each
  brand's media page), put the SVG/PNG files in `design/images/inbox/payment-logos/` and the next build session will add them. Nothing
  is blocked without them.
- [ ] **Paynow card tokenization approval, for saved cards and automatic card charges (2026-11-11).** Saved cards are built and
  tested (P6.3e), but Paynow must approve tokenization for the merchant account first. Live check from this build in test mode with
  Paynow's official test tokens: Paynow answered "You are not permitted to tokenize payment instruments" (card entry with
  `tokenize=true`), "The specified ID does not have any ACTIVE 'vmc' payment method" and "The use of tokenized transactions is not
  permitted for your merchant" (saved-card payments). Cards still work today through the secure card window, just without saving.
  Owner action: email Paynow support and ask them to (1) enable tokenization ("tokenize payment instruments") and (2) activate the
  `vmc` and `zimswitch` express methods for the USD integration (and the ZWG one if you add it). When Paynow confirms: sign in as
  Super Admin → Admin → Payments → Gateways → edit the Paynow account → switch on **Saved cards (card tokenization)** → Save. Then
  ask the next build session to re-run the live token check (scratch script in PROGRESS.md P6.3e).
- [ ] **Paynow "Faked Success" test payment through the Paynow page (2026-11-11, P6.5).** The automated live suite already passed
  against your Paynow test integration (EcoCash success, cancel and insufficient balance, and a card/redirect payment created on
  Paynow's page). Paynow only lets the **merchant account that owns the integration** fake-pay a redirect payment, which needs your
  Paynow login, so this one step is yours (Paynow requires at least one successful test before "Request to be Set Live").
  Once staging is deployed (P8.2, its address goes in docs/PROGRESS.md): (1) in staging Admin, issue a small USD invoice to a test
  client and open its client link, (2) Pay now → Bank card → Pay, (3) on the Paynow page sign in with your Paynow merchant login and
  choose **Faked Success**, (4) you come back to Kuzikode's page, which shows "Paid" and a receipt. Then tick this line (or tell the
  next build session) and it is recorded in FINAL-REPORT.
- [ ] **Resend delivery webhook (2026-11-11, P6.7).** Built and tested with signed fixtures; it needs one setting in Resend once staging
  (and later production) is deployed: Resend dashboard → Webhooks → Add endpoint → URL `https://<staging address>/api/webhooks/resend`
  → events `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed` → save, then copy
  the endpoint's **signing secret** (starts with `whsec_`) and set it as the Worker secret `RESEND_WEBHOOK_SECRET` for that
  environment (`npx wrangler secret put RESEND_WEBHOOK_SECRET --env staging`, or add it to the build environment and the agent sets it).
  Without it the endpoint answers 404 and emails simply stay "sent" in the log.
- [ ] **Cloudflare Workers daily request limit is used up by another Worker on your account (2026-11-11 22:25 UTC).** Every
  `*.mhodieknowledge.workers.dev` address, Kuzikode staging included, answers with Cloudflare's "Error 1027 · This website has been
  temporarily rate limited". Cause (Cloudflare analytics, today since 00:00 UTC): your existing Worker **`zimindex`** served about
  160 000 requests, 132 000 of them errors; the Workers Free plan allows 100 000 requests per day **for the whole account**. The
  limit resets at 00:00 UTC, but it will keep happening, and production Kuzikode would go offline the same way. The build agent
  doesn't touch other projects, so choose one: (a) fix or pause `zimindex` (its error rate suggests a retry loop or a bot hitting
  it: Dashboard → Workers & Pages → zimindex → Metrics/Logs), or (b) upgrade to **Workers Paid ($5/month**, 10 million requests
  included; it's also the BLOCKERS advice before taking real payments), or (c) move Kuzikode to a separate Cloudflare account.
- [ ] **Production deploy secrets (2026-11-11, P8.3).** The manual **Deploy production** workflow (Actions → Deploy production → Run
  workflow → type `deploy production`) needs these GitHub secrets (Settings → Secrets and variables → Actions, or as secrets of
  the `production` environment): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `BACKUP_ENCRYPTION_PASSPHRASE` (any long random
  phrase, 20+ characters; **store a copy in your password manager**: without it no backup can ever be decrypted),
  `TURNSTILE_SECRET_KEY`, and for email/payments `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `PAYNOW_USD_INTEGRATION_ID`,
  `PAYNOW_USD_INTEGRATION_KEY` (the **live** Paynow keys once Paynow sets the integration live). The workflow generates the
  internal keys (`HMAC_SECRET`, `DATA_ENCRYPTION_KEY`) on the first deploy and keeps them, backs up the database first, migrates,
  applies the base seed, deploys and smoke-tests. The nightly **Backup** workflow uses the same three Cloudflare/backup secrets.
