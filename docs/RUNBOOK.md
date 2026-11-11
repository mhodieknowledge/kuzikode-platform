# Runbook

How to deploy, migrate, roll back, restore and rotate secrets for the Kuzikode Worker, and what to do first in an incident.
Resource names and IDs are in `wrangler.jsonc`; the environment table is in [`09-DEPLOYMENT.md`](09-DEPLOYMENT.md) §1.

| | Staging | Production |
|---|---|---|
| Worker | `kuzikode-staging` | `kuzikode` |
| URL | https://kuzikode-staging.mhodieknowledge.workers.dev | https://kuzikode.mhodieknowledge.workers.dev |
| D1 | `kuzikode-staging-db` | `kuzikode-prod-db` |
| R2 | `kuzikode-staging-files`, `kuzikode-staging-backups` | `kuzikode-prod-files`, `kuzikode-prod-backups` |
| KV | `kuzikode-staging-cache` | `kuzikode-prod-cache` |
| Queue | `kuzikode-staging-jobs` (+ `-dlq`) | `kuzikode-prod-jobs` (+ `-dlq`) |
| Deploys | automatic after green CI on `main` | manual workflow only |

Commands below that run on your computer need Node 22, `npm ci`, and `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in the
shell. Everything routine is also available as a GitHub Actions workflow, which is the preferred way.

## 1. Deploy

**Staging** deploys itself: push to `main` → CI → **Deploy staging** (build, `d1 migrations apply`, `wrangler deploy`,
smoke test). To redeploy without a new commit: Actions → Deploy staging → Run workflow.

**Production:** Actions → **Deploy production** → Run workflow → type `deploy production` → Run (then approve, if the
`production` environment has you as required reviewer). The workflow runs `npm run verify`, backs up the database
(`d1/pre-deploy/<timestamp>`), prepares Worker secrets, applies migrations, applies the base seed (idempotent `INSERT OR
IGNORE`), builds, deploys, and smoke-tests (`scripts/smoke.mjs --env production`). If the smoke test fails the new version
is live: check it, then roll back (§3) if needed.

After any production deploy, walk the post-deploy checklist (§7).

## 2. Database migrations

- Migrations live in `migrations/NNNN_name.sql`, are append-only and never edited after they're on `main`.
- Every deploy applies pending migrations first (`npm run db:migrate:staging|production` = `wrangler d1 migrations apply DB
  --remote --env …`). `wrangler d1 migrations list DB --remote --env production` shows what's pending.
- Write migrations to be **backward compatible with the running version** (add columns/tables; don't drop or rename in the
  same release that stops using them), because migrations apply a few seconds before the new code is live and a code
  rollback doesn't undo them.
- `npm run check:migrations` (in CI) applies all migrations to an empty database.

## 3. Roll back

Code: Cloudflare keeps previous Worker versions.

```bash
npx wrangler deployments list --env production           # find the last good version
npx wrangler rollback <version-id> --env production --message "reason"
```

(Dashboard alternative: Workers & Pages → kuzikode → Deployments → ⋯ → Rollback.) Then fix forward on `main`.
Secrets and bindings are not part of a rollback. A rollback does not undo migrations (see §2).

Data: see §4. Prefer fixing data forward through the app (void + credit note for financial records; never delete them).

## 4. Restore the database

Two sources, in order of preference:

1. **D1 Time Travel** (any minute in the last 7 days on Workers Free, 30 days on Paid). Fast, in place:
   ```bash
   npx wrangler d1 time-travel info kuzikode-prod-db --timestamp 2026-11-12T09:30:00Z   # check the bookmark
   npx wrangler d1 time-travel restore kuzikode-prod-db --timestamp 2026-11-12T09:30:00Z
   ```
   Everything written after that moment is lost. Take a backup first (Actions → Backup → Run workflow) so it can be
   inspected later.
2. **Encrypted nightly export** in R2 `kuzikode-prod-backups` (`d1/daily/YYYY-MM-DD` 30 days, `d1/monthly/YYYY-MM`
   12 months, `d1/pre-deploy/<timestamp>` 90 days; each `.sql.gz.enc` has a `.manifest.json.enc` with row counts and
   money checksums). Needs `BACKUP_ENCRYPTION_PASSPHRASE`.

   **Always drill first** into a scratch database; it proves the file decrypts and is complete:
   ```bash
   BACKUP_ENCRYPTION_PASSPHRASE='…' bash scripts/restore-drill.sh production d1/daily/2026-11-12
   ```
   It downloads + decrypts the backup, creates `kuzikode-restore-test`, loads it, compares every table's row count and the
   invoice/payment totals per currency with the manifest, prints the result, and deletes the scratch database.

   To actually replace production from an export (outage-level decision; the site should be in maintenance first):
   ```bash
   # 1. export current state for the record
   BACKUP_ENCRYPTION_PASSPHRASE='…' bash scripts/backup-d1.sh production pre-deploy
   # 2. download + decrypt the chosen backup
   npx wrangler r2 object get kuzikode-prod-backups/d1/daily/2026-11-12.sql.gz.enc --file b.enc --remote
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_ENCRYPTION_PASSPHRASE -in b.enc | gunzip > b.sql
   # 3. load into a NEW database, verify it, then point production at it
   npx wrangler d1 create kuzikode-prod-db-restored
   npx wrangler d1 execute kuzikode-prod-db-restored --remote --file b.sql --yes
   #    put the new database_id into wrangler.jsonc env.production.d1_databases, commit, run Deploy production
   ```
   Loading into a new database and switching the binding avoids mixing old and new rows. Keep the old database until
   you're sure, then delete it by hand.

**Drill record:** 2026-11-11, staging backup `d1/pre-deploy/20261111T222212Z`: 92 tables, 677 rows, checksums matched,
26 s (PROGRESS.md). Repeat on production once a month (first time once production holds real data) and note the result
in PROGRESS.md.

R2 files (uploads, PDFs): R2 is durable storage; deleted objects are not recoverable. Files are content-addressed
(`files.sha256`). The app never deletes financial PDFs.

## 5. Rotate secrets

Set a Worker secret: `npx wrangler secret put NAME --env production` (paste when prompted; it's live at once, no deploy
needed). For keys the production workflow manages from GitHub secrets (Turnstile, Resend, Paynow, PesePay), update the
GitHub secret instead and re-run Deploy production, otherwise the next deploy puts the old value back.

| Secret | How to rotate | Effect |
|---|---|---|
| `TURNSTILE_SECRET_KEY` | Turnstile dashboard → widget → Rotate secret key → update the GitHub secret → Deploy production | none |
| `RESEND_API_KEY` | Resend → API Keys → create new → update secret → deploy → delete the old key | none |
| `RESEND_WEBHOOK_SECRET` | Resend → Webhooks → endpoint → rotate signing secret → update secret → deploy | none |
| `PAYNOW_*_INTEGRATION_KEY` | Paynow → integration → generate new key (emailed to the company address) → update secret → deploy | in-flight payments still verify by status poll |
| `HMAC_SECRET` | `openssl rand -base64 48`, `wrangler secret put HMAC_SECRET --env production` | links already sent stop working: public quotation/invoice links (`/q/…`, `/i/…`), payment return links, signed download links, newsletter confirm/unsubscribe links; re-send the documents that matter. Do it only if the secret leaked. |
| `DATA_ENCRYPTION_KEY` | see below | none if done in order |
| `BACKUP_ENCRYPTION_PASSPHRASE` | new GitHub secret; **keep the old one** as long as old backups exist (up to 12 months), they need it | none |
| Cloudflare API token | Cloudflare → My Profile → API Tokens → Roll → update GitHub secret `CLOUDFLARE_API_TOKEN` | none |

**`DATA_ENCRYPTION_KEY`** (AES-256-GCM key for TOTP secrets and saved-card tokens) rotates without anyone re-enrolling:

```bash
openssl rand -base64 32                                                        # the new key, keep it in your password manager
npx wrangler secret put DATA_ENCRYPTION_KEY_PREVIOUS --env production          # paste the CURRENT key
npx wrangler secret put DATA_ENCRYPTION_KEY --env production                   # paste the NEW key
```

The app now reads old data with the previous key and writes new data with the new one. The nightly job (02:17 UTC,
`reencrypt-totp-secrets` / `reencrypt-card-tokens`) re-encrypts everything still under the old key and writes a
`security.data_reencrypted` audit row. After the next night, check the audit log (Admin → Audit log), then remove the old
key: `npx wrangler secret delete DATA_ENCRYPTION_KEY_PREVIOUS --env production`. If a log line says "encrypted values
readable with neither key", those users must set up two-step sign-in again (Admin → Users → the user → Reset two-factor) and those
cards must be saved again.

## 6. Incident basics

1. **Is it down?** `curl -s https://kuzikode.mhodieknowledge.workers.dev/api/health` should return `{"data":{"status":"ok"}}`.
   Cloudflare's own page "Error 1027 · temporarily rate limited" means the account used its Workers Free daily
   request limit (100 000, shared by every Worker on the account; resets 00:00 UTC): upgrade to Workers Paid or stop the
   Worker that uses it up. "Error 1101/1102" = the Worker threw or ran out of CPU: check logs.
2. **Logs:** `npx wrangler tail kuzikode --env production --format pretty` (live), or Dashboard → Workers & Pages →
   kuzikode → Logs (observability is on). Every log line and every error response carries a `requestId`; ask the person
   for the reference shown on the error page and search for it.
3. **Bad deploy?** Roll back (§3) first, investigate after.
4. **Payments:** gateway callbacks are verified and idempotent, and the 5-minute reconciliation re-checks open payments,
   so a short outage loses nothing. Admin → Payments shows attempts needing attention. To stop taking payments for a
   while: Admin → Payments → Gateways → edit the account → untick Enabled → Save (checkout then offers no online payment).
5. **Email:** Admin → Settings → Integrations → "Send a test email to me" checks the pipeline end to end; stuck jobs sit in the `outbox` table
   (`status = 'failed'`) and failed queue messages in `kuzikode-prod-jobs-dlq`. Retry by fixing the cause; the outbox
   sweep re-sends pending jobs every 5 minutes, idempotently.
6. **Suspected breach:** rotate the leaked secret (§5); for an affected staff account use Admin → Users → the user →
   Disable account (everyone can also end their other sessions under Account → Signed-in devices); check Admin → Audit
   log, and write down what happened and when.
7. Afterwards: note the incident, cause and fix in PROGRESS.md (or your own log).

## 7. Post-deploy checklist (docs/09 §9)

- [ ] `/api/health` OK; home, services, pricing and contact render (the smoke test checks these)
- [ ] Contact form submits, and the enquiry appears in Admin → Enquiries with a notification
- [ ] Admin sign-in with two-step code works
- [ ] Create a draft invoice, issue it, download its PDF
- [ ] Staging: a mock or Paynow test payment completes; production: one small real payment, then refund or credit it
- [ ] Admin → Settings → Integrations → "Send a test email to me"; it arrives (with the Resend webhook set, its
      `email_logs` row turns `delivered`)
- [ ] `robots.txt` (production: allows crawling + sitemap; staging: `Disallow: /`) and `sitemap.xml`
- [ ] Security headers: https://securityheaders.com grade A; `/admin` and `/portal` responses are `no-store`
- [ ] Dashboard → Workers → kuzikode → Triggers shows the three crons with recent executions
