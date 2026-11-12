# Final report

Kuzikode Technologies platform: public website, admin back office, client portal and payments. Written 2026-11-11 at the
end of the roadmap (docs/10-ROADMAP.md), in the format PRD §19 requires. Status words are exact: **built** = code + tests
on `main`; **deployed** = running on Cloudflare; **verified** = checked against the running deployment.

## Status at a glance

| | Status |
|---|---|
| Code | All roadmap tasks done except P6.5 (`[!]`, needs the owner's Paynow login) |
| CI on `main` | Green: verify job (typecheck, lint, placeholder check, unit, integration, build, migrations, payments package) and e2e job |
| Staging | **Deployed and verified** 2026-11-12 00:08 UTC: https://kuzikode-staging.mhodieknowledge.workers.dev, smoke test 11/11 (health, home, services, pricing, contact with the real Turnstile key, legal, admin and portal sign-in with private/security headers, robots, sitemap, 404). Database migrated and seeded, Worker secrets set, crons and queue bound. No admin account yet (owner runs Bootstrap first admin). Caveat: another Worker on the account (`zimindex`) used up the Workers Free daily request limit on 2026-11-11, which takes every Worker on the account offline (Error 1027) until 00:00 UTC (BLOCKERS) |
| Production | **Not deployed** (by design: the owner presses Deploy production). Resources exist, empty |
| Payments | Paynow test integration verified live by the automated suite (EcoCash success/cancel/insufficient, card redirect). Faked Success (owner's Paynow login) and "Request to be Set Live" remain owner steps |
| Email | Resend integrated and tested with the real API key in P6; domain not yet verified (sends only to the Resend account owner) |

## 1. What was built

One Cloudflare Worker serving three audiences:

- **Public website**: home, about (mission/vision editable), six service divisions with service pages, industries,
  technologies, pricing with packages and subscriptions, portfolio (ships empty until real work is added), products with
  interest form, insights (blog) with newsletter, careers with applications, FAQ, consultation booking, start-a-project
  wizard, contact, search, legal pages, SEO (meta, JSON-LD, sitemap, robots, OG images), 20 art-directed images.
- **Admin** (`/admin`): dashboard, enquiries, leads pipeline, clients (contacts, notes, credits, portal access), quotations
  (versions, acceptance, convert to invoice/project), invoices (issue, PDF, send, reminders, credit notes, void, offline
  payments), payments and reconciliation, subscriptions (auto-billing, renewal reminders, saved-card auto-charge),
  managed services (client assets, renewals), expenses, reports with CSV export, projects, time tracking, support tickets,
  CMS (pages, content, insights, media, announcements, testimonials, newsletter), catalogue (services, packages, price
  review), careers, users and roles, settings, audit log, notifications, command palette.
- **Client portal** (`/portal`): overview, quotations (view/accept), invoices and payments (pay online, receipts), saved
  cards, projects, services, support, account; self sign-up with admin approval.
- **Payments**: `packages/payments` (`@kuzikode/payments`), gateway-independent adapters for Paynow (express mobile
  money + card redirect + tokenization), PesePay and a mock gateway; routing by currency/method; hosted checkout `/pay`.
- **Operations**: outbox + queue for all email and background work, three cron schedules, CI, staging/production/backup
  workflows, smoke test, encrypted backups with restore drill, key rotation.

## 2. Architecture and technology

Astro 7 (SSR, React 19 islands) + Hono 4 API in one Worker (`@astrojs/cloudflare` 14), TypeScript 6 strict, Zod 4 at every
boundary, Tailwind 4 with design tokens, pdf-lib for PDFs. Business logic lives only in `src/server/modules/*/service.ts`
(28 modules); pages and routes call services; all SQL goes through repositories with bound parameters. Money is integer
minor units + currency everywhere (`lib/money.ts`). Multi-statement writes are atomic D1 batches with the audit row in
the same batch. Every decision and deviation is in [DECISIONS.md](DECISIONS.md); the structure is in
[03-ARCHITECTURE.md](03-ARCHITECTURE.md).

## 3. Database

Cloudflare D1, 12 append-only migrations (`migrations/0001_identity` … `0012_card_tokens`), 92 tables: identity and
access (users, roles, permissions, sessions, MFA, tokens), CRM, catalogue, sales documents (quotations, invoices, items,
credit notes, sequences, status history), payments (provider accounts, routes, attempts, payments, refunds, saved
methods, callbacks), delivery (projects, time, support, assets), content, careers, notifications, outbox, email logs,
audit logs, settings. Issued financial records are immutable; no cascading deletes from financial tables. Seeds:
`base.sql` (all environments), `nonprod.sql` (dev + staging: mock gateway), `dev.sql` (local fictional demo data).
Details: [04-DATABASE.md](04-DATABASE.md).

## 4. Features vs PRD §19

| PRD requirement | State |
|---|---|
| Public site, six divisions, editable About/mission/vision | built, e2e-tested |
| Portfolio and products | built; portfolio intentionally empty until real entries |
| Enquiries | built (Turnstile, rate limits, notifications) |
| Admin auth and permissions | built: RBAC with 7 roles, 2FA mandatory for super admin/finance |
| Clients, quotations, invoices + PDFs, secure public invoice links | built |
| Client portal | built |
| Projects, expenses | built (+ time, support, managed services, subscriptions, careers) |
| Gateway-independent payments | built; Paynow, PesePay, mock adapters behind one interface |
| Paynow test mode tested | automated live suite passed against the owner's test integration; manual Faked Success pending (owner) |
| Callbacks secure and idempotent | hash-verified, replay-safe, reconciled by status poll + 5-minute sweep |
| Email integrated (Resend) | built, tested with the real key; delivery webhook built, needs owner's endpoint secret |
| Audit logs | every sensitive action, same batch as the change |
| All tests pass, production build succeeds | yes (numbers below) |
| Cloudflare config complete | yes: real resource IDs, crons, queues, secrets on staging |
| Docs complete | README, RUNBOOK, ADMIN-GUIDE, PAYMENTS-ONBOARDING, EMAIL-SETUP, PRODUCTION-CHECKLIST + specs |
| No critical security issues | none known (section 6) |

## 5. Tests and results (real numbers)

| Suite | Result |
|---|---|
| Unit (`npm run test:unit`, incl. payments package and script tests) | **355 passed** |
| Integration (`npm run test:integration`, Workers runtime with D1/R2/KV/Queues) | **308 passed** |
| Payments package standalone (`npm test -w @kuzikode/payments`) | **84 passed** |
| End-to-end (Playwright, 41 spec files, axe accessibility checks, 375/768/1440 px) | **92 tests + link crawl (51 pages, 77 URLs) green** in CI run 78; locally green 2026-11-11 |
| Typecheck / lint / placeholder check / migrations on empty D1 | clean |
| Paynow live test suite (test mode, owner's integration) | passed (P6.5 automated part) |
| Lighthouse (mobile, local build) | `/` P99 A100 BP100 · `/services/` P100 A100 BP100 · service page P98 A100 BP100 · `/contact` P99 A100 BP96; SEO 100 with production config |
| Smoke test against staging | **11/11 passed** (2026-11-12 00:08 UTC; the 2026-11-11 run hit Cloudflare Error 1027, section 10) |
| Backup → restore drill (staging) | 92 tables, 677 rows restored, checksums match, 26 s |

## 6. Security measures

PBKDF2-SHA256 passwords with rehash-on-login, breached/weak password rules; server-side sessions in D1 with
`__Host-` secure cookies, idle and absolute expiry, device list and sign-out; CSRF tokens (HMAC) on every mutation plus
same-origin checks; TOTP 2FA with replay protection and hashed single-use backup codes (mandatory for super admin and
finance); RBAC permission checks in services, portal data scoped per client (404 on others' records); Turnstile and rate
limits on public forms and sign-in; strict CSP, `X-Frame-Options: DENY`, nosniff, referrer and permissions policies, HSTS in
production, `no-store` + `noindex` on private paths; upload validation by magic bytes (SVG/HTML refused), random R2 keys,
short-lived signed download links; AES-256-GCM for TOTP secrets and card tokens with key rotation; secrets only as Worker
secrets (never in code, logs or the browser; logs redact them); verified, idempotent payment callbacks; immutable financial
records; audit log of every sensitive action; encrypted off-database backups. Details: [07-SECURITY.md](07-SECURITY.md).

## 7. Cloudflare resources

All created (2026-11-11), IDs in `wrangler.jsonc`:

| | Staging | Production |
|---|---|---|
| Worker | `kuzikode-staging` (deployed) | `kuzikode` (not deployed) |
| D1 | `kuzikode-staging-db` | `kuzikode-prod-db` |
| R2 | `kuzikode-staging-files`, `kuzikode-staging-backups` | `kuzikode-prod-files`, `kuzikode-prod-backups` |
| KV | `kuzikode-staging-cache` | `kuzikode-prod-cache` |
| Queues | `kuzikode-staging-jobs`, `-dlq` | `kuzikode-prod-jobs`, `-dlq` |
| Crons | `*/5 * * * *`, `17 2 * * *`, `41 5 * * *` | same |
| Backup retention (R2 lifecycle) | daily 30 d, monthly 365 d, pre-deploy 90 d | same |

Turnstile widget (owner's site key) for both. Recommended: Workers Paid plan ($5/month).

## 8. External credentials still required (owner)

From [BLOCKERS.md](BLOCKERS.md):
- Resolve the Workers daily limit (fix `zimindex` or Workers Paid).
- Production GitHub secrets: `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, later `RESEND_WEBHOOK_SECRET` and live
  `PAYNOW_USD_INTEGRATION_ID/KEY` (`CLOUDFLARE_*` and `BACKUP_ENCRYPTION_PASSPHRASE` exist).
- Paynow: Faked Success test, "Request to be Set Live", tokenization approval for saved cards; optional ZWG integration
  and PesePay keys.
- Domain (kuzikode.com) → Resend domain verification, Turnstile hostnames, Email Routing.
- Resend delivery webhook signing secret per environment.
- First admin account per environment (Bootstrap first admin workflow).
- Legal review, company registration details, VAT status.

## 9. Deployment instructions

Step by step in [PRODUCTION-CHECKLIST.md](PRODUCTION-CHECKLIST.md); operations in [RUNBOOK.md](RUNBOOK.md). In short:
1. Staging deploys itself after green CI on `main` (Deploy staging workflow: build → migrate → deploy → smoke).
2. GitHub → Actions → **Bootstrap first admin** → environment, your email → set password + 2FA from the email.
3. Production: add the GitHub secrets, then Actions → **Deploy production** → type `deploy production` → approve. It
   verifies, backs up, prepares Worker secrets, migrates, seeds, deploys and smoke-tests. Then bootstrap the production
   admin and walk RUNBOOK §7.
4. Nightly **Backup** runs at 01:43 UTC; drill a restore monthly (`scripts/restore-drill.sh`).

## 10. Remaining limitations

- **Account-wide Workers Free limit:** on 2026-11-11 `zimindex` (≈160k requests, 132k errors) used up the 100k/day limit and
  every Worker on the account, Kuzikode staging included, answered Error 1027 until the 00:00 UTC reset. Until that's fixed (or
  Workers Paid), it can recur daily and would take production offline the same way. Production is not deployed (owner's button).
- Paynow manual Faked Success and go-live are owner steps; saved cards wait on Paynow tokenization approval.
- Email reaches only the Resend account owner until a domain is verified.
- Production smoke test needs the real Turnstile key on the production hostname (set) and the `production` environment
  secrets above.
- Figma holds only the design foundations; final screens are Playwright screenshots in `docs/screenshots/` (DECISIONS).
- The restore drill ran on staging seed data; repeat on production once it holds real data.
- Workers Free plan CPU limit (10 ms) is tight for PBKDF2 sign-in and first PDF render; Workers Paid recommended before
  real payments.
