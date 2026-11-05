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
- [ ] **First admin account:** after the staging/production bootstrap, open the one-time set-password link
  (valid 24 h). The agent gives it to you in the session chat, or you run `npm run bootstrap:admin` yourself (see docs/09 §5).

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

- [ ] **Note on the Cloudflare connector:** it's connected, but the agent still needs the **API token** above. GitHub Actions deploys and
  `wrangler` (Workers, Queues, secrets, migrations, domains) can't use the connector. You **don't** need to create any Workers, databases or
  buckets yourself: the agent creates them all (names prefixed `kuzikode-`) and leaves your existing `zimindex` resources alone.

- [ ] **Paynow card tokenization:** email Paynow support and ask them to **enable tokenization (`tokenize`) for your integration** so
  customers' cards can be saved and charged on Kuzikode's own checkout. While you're at it, ask: *"Do you offer embeddable card fields or a
  direct card API for merchants?"* (if yes, the agent can remove the one-time card window entirely). Until approved, cards still work through the
  one-time secure window.

## Raised by the agent
