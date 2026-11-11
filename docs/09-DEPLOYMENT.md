# 09 — Deployment, CI/CD, Secrets, Backups

Use placeholders for account-specific IDs until the real resources exist. **Never invent IDs.** When
the agent has `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`, it creates the staging resources itself
with wrangler and writes the returned real IDs into `wrangler.jsonc`.

## 1. Environments
| Env | Worker name | URL | Data | Payments | Email |
|---|---|---|---|---|---|
| local | — (`wrangler dev`) | http://localhost:8787 | local D1 (base + dev seed) | mock (+ sandbox if secrets in `.dev.vars`) | log adapter |
| staging | `kuzikode-staging` | `https://kuzikode-staging.<subdomain>.workers.dev` | `kuzikode-staging-db` (base seed + optional dev seed) | Paynow **test mode** account (mock allowed with banner) | Resend (test sender or verified domain) |
| production | `kuzikode` | `https://kuzikode.<subdomain>.workers.dev` → later `https://kuzikode.com` + `www` redirect | `kuzikode-prod-db` (base seed only) | Paynow **live** account (only once Paynow sets the integration live and the owner sets keys) | Resend verified domain |

## 2. Cloudflare resources (per env, `-staging` / `-prod` suffix)
```bash
npx wrangler d1 create kuzikode-staging-db
npx wrangler r2 bucket create kuzikode-staging-files
npx wrangler r2 bucket create kuzikode-staging-backups
npx wrangler kv namespace create kuzikode-staging-cache
npx wrangler queues create kuzikode-staging-jobs
npx wrangler queues create kuzikode-staging-jobs-dlq
```
(same with `prod` for production). R2 requires R2 to be enabled on the account (needs a payment method on file, free tier still $0).

## 3. `wrangler.jsonc` shape (agent fills in real IDs)
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "kuzikode-dev",
  "main": "./dist/_worker.js/index.js",          // confirm with current @astrojs/cloudflare docs
  "compatibility_date": "<today at setup time>",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": "./dist", "binding": "ASSETS" },
  "observability": { "enabled": true },
  "triggers": { "crons": ["*/5 * * * *", "17 2 * * *"] },   // 5-min sweeps; nightly maintenance (02:17 UTC)
  "vars": { "APP_ENV": "development", "PUBLIC_SITE_URL": "http://localhost:8787", "PAYMENTS_MOCK_ENABLED": "true",
            "EMAIL_FROM": "Kuzikode <onboarding@resend.dev>", "EMAIL_REPLY_TO": "", "TURNSTILE_SITE_KEY": "1x00000000000000000000AA" },
  "d1_databases": [{ "binding": "DB", "database_name": "kuzikode-local-db", "database_id": "local", "migrations_dir": "migrations" }],
  "r2_buckets": [{ "binding": "FILES", "bucket_name": "kuzikode-local-files" }, { "binding": "BACKUPS", "bucket_name": "kuzikode-local-backups" }],
  "kv_namespaces": [{ "binding": "CACHE", "id": "local" }],
  "queues": {
    "producers": [{ "binding": "JOBS", "queue": "kuzikode-local-jobs" }],
    "consumers": [{ "queue": "kuzikode-local-jobs", "max_batch_size": 10, "max_retries": 5, "dead_letter_queue": "kuzikode-local-jobs-dlq" }]
  },
  "env": {
    "staging": {
      "name": "kuzikode-staging",
      "vars": { "APP_ENV": "staging", "PUBLIC_SITE_URL": "https://kuzikode-staging.<SUBDOMAIN>.workers.dev", "PAYMENTS_MOCK_ENABLED": "true", "...": "..." },
      "d1_databases": [{ "binding": "DB", "database_name": "kuzikode-staging-db", "database_id": "<STAGING_D1_ID>", "migrations_dir": "migrations" }],
      "...": "r2/kv/queues with staging names and <IDS>"
    },
    "production": {
      "name": "kuzikode",
      "vars": { "APP_ENV": "production", "PUBLIC_SITE_URL": "https://kuzikode.<SUBDOMAIN>.workers.dev", "PAYMENTS_MOCK_ENABLED": "false", "...": "..." },
      "routes": [ /* enable after the domain is on Cloudflare:
        { "pattern": "kuzikode.com", "custom_domain": true },
        { "pattern": "www.kuzikode.com", "custom_domain": true } */ ],
      "...": "prod bindings with <IDS>"
    }
  }
}
```
Bindings are **not inherited** into `env.*` blocks. Repeat all of them per env. Run `npx wrangler types` after changes.

## 4. Secrets (`npx wrangler secret put NAME --env staging|production`; local: `.dev.vars`)
| Secret | Required | Purpose |
|---|---|---|
| `PAYNOW_USD_INTEGRATION_ID` / `PAYNOW_USD_INTEGRATION_KEY` | for payments | Paynow launch account (names follow the account's `secret_prefix`; add `PAYNOW_ZWG_*` if a ZWG integration exists) |
| `PESEPAY_MAIN_INTEGRATION_KEY` / `PESEPAY_MAIN_ENCRYPTION_KEY` | optional | Only if a PesePay account is routed |
| `RESEND_API_KEY` | for email | Resend API |
| `RESEND_WEBHOOK_SECRET` | for delivery status | Verify Resend (Svix) webhook signatures |
| `TURNSTILE_SECRET_KEY` | yes (staging/prod) | Turnstile siteverify |
| `HMAC_SECRET` | yes | CSRF token HMAC, signed download URLs, IP hashing pepper (32+ random bytes) |
| `ADMIN_ALERT_EMAIL` (var or secret) | yes | Where admin alerts go if no staff prefs are set |
| `DATA_ENCRYPTION_KEY` | yes | AES-GCM key (32 random bytes, base64) for TOTP secrets and saved-card tokens. Rotation procedure in RUNBOOK |
| `DATA_ENCRYPTION_KEY_PREVIOUS` | only during a rotation | The old key: still read, re-encrypted nightly, then removed (RUNBOOK §5) |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | optional | Paid image generation for the dev-time imagery (agent environment only, never a Worker secret) |
The Cloudflare API token additionally needs **Workers AI: Read + Edit** so the agent can generate the site imagery during development (no Worker binding needed).
GitHub repo secrets: `CLOUDFLARE_API_TOKEN` (scopes: Workers Scripts Edit, D1 Edit, Workers R2 Storage Edit,
Workers KV Storage Edit, Queues Edit, Workers AI Read+Edit, Account Settings Read, + Zone DNS/Workers Routes Edit for custom domain),
`CLOUDFLARE_ACCOUNT_ID`, `BACKUP_ENCRYPTION_PASSPHRASE`.
`scripts/check-env.ts` + `GET /api/health?deep=1` (admin-only) report which secrets are missing, by name and never by value.

## 5. Commands
```bash
npm ci
npm run dev                                   # astro dev (UI work); `npm run preview:worker` = build + wrangler dev (full worker incl. queue/cron)
npm run db:migrate:local                      # wrangler d1 migrations apply DB --local
npm run db:seed:local                         # base + dev seeds
npm run db:migrate:staging                    # wrangler d1 migrations apply DB --remote --env staging
npm run db:migrate:production                 # same with --env production (CI manual workflow only)
npm run bootstrap:admin -- --env staging --email you@example.com --name "Owner"
npm run build
npm run deploy:staging                        # wrangler deploy --env staging
npm run deploy:production                     # wrangler deploy --env production (manual workflow)
```

## 6. GitHub Actions
- `.github/workflows/ci.yml`: on push + PR to `main`. Node LTS, `npm ci` (cached), `npm run verify`,
  Playwright install + `npm run test:e2e`, upload reports on failure. Must finish in < 15 min.
- `.github/workflows/deploy-staging.yml`: on push to `main` **after CI succeeds** (`workflow_run`, or one
  workflow with `needs:`). Steps: build → `d1 migrations apply --remote --env staging` → `wrangler deploy --env staging`
  → smoke test (`curl` `/api/health`, `/`, `/services`) → fail loudly. Skips gracefully with a notice if the
  Cloudflare secrets are absent.
- `.github/workflows/deploy-production.yml`: `workflow_dispatch` only, GitHub Environment `production` with
  required reviewer = owner. Steps: verify → **backup D1 first** → migrations → deploy → smoke test.
- `.github/workflows/backup.yml`: nightly cron + manual. `wrangler d1 export kuzikode-prod-db --remote --output backup.sql`
  → gzip → encrypt (`openssl enc -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSPHRASE`) → `wrangler r2 object put
  kuzikode-prod-backups/d1/YYYY/MM/DD.sql.gz.enc` → keep 30 daily + 12 monthly (prune only backups, never data).
- Use pinned action versions (`actions/checkout@v4` etc., `cloudflare/wrangler-action@v3`) and verify they're current.

## 7. Backup & restore
- **D1 Time Travel:** point-in-time restore (7 days on Free, 30 days on Paid). `npx wrangler d1 time-travel info|restore`.
- **Nightly encrypted SQL export to R2** (above) gives off-platform longevity. Recommend the owner also downloads a
  monthly copy off Cloudflare.
- **R2 files:** nightly job lists new objects since the last run and copies them into the backups bucket under `files/`
  (or document `rclone` sync to an external free store). Files are content-addressed (`sha256` in `files` table) so restore can be verified.
- **Restore drill (required, Phase 8):** create `kuzikode-restore-test` D1 → decrypt + `wrangler d1 execute --file` →
  run `scripts/verify-restore.ts` (row counts per table match the backup manifest, invoice totals checksum) → record
  results in PROGRESS.md → delete the scratch DB. Document the exact commands in `docs/RUNBOOK.md`.

## 8. Custom domain (when the owner has kuzikode.com)
1. Add the zone to Cloudflare (nameservers at the registrar).
2. Uncomment `routes` with `custom_domain: true` for apex + `www` (redirect `www` → apex via a Redirect Rule or in the worker).
3. Set `PUBLIC_SITE_URL=https://kuzikode.com`, redeploy.
4. Resend: add domain, publish SPF/DKIM (and DMARC `p=none` → later `quarantine`) records, verify, set `EMAIL_FROM=Kuzikode <hello@kuzikode.com>`.
5. Business email (inbound): Cloudflare Email Routing (free) to forward `hello@`/`billing@` to the owner's inbox, or a paid mailbox provider.
6. Paynow: update the integration's site details to the new domain if required, and confirm result URLs reach `https://kuzikode.com/api/payments/callbacks/paynow/<accountId>`.
7. Turnstile: add the hostname to the widget.

## 9. Post-deploy verification checklist (`docs/RUNBOOK.md`)
Health endpoint OK. Home/services/contact render. Contact form submits and the admin is notified. Admin login.
Create a draft invoice. Sandbox payment completes in staging. Email delivered. PDF downloads. `robots.txt` and
`sitemap.xml` correct. Security headers present (securityheaders.com grade A). Portal pages `no-store`. Cron executions visible in dashboard logs.
