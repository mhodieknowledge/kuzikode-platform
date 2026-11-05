# 02 — Technology Decisions (already made — do not re-litigate)

Owner goal: run on **free tiers** wherever that's responsible, on a **Cloudflare-native** stack.
Facts below were checked in November 2026. Re-check limits on the official pricing pages before
Phase 8 and update this file if they've changed.

## 1. Final stack

| Concern | Choice | Notes |
|---|---|---|
| Runtime / hosting | **Cloudflare Workers** (single Worker, Static Assets) | One deployable unit. `workers.dev` first, custom domain later. |
| Frontend framework | **Astro (latest stable major)** + `@astrojs/cloudflare` adapter, SSR (`output: 'server'`) | React islands only for interactive UI (tables, forms, editors, charts). |
| UI interactivity | **React** (latest stable) via `@astrojs/react` | Admin/portal islands. |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) + CSS variables for design tokens | No component-library theme defaults. Own primitives (see design doc). |
| Headless UI primitives | **Radix UI** primitives (dialog, dropdown, popover, tabs, toast) | Accessible behaviour; we style them. |
| Icons | **Lucide** (`lucide-react` / `lucide-static` for Astro) | One icon set everywhere, 1.5px stroke. |
| Charts | **Recharts** (admin only, lazy-loaded island) | |
| API | **Hono** on Workers, mounted at `/api/*` from the custom worker entry | |
| Validation | **Zod** (shared client/server schemas) + `@hono/zod-validator` | |
| Database | **Cloudflare D1** (SQLite) | See §3 — chosen over MongoDB. |
| Query layer | Hand-written SQL in repositories, typed rows. Optional: **Drizzle ORM** (D1 driver) for typed queries. Migrations stay plain SQL in `migrations/` managed by `wrangler d1 migrations`. | Agent's choice. Record it in DECISIONS.md. Raw SQL + types is acceptable and simpler. |
| Object storage | **Cloudflare R2** | Uploads, PDFs, deliverables, receipts, backups. |
| Cache / ephemeral | **Workers KV** (low-write data only) + **Cache API** | KV free tier = 1,000 writes/day. Never put sessions or rate-limit counters in KV. |
| Background jobs | **Cloudflare Queues** (free plan since Feb 2026) + **D1 outbox table** | Outbox = source of truth. Queue = dispatcher. Cron sweeps the outbox if a message is lost. |
| Scheduled jobs | **Cron Triggers** | Overdue detection, reminders, payment reconciliation, cleanup. |
| Email | **Resend** behind an `EmailProvider` interface | Free: 3,000 emails/month, 100/day, 1 domain. |
| Bot protection | **Cloudflare Turnstile** (free) | Contact form, login, password reset, registration. |
| PDF | **pdf-lib** (pure JS, Workers-compatible) | Standard fonts by default; embed brand font subset only if CPU budget allows. |
| Site imagery (dev-time only) | **Cloudflare Workers AI** REST API from a dev script + **sharp** (devDependency) for optimisation | ~20 images generated once and committed. Not a runtime feature. See `13-IMAGERY.md` |
| 2FA | TOTP (RFC 6238) via WebCrypto HMAC-SHA1, secrets AES-GCM-encrypted with `DATA_ENCRYPTION_KEY` | No external service |
| Booking (optional) | Cal.com free link/embed if configured, else built-in request form | |
| Payments | `@kuzikode/payments` package: `PaymentProvider` interface → **Paynow** adapter (launch: redirect + express checkout), **PesePay** adapter (alternative), **Mock** (dev/test). DB-driven routing per app/currency/method | See `06-PAYMENTS.md`. |
| Unit/integration tests | **Vitest** + **`@cloudflare/vitest-pool-workers`** (real workerd + local D1/R2/KV/Queues) | |
| E2E tests | **Playwright** against `wrangler dev` on a seeded local DB | |
| Lint/format | **ESLint** (typescript-eslint, astro, jsx-a11y) + **Prettier** | |
| CI/CD | **GitHub Actions** + `wrangler` (cloudflare/wrangler-action) | |
| Package manager | **npm** (lockfile committed), Node LTS (22+) | |

Use the **current stable** versions at install time. Check the Astro Cloudflare adapter docs for the
current way to export `queue` and `scheduled` handlers alongside Astro's `fetch` (as of adapter 12.6
this is `workerEntryPoint` / a custom entry file calling `handle` from `@astrojs/cloudflare/handler`;
newer majors may differ). Record the exact versions in DECISIONS.md.

## 2. Free-tier budget and its consequences

| Service | Free allowance (verify) | Design consequence |
|---|---|---|
| Workers | 100k requests/day, **10 ms CPU per invocation** | CPU is the tight constraint. See §4. |
| D1 | 5 GB storage, 5M rows read/day, 100k rows written/day | Index every filter column. Paginate everything. No `SELECT *` on big tables. |
| R2 | 10 GB, 1M Class A / 10M Class B ops per month, free egress | Needs a payment method on the Cloudflare account to enable (still $0). |
| KV | 100k reads/day, **1k writes/day** | Only for things written rarely: rendered public page cache keyed by content version, feature flags, config snapshot. |
| Queues | 10k operations/day, 24h retention on Free | Fine for this traffic. Outbox + cron sweep covers anything lost after 24h. |
| Cron Triggers | Free (limited number per Worker) | Use one or two cron schedules and dispatch by `event.cron`. |
| Turnstile | Free | |
| Workers AI | 10,000 neurons/day (≈ 15 Lucid Origin 1024² images/day) | Enough to produce the ~20 site images over 2 days |
| Resend | 3,000/month, 100/day, 1 verified domain | Needs a verified sending domain (DNS) → blocked until kuzikode.com exists. Before that, Resend's test sender can only mail the account owner. |
| Paynow test mode | Free | New integrations start in test mode. Test phone numbers simulate success, delay, cancel and insufficient funds. Live after "Request to be Set Live" |
| PesePay test env (optional) | Free | USD only. Only needed if you want to live-test the alternative adapter |
| GitHub Actions | Free minutes for public repos, 2,000 min/month for private | Keep CI fast. Cache npm. |

## 3. Why D1 and not MongoDB (owner suggested "Mongo or any other")

Decision: **Cloudflare D1.** Reasons:
1. This is a **financial system**: invoices, payments, credit notes, numbering. Relational integrity
   (foreign keys, unique constraints, CHECK constraints, atomic batches) is what keeps money correct.
   Document databases make these guarantees harder.
2. D1 is a **native Worker binding**: no connection strings, no TCP connection setup per request, no
   cold-connection CPU cost (which matters a lot under a 10 ms CPU budget).
3. Free tier (5 GB) is roughly 10× MongoDB Atlas M0 (512 MB), with Time Travel point-in-time restore.
4. One vendor, one deploy, one set of credentials. That matches the owner's "cohesive Cloudflare project" requirement.

D1 caveats to design around: single-writer SQLite (fine at this scale), no interactive transactions
(use `batch()`), 100 bound parameters per statement limit (chunk bulk inserts), max row/statement
sizes (keep large blobs in R2), eventual consistency on read replicas if enabled (use the Sessions API
or primary for read-after-write in financial flows).

## 4. The 10 ms CPU limit — the main free-tier risk

The Workers **Free** plan caps CPU time per request at 10 ms (I/O waiting does not count). Things that
can exceed it: password hashing, PDF generation, SSR of heavy pages, large JSON processing.

Mitigations (implement all):
- **Password hashing:** PBKDF2-SHA256 through WebCrypto (native, fast). Workers caps PBKDF2 at
  100,000 iterations, so use 100,000. Benchmark it in Phase 2 with `wrangler dev` + `wrangler tail`.
  Login is rare, and occasional bursts over the limit are usually tolerated, but measure it.
- **PDFs:** generate in the **queue consumer** (or on first download), store in R2, serve from R2 after.
  Never regenerate an issued document. Use standard PDF fonts first.
- **Public pages:** SSR the HTML, cache it with the Cache API / KV keyed by `content_version`.
  Bump the version when the CMS publishes. Pages that never change (legal pages) are prerendered.
- **Admin pages:** Astro renders a light shell. Data loads from JSON APIs into islands.
- Paginate and index everything. Keep responses small.

**Recommendation recorded for the owner (BLOCKERS.md):** Free plan is fine for development and staging.
For production with real payments, **Workers Paid ($5/month)** is strongly recommended. It removes the
10 ms CPU cap (30 s default) and raises every other limit. The code must work on both plans.

## 5. Things explicitly NOT used
- No VPS, Node server, PostgreSQL, MongoDB, Redis, Firebase, Supabase.
- No SMTP from Workers.
- No Puppeteer/Chromium PDF rendering (Browser Rendering is a paid/limited service and is unnecessary).
- No UI kits that impose their own look (no default shadcn theme, MUI, Bootstrap). Radix primitives styled by us are fine.
- No analytics trackers that set cookies. Cloudflare Web Analytics (cookieless, free) is allowed on public pages only.
