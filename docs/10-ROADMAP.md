# 10 — Implementation Roadmap

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked externally (see BLOCKERS.md, finish everything else first).
Work top to bottom. A task is done only when its **AC** (acceptance criteria) are met, tests exist and pass,
`npm run verify` is green, and the change is pushed to `main`. Tick the box in the same commit.

---

## Phase 1 — Inspection & planning
- [x] **P1.1 Inspect repo.** List existing files and tooling. Keep useful work, and note what you keep or replace in DECISIONS.md. AC: PROGRESS.md entry with findings.
- [x] **P1.2 Verify external facts.** Re-check (WebFetch) current Astro + `@astrojs/cloudflare` major + custom entry/queue/scheduled pattern, Tailwind v4 + Astro setup, vitest-pool-workers setup, Paynow developer docs (initiate, express checkout, status update, hash, polling, test mode) + PesePay llms-full.txt, Resend API + idempotency + webhooks, Turnstile test keys, Workers free limits. AC: DECISIONS.md lists versions and any deviation from docs/02.
- [x] **P1.3 Coding conventions.** Create `docs/CONVENTIONS.md` (naming, module layout, error codes, commit style, test naming). AC: file exists and matches docs/03.
- [x] **P1.4 Brand & tool probe.** Canva logo exploration → chosen direction → hand-built SVG logo set + favicons. Figma capability probe (docs/11 §3). pen.dev auth check (`pen status`). AC: logo SVGs committed. Each tool's status recorded in DECISIONS.md. BLOCKERS entries for any unavailable tool.
- [ ] **P1.5 Mockups (pen.dev).** Write briefs in `design/briefs/` from PRD content, then generate the 6 key screens (docs/11 §1, ≤ 12 runs), review each PNG against docs/05. AC: `design/mockups/*.png` committed and referenced in PROGRESS.md. If pen.dev is unavailable → `[!]` and continue (Phase 2 doesn't depend on it).

- [ ] **P1.6 Imagery pipeline.** Verify Workers AI image models + input schemas, build the small dev script `scripts/images/*` (generate/process), manifest, `ResponsiveImage` component, prompt files. Generate 3 test images (1 person scene, 1 object, 1 abstract), Read them, record which model works best for each type. AC: docs/13 §2 tooling works end to end. Results in DECISIONS.md. `[!]` only the generation part if no token (pipeline still built).

## Phase 2 — Foundation
- [x] **P2.1 Scaffold.** Astro (SSR, Cloudflare adapter), React, Tailwind v4, TS strict, ESLint (incl. jsx-a11y, no-only-tests), Prettier, `.gitignore`, `.dev.vars.example`, `.nvmrc`, npm scripts from docs/08 + docs/09. AC: `npm run verify` green on a hello page. `npm run preview:worker` serves it.
- [x] **P2.2 Custom worker entry.** `src/worker.ts` routes `/api/*` → Hono, rest → Astro. Exports `queue` and `scheduled`. AC: integration test hits `/api/health` and `/`. Queue + cron handlers are invokable in tests.
- [x] **P2.3 wrangler.jsonc** with local/staging/production envs and all bindings (placeholders for remote IDs). `wrangler types`. AC: `wrangler deploy --dry-run --env staging` succeeds.
- [x] **P2.4 Config & core libs.** `config.ts` (Zod env validation), `errors.ts`, `logger.ts` (redaction), `ids.ts`, `context.ts`, global error handler, request ID, security headers, no-store middleware. AC: unit tests for redaction + error mapping. Headers test passes.
- [x] **P2.5 Money & pricing core.** `money.ts`, `pricing.ts` (lines, discounts, taxes, totals) shared by quotes/invoices/credit notes/PDF/UI. AC: unit test suite from docs/08 §2 money/pricing passes.
- [x] **P2.6 Initial migrations.** All tables in docs/04 (split into logical migration files), audit trigger, indexes. AC: migrations apply to empty local D1 in tests. Constraint tests (unique/FK/check) pass.
- [x] **P2.7 Seeds.** `base.sql` (roles, permissions, currencies, sequences, service divisions & sub-services with real copy, CMS defaults with real copy, Business Suite product, expense categories, providers) and `dev.sql` (fictional). `seed.ts` refuses production for dev seed. AC: test that the guard refuses. Seeds are idempotent (run twice).
- [x] **P2.8 Repositories/DB helpers.** D1 client wrapper, batch builder, pagination helper, sequences (`nextNumber`), audit helper, outbox enqueue. AC: **concurrency test: 20 parallel numbers → unique & gap-free.**
- [ ] **P2.9 Auth core.** PBKDF2 hashing, sessions (two audiences), login/logout, CSRF, Origin check, rate limiting, lockout, must-change-password, password reset, email verification, invitations (staff & client). AC: integration tests from docs/07 §12 for auth pass. CPU timing for login recorded.
- [ ] **P2.10 RBAC.** Permission keys, role matrix seed, `requirePermission`, policies helpers, portal client scoping helper. AC: role-matrix tests pass. Last super admin protected.
- [ ] **P2.11 Bootstrap script.** `npm run bootstrap:admin` per docs/07 §9. AC: works against local D1. Refuses second run. Forced password change works.
- [ ] **P2.12 Jobs infrastructure.** Queue consumer, outbox sweep cron, retries/backoff, DLQ handling, admin alert on failure. AC: duplicate delivery → one execution. Failure → retry → failed + notification.
- [ ] **P2.13 Email abstraction.** `EmailProvider`, Resend adapter (idempotency header), log adapter, dev mailbox viewer (dev only), base branded template (HTML + text). AC: integration test via outbox. Resend adapter unit-tested with mocked fetch.
- [ ] **P2.14 Files/R2.** Upload pipeline (size, magic bytes, allow-list, random keys), authorised download route, signed short-lived URLs, image metadata. AC: spoofed-type and SVG uploads rejected. Unauthorised download → 404.
- [ ] **P2.15 UI foundation.** tokens.css, fonts, Tailwind theme, all `ui/` primitives from docs/05 §5, Public/Admin/Portal layouts, toast system, confirm dialog, DataTable, FilterBar, Pagination, Empty/Loading/Error states, logo + favicons. AC: a `/dev/ui` kitchen-sink page (dev only) renders every component. axe clean. Screenshots reviewed.
- [ ] **P2.16 CI.** `ci.yml` running verify + e2e. AC: green run on GitHub (or documented blocker if Actions unavailable).
- [ ] **P2.17 Two-factor authentication** (TOTP + backup codes, mandatory for super admin/finance). AC: docs/12 §D + docs/07 §5b tests.

## Phase 3 — Public website
- [ ] **P3.1 CMS read layer.** Services for pages/sections/services/portfolio/products/announcements/settings with published-content reads + content_version cache. AC: cache invalidation test on version bump.
- [ ] **P3.2 Public layout.** Header nav (+ mobile sheet), announcement banner, footer from settings (hidden blanks), skip link. AC: Playwright nav test at 3 widths.
- [ ] **P3.3 Home page** with all sections from PRD §3.1 (Selected Work hidden when empty). AC: visual QA gate (docs/05 §8).
- [ ] **P3.4 About page.** AC: all blocks come from the CMS. Visual QA.
- [ ] **P3.5 Services index + 6 division pages** (sub-services, benefits, deliverables, pricing model display, FAQ, CTA with preselection, coming-soon/inactive behaviour). AC: tests for status behaviour. Visual QA.
- [ ] **P3.6 Our Work** grid + filter + case study pages + empty state. AC: published/draft visibility test.
- [ ] **P3.7 Products page** (Business Suite "In Development", optional interest form). AC: no purchase/subscribe wording (test greps rendered HTML).
- [ ] **P3.8 Contact** form + server endpoint (Turnstile, honeypot, rate limit, Zod) → enquiry + notifications + emails + reference shown. AC: integration + e2e tests.
- [ ] **P3.9 Legal pages** (privacy, terms, cookies) with real draft text. AC: linked from the footer. BLOCKERS.md asks for legal review.
- [ ] **P3.10 SEO.** Meta/canonical/OG/Twitter, JSON-LD, dynamic sitemap.xml, robots.txt, OG images (Canva or generated SVG→PNG at build), 404/500 pages. AC: public.spec.ts SEO assertions. Lighthouse targets met on mobile.
- [ ] **P3.11 Public cache layer.** Edge cache keyed by content_version, correct headers. AC: header tests. Private paths never cached.
- [ ] **P3.12 Packages & Pricing page.** Seed catalogue (docs/12 §A.2), packages on division pages, `/pricing` with tabs + comparison table (stacked on mobile) + FAQ, show-prices switch. AC: visual QA. Switch test. "Get started" opens the wizard prefilled.
- [ ] **P3.13 Start-a-Project wizard** (5 steps, indicative range, attachment, brief JSON → enquiry). AC: integration + e2e.
- [ ] **P3.14 Industries** index + 8 pages with real copy. AC: visual QA. Links to services/packages resolve.
- [ ] **P3.15 Insights blog** (list, post, categories/tags, RSS, Article JSON-LD, scheduled publishing) + 4 launch articles written by you. AC: RSS validates. Articles contain no invented statistics.
- [ ] **P3.16 How we work, FAQ (≥ 20 items + FAQPage schema), testimonials block (hidden when empty), technologies strip, service terms + accessibility pages, site search.** AC: tests per docs/08 additions.
- [ ] **P3.17 Engagement widgets:** WhatsApp chat button, consultation booking (Cal.com link or request form), newsletter double opt-in. AC: each hidden when unconfigured. Opt-in flow tested.
- [ ] **P3.18 Site imagery.** Generate the ~20 images in the docs/13 §4 shot list (one-time, dev-only), review each, optimise, commit, place with `ResponsiveImage` + alt text. AC: every slot filled or deliberately imageless. Honesty rules met. Lighthouse still meets targets.
- [ ] **P3.19 Careers (public)**: /careers, posting pages, application form, JobPosting JSON-LD, nav promotion when roles are open. AC: docs/08 careers tests.

## Phase 4 — Administration
- [ ] **P4.1 Admin shell.** Login page (Turnstile after failures), forced password change, sidebar grouped by permission, top bar, ⌘K global search (clients, invoices, quotations, projects by number/name), notifications bell, user menu, sessions page. AC: permission-filtered nav test.
- [ ] **P4.2 Users & roles.** Invite staff, deactivate, assign roles, permissions matrix view (super admin edits custom roles), audit. AC: tests for each guard.
- [ ] **P4.3 Settings.** Company, branding/logo, addresses/contacts, socials, numbering, currencies, taxes, providers (status only for secrets), email status + test send, notification prefs. AC: numbering can't be lowered. All changes audited.
- [ ] **P4.4 Clients** (CRUD, contacts, notes, tags, archive, detail tabs, credits balance, portal access tab: invite contact, approve/revoke links). AC: integration tests + e2e step 3.
- [ ] **P4.5 Enquiries & leads** (inbox, triage, spam, lead pipeline list + board view, assignment, follow-ups, activities, convert to client). AC: e2e step 2. Conversion test.
- [ ] **P4.6 Services management** (categories, services, pricing models, statuses, featured, drag sort, SEO). AC: changes appear on public site after publish.
- [ ] **P4.7 Quotations** (editor with LineItemEditor, versions, send, PDF, public link, accept/reject, expire cron, duplicate, void, convert to invoice idempotent, create project). AC: docs/08 tests incl. concurrent convert.
- [ ] **P4.8 PDF engine** (pdf-lib layout kit, branding, quotation/invoice/receipt/credit note, TEST watermark outside prod, R2 storage, never regenerate issued docs). AC: PDF tests. CPU timing recorded.
- [ ] **P4.9 Invoices** (draft editor, issue with snapshot + number + token, send/resend, PDF, manual payments, allocations, overpayment → credit, apply client credit, void rules, status history, overdue cron, reminders schedule with dedupe). AC: all invoice tests in docs/08.
- [ ] **P4.10 Credit notes** (from invoice, full/partial, numbering, PDF, effect on balance/credits/refund). AC: balance tests.
- [ ] **P4.11 Payments admin** (list/filter/detail timeline, reconcile button, unmatched queue, manual refund recording). AC: tests.
- [ ] **P4.12 Projects** (CRUD, from quotation, members, milestones, tasks board/list, progress auto/manual, internal notes, client updates + notify, files/deliverables, messages, activity). AC: e2e step 15.
- [ ] **P4.13 Expenses** (CRUD, categories, receipts, void, reports, CSV). AC: tests.
- [ ] **P4.14 Support inbox** (threads, internal notes, assignment, statuses, attachments). AC: tests.
- [ ] **P4.15 CMS editors** (pages/sections draft→preview→publish, portfolio, products, announcements, legal, SEO fields, media library with alt text required, publish bumps content_version). AC: preview doesn't leak drafts publicly.
- [ ] **P4.16 Notifications** (in-app list, read/unread, preferences, email dispatch per prefs, all types in PRD §4.2 J). AC: one test per type trigger.
- [ ] **P4.17 Dashboard** (KPIs per currency, charts, recent lists, permission-filtered tiles). AC: figures match fixtures exactly in a test.
- [ ] **P4.19 Packages & pricing admin** (packages, features, add-ons, comparison order, price-review flag + dashboard warning, "Add package" in quotation editor). AC: price-copy test.
- [ ] **P4.20 Subscriptions & recurring billing** + **managed services register** with renewal reminders and portal "Your services". AC: double-run cron test. MRR tile correct.
- [ ] **P4.21 Careers admin** (postings, custom questions, pipeline kanban, ratings, notes, templated emails, bulk reject, retention job, Hiring Manager role). AC: tests.
- [ ] **P4.22 Content admin** for insights, industries, FAQ, testimonials (consent enforced), technologies, newsletter list/export. AC: tests.
- [ ] **P4.23 Time tracking** (entries, timer, timesheet, bill unbilled time to invoice). AC: concurrent billing test.
- [ ] **P4.18 Reports & export** (revenue, ageing, conversion, expenses, indicative profit, CSV, data export per module, audit log viewer + export). AC: tests on aggregates.

## Phase 5 — Client portal
- [ ] **P5.1 Portal auth UX** (accept invite, login, reset, verify email, sessions, profile, optional approved registration flow off by default). AC: tests + no auto-linking by email.
- [ ] **P5.2 Portal overview** (outstanding balance per currency, open quotations, active projects, recent activity). AC: visual QA.
- [ ] **P5.3 Quotations** (list, view, PDF, accept/reject). AC: isolation tests.
- [ ] **P5.4 Invoices & credit notes** (list, view, PDF, Pay now). AC: isolation tests.
- [ ] **P5.5 Payments & receipts** (history, receipt PDFs, attempt status page). AC: tests.
- [ ] **P5.6 Projects** (milestones, client updates, progress, deliverables download, messages). AC: internal items never visible (test).
- [ ] **P5.7 Support** (create, reply, attachments, status). AC: tests.
- [ ] **P5.8 Public document pages** `/q/:token`, `/i/:token`, `/pay/return`. AC: token tests, noindex/no-store.

## Phase 6 — Payments & email integrations
- [ ] **P6.1 `packages/payments` workspace package** (interface, types, money helpers, adapter conformance kit, mock provider, README + extraction guide + "writing a new adapter" guide, own tests in CI) + app router (accounts + routes) + mock checkout page. AC: mock unreachable in production config (test).
- [ ] **P6.2 Payments service** (initiate, attempts reuse, callback endpoint, verify, apply, state machine, reversal, overpayment, idempotency). AC: all docs/06 §5 tests.
- [ ] **P6.3 Paynow adapter (launch)**: redirect + express (EcoCash, OneMoney, InnBucks, O'mari OTP), SHA-512 hash in/out, polling, mapper, redaction. AC: docs' hash vectors pass, conformance kit passes, mocked-HTTP integration tests.
- [ ] **P6.3b PesePay adapter (alternative)**: AES-256-CBC, initiate, check, mapper. AC: conformance kit passes. Test that switching the route from Paynow to PesePay changes only new attempts.
- [ ] **P6.3c Admin: payment accounts & routing** (Super Admin): accounts list with credentials found/missing, mode, methods; routes editor per app/currency/method; audited. Portal "Pay now" shows the methods for the routed account.
- [ ] **P6.3d Custom checkout page** (docs/06 §3b): our branded page for all methods (EcoCash/OneMoney prompt, InnBucks code + QR + deep link, O'mari OTP, bank transfer, card hand-off that returns to our page), live status, receipt download, no provider-specific code in the page. AC: §3b Playwright tests, axe clean, 375 px screenshots reviewed.
- [ ] **P6.3e Paynow cards on our checkout** (docs/06 §3b): new-card secure popup with `tokenize=true` + `/pay/card-return` postMessage page + same-tab fallback, saved cards (encrypted tokens, portal management), saved-card express payments with `merchanttrace`, opt-in auto-charge for subscriptions. AC: mock tests for every path. Token never reaches browser/logs. Live check in Paynow test mode with test card tokens.
- [ ] **P6.4 Reconciliation** (cron + admin button + backoff + expiry). AC: missed-callback test.
- [ ] **P6.5 Paynow test-mode verification** (`npm run test:payments:live` with test numbers 0771111111 / 0773333333 / 0774444444 against staging + one manual redirect payment with "Faked Success"). AC: results recorded. `[!]` if no Paynow test credentials, with BLOCKERS entry.
- [ ] **P6.6 All email templates** (PRD §7) HTML + text, rendered preview page (dev), snapshot tests. AC: every template has a test.
- [ ] **P6.7 Resend webhooks** (signature verification, status updates). AC: tests with signed fixtures.
- [ ] **P6.8 Live email verification** with a real Resend key on staging. AC: delivered email recorded. `[!]` if no key.

## Phase 7 — Quality assurance
- [ ] **P7.1 Full E2E journey** (docs/08 §4) green.
- [ ] **P7.2 Security suite** green. Run the `/security-review` skill (if available) or a manual OWASP pass over auth, portal scoping, uploads, payments. Fix all findings.
- [ ] **P7.3 Responsive + accessibility pass** on every page (3 widths, axe, keyboard).
- [ ] **P7.4 Performance pass** (Lighthouse targets, bundle sizes, CPU timings documented).
- [ ] **P7.5 Placeholder sweep** (grep for TODO, lorem, `href="#"`, `console.log`, disabled-forever buttons, fake numbers). AC: script `npm run check:placeholders` in CI.
- [ ] **P7.6 Link check + migration check.**

## Phase 8 — Production preparation
- [ ] **P8.1 Remote resources** (staging, plus production resources creation if a token exists). Real IDs into wrangler.jsonc. `[!]` without a token.
- [ ] **P8.2 Deploy staging** via CI + migrations + base seed + bootstrap admin (credentials go to the owner via BLOCKERS.md instructions, never committed) + smoke tests.
- [ ] **P8.3 deploy-production + backup workflows** (manual production, nightly encrypted backup).
- [ ] **P8.4 Backup/restore drill** executed and recorded.
- [ ] **P8.5 Docs:** `README.md` (overview, local setup), `docs/RUNBOOK.md` (deploy, migrate, rollback, restore, rotate secrets, incident basics), `docs/ADMIN-GUIDE.md` (owner onboarding: first login, settings, inviting staff/clients, invoicing, payments), `docs/PAYMENTS-ONBOARDING.md` (Paynow merchant account, integration keys, test mode → "Request to be Set Live", per-currency integrations, how to switch to or add PesePay by adding an account + route), `docs/EMAIL-SETUP.md` (Resend domain + DNS), `docs/PRODUCTION-CHECKLIST.md`.
- [ ] **P8.6 Figma sync** of final screens for owner review (only if the P1.4 probe succeeded; docs/11 §3). Otherwise put the final Playwright screenshots in `docs/screenshots/`.
- [ ] **P8.7 FINAL-REPORT.md** per PRD §19, with real test numbers and an honest status of what's live/blocked.
