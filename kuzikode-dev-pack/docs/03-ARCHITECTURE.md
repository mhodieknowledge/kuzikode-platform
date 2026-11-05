# 03 — Architecture

Modular monolith. One repository, one Cloudflare Worker. Clear module boundaries.

## 1. Runtime shape

```
                ┌────────────────────── Cloudflare Worker "kuzikode" ───────────────────────┐
 Browser ──────►│ src/worker.ts (custom entry)                                                │
                │   fetch(req):                                                               │
                │     /api/*            → Hono app (src/server/app.ts)                        │
                │     everything else   → Astro handler (public site, /admin, /portal, /q, /i) │
                │   queue(batch)        → src/server/jobs/consumer.ts                          │
                │   scheduled(event)    → src/server/jobs/scheduled.ts                         │
                └──────┬───────────┬──────────┬───────────┬──────────────┬────────────────────┘
                       │           │          │           │              │
                    D1 (DB)    R2 (FILES)  KV (CACHE)  Queue (JOBS)   Static Assets
                                                         │ DLQ (JOBS_DLQ)
 External: PesePay API (outbound + result callback → /api/payments/callbacks/pesepay)
           Resend API (outbound + webhook → /api/webhooks/resend), Turnstile siteverify
```

- Astro pages are server-rendered. They call **services directly** (same process) through a request-scoped
  context, not over HTTP. React islands call `/api/*` JSON endpoints for mutations and data grids.
- Astro middleware (`src/middleware.ts`) resolves the session for `/admin/*` and `/portal/*` pages
  using the same `auth` service the Hono middleware uses. Unauthenticated → redirect to the matching login.
- Prerender only truly static pages. Public CMS pages are SSR + edge-cached by content version.

## 2. Repository layout

```
.
├── CLAUDE.md                     # agent operating manual
├── docs/                         # specs, roadmap, progress, decisions, blockers, final report
├── astro.config.mjs
├── wrangler.jsonc                # envs: (default=local), staging, production
├── package.json  tsconfig.json  eslint.config.js  .prettierrc  vitest.config.ts  playwright.config.ts
├── .dev.vars.example             # secret NAMES only
├── migrations/                   # 0001_init.sql, 0002_... (wrangler d1 migrations)
├── seeds/
│   ├── base.sql                  # required reference data (roles, permissions, currencies, sequences, service divisions, default CMS content) — safe for prod
│   └── dev.sql                   # clearly fictional sample data — NEVER run against production (script refuses)
├── scripts/
│   ├── bootstrap-admin.ts        # one-time first super admin creation
│   ├── seed.ts                   # applies base/dev seeds with env guard
│   ├── backup-d1.sh / restore-d1.sh
│   └── check-env.ts              # validates bindings/vars/secrets presence
├── packages/
│   └── payments/                 # @kuzikode/payments: REUSABLE gateway library (npm workspace), see 06-PAYMENTS.md §0
│       ├── package.json  README.md  CHANGELOG.md  tsconfig.json  vitest.config.ts
│       ├── src/index.ts  src/types.ts (PaymentProvider, NormalizedStatus, …)  src/money.ts (minor↔major helpers)
│       ├── src/providers/pesepay/{client.ts, crypto.ts, mapper.ts, callback.ts, index.ts}
│       ├── src/providers/mock/index.ts
│       └── test/                 # unit tests (crypto vectors, status mapping, request building, callback parsing)
├── public/                       # static assets: brand/, fonts/, favicon, robots handled dynamically
├── src/
│   ├── worker.ts                 # fetch/queue/scheduled entry
│   ├── env.d.ts                  # Env bindings types (generated with `wrangler types` + extended)
│   ├── middleware.ts             # Astro middleware (session, security headers, cache headers)
│   ├── pages/
│   │   ├── index.astro  about.astro  contact.astro  products.astro
│   │   ├── services/index.astro  services/[slug].astro
│   │   ├── work/index.astro  work/[slug].astro
│   │   ├── legal/[slug].astro
│   │   ├── pricing.astro  start-a-project.astro  how-we-work.astro  faq.astro
│   │   ├── industries/index.astro  industries/[slug].astro
│   │   ├── insights/index.astro  insights/[slug].astro  insights/rss.xml.ts
│   │   ├── careers/index.astro  careers/[slug].astro  newsletter/confirm.astro
│   │   ├── sitemap.xml.ts  robots.txt.ts
│   │   ├── q/[token].astro  i/[token].astro  pay/return.astro
│   │   ├── admin/…               # login, dashboard, clients, leads, enquiries, services, quotations, invoices,
│   │   │                         # credit-notes, payments, projects, expenses, support, cms/*, reports, settings/*, notifications
│   │   └── portal/…              # login, accept-invite, reset, dashboard, quotations, invoices, payments, projects, support, profile
│   ├── layouts/                  # PublicLayout, AdminLayout, PortalLayout, DocumentLayout (public q/i links)
│   ├── components/
│   │   ├── ui/                   # shared primitives (Button, Input, Select, Dialog, Toast, Badge, Table, Pagination, EmptyState, Skeleton…)
│   │   ├── public/               # marketing sections
│   │   ├── admin/                # DataTable, FilterBar, LineItemEditor, MoneyInput, StatusBadge, KpiTile, charts…
│   │   └── portal/
│   ├── styles/                   # tokens.css (CSS vars), public.css, app.css (admin/portal), print.css
│   ├── shared/                   # code safe for browser AND server
│   │   ├── schemas/              # Zod schemas per module (request/response DTOs)
│   │   ├── types/                # shared TS types, enums (statuses)
│   │   ├── money.ts              # formatting only (client side), parsing user input to minor units
│   │   └── permissions.ts        # permission keys (string union) — single list
│   └── server/
│       ├── app.ts                # Hono app: middleware chain + module route mounting + error handler
│       ├── context.ts            # RequestContext { env, db, user, session, requestId, ip, now(), logger }
│       ├── middleware/           # requestId, securityHeaders, cors, csrf, auth, requirePermission, rateLimit, noStore
│       ├── lib/                  # errors.ts, logger.ts, ids.ts, crypto.ts, money.ts, pricing.ts, dates.ts, pagination.ts,
│       │                         # sequences.ts, audit.ts, r2.ts, turnstile.ts, uploads.ts, csv.ts, html-sanitize.ts
│       ├── db/                   # client.ts (D1 helpers, batch builder), row types
│       ├── modules/
│       │   ├── auth/             # login, logout, sessions, password reset, invitations, email verification
│       │   ├── users/            # staff users, roles, permissions
│       │   ├── clients/          # clients, contacts, client credits, portal access links
│       │   ├── leads/            # enquiries, leads, follow-ups
│       │   ├── services/         # service categories, services
│       │   ├── quotations/
│       │   ├── invoices/         # invoices, items, allocations, credit notes, reminders
│       │   ├── payments/         # attempts, payments, events, refunds, reconciliation (provider-agnostic)
│       │   ├── projects/         # projects, members, milestones, tasks, updates, files, messages
│       │   ├── expenses/
│       │   ├── support/
│       │   ├── cms/              # pages, sections, portfolio, products, announcements, media, SEO
│       │   ├── notifications/    # in-app notifications + preferences + dispatch to email
│       │   ├── reports/          # read-only aggregate queries
│       │   ├── settings/         # application settings, currencies, tax rates, numbering
│       │   ├── audit/            # audit log queries/export
│       │   ├── packages/         # service packages, features, add-ons, pricing page data
│       │   ├── subscriptions/    # recurring billing + managed services register (client_assets)
│       │   ├── careers/          # job postings, applications, retention/anonymisation
│       │   ├── content/          # insights posts, industries, FAQ, testimonials, technologies, newsletter
│       │   ├── timetracking/     # time entries, timers, billing to invoices
│       │   └── mfa/              # TOTP + backup codes
│       │   (each module: routes.ts · service.ts · repository.ts · policies.ts · index.ts)
│       ├── payments/             # thin app glue only: registry.ts (which providers are enabled, from DB + env)
│       ├── email/
│       │   ├── provider.ts  providers/resend.ts  providers/log.ts
│       │   └── templates/        # one file per template → { subject, html, text } (typed props)
│       ├── pdf/                  # layout primitives + quotation.ts invoice.ts receipt.ts credit-note.ts
│       └── jobs/
│           ├── outbox.ts         # enqueue(ctx, type, payload, idempotencyKey) — writes outbox row in caller's batch
│           ├── consumer.ts       # Queue consumer → handlers by job type
│           ├── handlers/         # send-email, generate-pdf, notify, payment-reconcile…
│           └── scheduled.ts      # cron: overdue sweep, reminders, reconciliation, outbox sweep, cleanup, backup marker
└── tests/
    ├── unit/  integration/  e2e/  fixtures/  helpers/
```

## 3. Layering rules

```
routes.ts (Hono)  /  .astro pages
      │  parse + validate (Zod), resolve ctx, check coarse permission
      ▼
service.ts        business rules, state machines, permission/ownership policy (policies.ts),
      │           builds atomic batches, audit entries, outbox jobs
      ▼
repository.ts     SQL only. Bound params. Returns typed rows. No business rules.
      ▼
D1 / R2 / providers (behind interfaces)
```

- Services take `ctx: RequestContext` first. They never read globals. `ctx.now()` is injectable for tests.
- Ownership checks live in `policies.ts` (e.g. `canViewInvoice(ctx, invoice)`). For portal users every
  repository method used by the portal takes `clientIds: string[]` and adds `WHERE client_id IN (…)`.
  Defence in depth: the scope is applied in SQL **and** checked in the policy.
- Modules talk to each other only via exported service functions (`modules/x/index.ts`). They never
  import another module's repository.
- `src/shared` must not import from `src/server`.

## 4. API conventions

- Base: `/api/v1`. Sub-routers: `/api/v1/admin/*` (staff session), `/api/v1/portal/*` (client session),
  `/api/v1/public/*` (no auth: contact form, public doc actions by token), `/api/payments/callbacks/:provider`,
  `/api/webhooks/:provider`, `/api/health`.
- JSON only. Success: `{ data, meta? }`. Error: `{ error: { code, message, fields? }, requestId }`.
  Codes: `VALIDATION_FAILED` 422, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404 (also used
  for resources the caller may not see, to avoid enumeration), `CONFLICT` 409, `RATE_LIMITED` 429,
  `PROVIDER_ERROR` 502, `INTERNAL` 500.
- Lists: `?page=1&pageSize=25&sort=-created_at&q=…&status=…` → `meta: { page, pageSize, total }`.
- Mutations accept an `Idempotency-Key` header (required on payment initiation, invoice issue, quotation
  convert, manual payment record). Stored in `idempotency_keys` with the response for 24 h.
- IDs: prefixed ULIDs/UUIDv7-like strings (`cli_…`, `inv_…`, `pay_…`), generated in `ids.ts`.
  Human numbers (`INV-2026-00001`) are separate columns.
- Timestamps: ISO-8601 UTC strings in DB (`TEXT`). Business dates (issue/due) as `YYYY-MM-DD`.
  Display timezone from settings (default `Africa/Harare`).

## 5. Background jobs

1. A service that needs async work calls `outbox.enqueue()`. That adds an `outbox` row
   (`status=pending`, unique `idempotency_key`) **to the same `batch()`** as the business change.
2. After the batch commits, the service sends `{ outboxId }` to the Queue (`ctx.waitUntil`).
3. The consumer loads the row, skips it if `status=done`, runs the handler, marks it `done` (or increments
   `attempts`, stores `last_error`, and `retry()`s with backoff). After max attempts the row is marked
   `failed`, a DLQ message is sent, and an admin notification is created.
4. Cron every 5 min: re-enqueue `pending` rows older than 2 min (covers lost sends, Queue outages, 24 h retention).
5. Email handler: the provider gets the outbox `idempotency_key` as the Resend `Idempotency-Key`
   header. `email_logs` has a unique `outbox_id`.

## 6. Caching

| Path | Cache-Control | Edge cache |
|---|---|---|
| Public pages | `public, max-age=0, s-maxage=300` + ETag | Cache API key includes `content_version`. Purge on publish by bumping the version. |
| `/_astro/*`, fonts, brand | `public, max-age=31536000, immutable` | Static assets |
| Public media `/media/:id` (published only) | `public, max-age=86400` | yes |
| `/admin/*`, `/portal/*`, `/api/*`, `/q/*`, `/i/*`, `/pay/*`, private files | `private, no-store` + `X-Robots-Tag: noindex, nofollow` | never |

## 7. Configuration

- `vars` in `wrangler.jsonc` per env: `APP_ENV` (`development`|`staging`|`production`), `PUBLIC_SITE_URL`,
  `TURNSTILE_SITE_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `PESEPAY_MODE` (`sandbox`|`production`), `PAYMENTS_MOCK_ENABLED` (`false` in staging/prod).
- Secrets (`wrangler secret put`): see `09-DEPLOYMENT.md` §4.
- `src/server/config.ts` validates the env with Zod at startup per request (cheap) and fails closed:
  for example, the mock provider is never selectable when `APP_ENV=production`.
- Business configuration (company info, numbering, currencies, taxes, provider enablement) lives in D1
  `application_settings`, edited via Admin → Settings, cached per-isolate for 60 s.
