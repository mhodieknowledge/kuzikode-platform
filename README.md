# Kuzikode platform

The website, admin back office and client portal for **Kuzikode Technologies**: public marketing site with pricing,
careers and insights; CRM (enquiries, leads, clients); quotations, invoices, credit notes, subscriptions; payments through
Paynow (EcoCash, OneMoney, InnBucks, O'mari, cards) behind a gateway-independent payments package; projects, time, support,
expenses and reports; transactional email through an outbox and a queue.

It runs entirely on Cloudflare: one Worker (Astro 7 SSR + Hono API), D1 (SQLite), R2 (files and backups), KV (cache),
Queues (background jobs), Cron Triggers, Turnstile. Email goes through Resend.

| | |
|---|---|
| Staging | https://kuzikode-staging.mhodieknowledge.workers.dev |
| Production | `https://kuzikode.mhodieknowledge.workers.dev` once deployed (later `https://kuzikode.com`) |
| Product requirements | [`docs/01-PRD.md`](docs/01-PRD.md), [`docs/12-COMMERCIAL-FEATURES.md`](docs/12-COMMERCIAL-FEATURES.md) |
| Architecture | [`docs/03-ARCHITECTURE.md`](docs/03-ARCHITECTURE.md), database [`docs/04-DATABASE.md`](docs/04-DATABASE.md) |
| Operating it | [`docs/RUNBOOK.md`](docs/RUNBOOK.md), [`docs/PRODUCTION-CHECKLIST.md`](docs/PRODUCTION-CHECKLIST.md) |
| Using it | [`docs/ADMIN-GUIDE.md`](docs/ADMIN-GUIDE.md) |
| Payments and email set-up | [`docs/PAYMENTS-ONBOARDING.md`](docs/PAYMENTS-ONBOARDING.md), [`docs/EMAIL-SETUP.md`](docs/EMAIL-SETUP.md) |
| Open owner actions | [`docs/BLOCKERS.md`](docs/BLOCKERS.md) |

## Local development

Requirements: Node.js 22.23+ (see `.nvmrc`) and npm. No Cloudflare account is needed locally: wrangler runs D1, R2, KV and
Queues in Miniflare.

```bash
npm ci
cp .dev.vars.example .dev.vars        # optional: development falls back to safe built-in values
npm run db:migrate:local              # apply migrations/ to the local D1
npm run db:seed:local                 # base data + mock payment account + fictional demo data
npm run preview:worker                # build + wrangler dev on http://localhost:8787 (full Worker incl. queue and cron)
npm run dev                           # astro dev, fastest loop for UI work
```

Create a local admin: `npm run bootstrap:admin -- --env local --email you@example.com --name "You"` prints a set-password
link. In development, email is not sent: open **Admin → Mailbox** (`/admin/dev/mailbox`) to read what would have gone out.
Payments use the mock gateway (test numbers in [`packages/payments/README.md`](packages/payments/README.md)).

## Checks

```bash
npm run verify        # typecheck, lint, placeholder check, unit + integration tests, production build
npm run test:e2e      # Playwright (starts its own worker)
npm run check:migrations
npm test -w @kuzikode/payments
```

CI (`.github/workflows/ci.yml`) runs all of these on every push to `main`. After CI passes, `deploy-staging.yml` builds,
migrates and deploys staging and runs `scripts/smoke.mjs` against it. Production is deployed only by hand
(`deploy-production.yml`). Nightly encrypted database backups run from `backup.yml`. See [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

## Layout

```
src/pages/            Astro pages (public site, /admin, /portal, /pay, /q, /i) and API mounts
src/server/           Hono app, modules/*/service.ts (all business logic), repositories, jobs (outbox, queue, cron)
src/components/       React islands and Astro components (ui/ is the design-system kit)
packages/payments/    @kuzikode/payments: gateway adapters (Paynow, PesePay, mock), conformance kit
migrations/           D1 migrations (append-only)
seeds/                base.sql (all envs), nonprod.sql (dev + staging), dev.sql (local demo data)
scripts/              seed, bootstrap-admin, smoke, backup/restore, checks
tests/                unit, integration (Workers runtime), e2e (Playwright)
```
