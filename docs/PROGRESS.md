# Progress Log

The agent appends a new entry at the top after every task, and always before a session ends.
The **Next step** line must be specific enough that a fresh session can continue without guessing.

## Current status
- Phase: 1 — inspection & planning
- Phase: 2 complete → starting Phase 3 (public website)
- Last completed task: P3.9 (P3.1–P3.9 done; P1.6 done)
- **Next step:** P3.10 SEO: meta/canonical/OG/Twitter in `src/components/BaseHead.astro` (props: ogImage, type), JSON-LD helper (`src/components/JsonLd.astro`: Organization, WebSite, Service per division, BreadcrumbList, CreativeWork for case studies), `src/pages/sitemap.xml.ts` + `robots.txt.ts` (disallow /admin /portal /api /q/ /i/ /pay /dev), OG images (generated SVG→PNG at build in `public/brand/og/`), 404/500 pages (`src/pages/404.astro`, `500.astro`), `tests/e2e/public.spec.ts` SEO assertions. Then P3.11 edge cache, P3.12 packages/pricing.
- Staging URL: — (workers.dev subdomain `mhodieknowledge`) · Figma file: https://www.figma.com/design/xB9rBVFa7BKitPiUqcYdhh (non-exempt calls this month: ~3/15) · CI status: green (GitHub Actions run #1, verify + e2e, ~3 min)

---

## 2026-11-05 23:50 UTC — P1.6, P3.1–P3.9 public site
- P1.6 image pipeline (`npm run img:gen|img:process`, manifest, ResponsiveImage); home-hero processed. Workers AI daily neurons ran out
  after 5 images; remaining shots in P3.18 (fewer steps, or OPENAI_API_KEY).
- P3.1 CMS read layer (KV cache by content_version, sanitizer). P3.2 header/mega-menu/mobile dialog/footer. P3.3 home. P3.4 about.
  P3.5 services index + division pages. P3.6 our work + `/media/:id`. P3.7 products + interest form. P3.8 contact + public enquiry API
  (`/api/v1/public/enquiries`). P3.9 legal pages (5).
- Tests: unit ~180 / integration 77 / e2e 23 — all green; screenshots reviewed at 375/1440 for home, about, services, contact.

## 2026-11-05 22:40 UTC — P2.14–P2.17 files, UI kit, CI, 2FA
- P2.14: `lib/uploads.ts` (magic bytes incl. OOXML via ZIP central directory, SVG/HTML refused, per-purpose size caps, image dims),
  `modules/files` (random R2 keys, owner-based read auth → 404, portal scoping, signed 5–15 min links, financial download audit).
- P2.15: tokens + Tailwind theme, self-hosted fonts, React kit in `src/components/ui` (index.ts exports), Public/App/Admin/Portal/Document
  layouts, `/dev/ui` gallery (dev only). Playwright: axe clean, no horizontal scroll at 375/768/1440, screenshots reviewed. Added 700 text
  shades for badge contrast.
- P2.16: `.github/workflows/ci.yml` (verify + Playwright). First run green.
- P2.17: TOTP (RFC 6238 vectors), enrol/confirm/verify/disable/backup codes/admin reset, enforced in requireAuth with error `reason`
  (`password_change_required`, `mfa_required`, `mfa_enrolment_required`), login returns mfaRequired/mfaEnrolmentRequired.
- Tests: unit 151 / integration 65 / e2e 5. verify green.
- Notes: worker restarted mid-P2.17 once; no work lost. Ship with the scratchpad `ship.sh` (verify-gated).

## 2026-11-05 22:10 UTC — P2.10–P2.13 RBAC, bootstrap, jobs, email
- P2.10: `lib/policies.ts` (can/assertCan, portal scope → 404, clientScope SQL), users service (setUserRoles, disable/enable) with
  last-active-super-admin guards in SQL, conditional audit (`auditWhen`), session revocation on role change.
- P2.11: `npm run bootstrap:admin -- --env … --email … --name …` (+ `--reissue`), tested against an isolated local D1.
- P2.12: outbox consumer (atomic claim → at-most-once, backoff 30s…2h, 5 attempts, DLQ + admin notification + audit), `*/5` sweep,
  nightly retention pruning, minimal notifications service.
- P2.13: EmailProvider, Resend adapter (verified API: POST /emails, Idempotency-Key, reply_to), log adapter, branded layout + 5 auth
  templates (snapshots), `email.send` handler (email_logs per outbox row), dev mailbox `/admin/dev/mailbox` (404 outside development).
  `EMAIL_PROVIDER` var: log (local) / resend (staging, production).
- Tests: unit 128 / integration 58. verify green.
- Next step: P2.14.

## 2026-11-05 21:40 UTC — P1.5 mockups + P2.9 auth core
- Done: P1.5 mockups committed (design/mockups/README.md lists state; 7/12 pen.dev runs). P2.9: crypto (PBKDF2 100k, HMAC, AES-GCM,
  constant-time), password policy, cookies, D1 rate limits, Turnstile verify, auth module (login/logout/logout-all/me/sessions/password
  change/forgot/reset/verify email/invitations accept + buildInvitation/invite), middleware withAuth/requireAuth/csrfProtect/requirePermission,
  test helpers (factories, api client, login).
- Tests: unit 99 / integration 43 (generic errors, audiences, lockout, Turnstile after 3, rate limit 429, CSRF/Origin 403, immediate
  revocation, idle/absolute expiry, must-change-password, reset single-use + expiry, invite single-use, client invite scoping).
- CPU: PBKDF2 ≈ 21 ms per login (see DECISIONS).
- Next step: P2.10.

## 2026-11-05 21:05 UTC — P2.8 DB helpers
- Done: `db/client.ts` (Batch with labels, assertChanges, unique detection, chunk), `lib/sequences.ts` (formats, per-year keys, in-batch
  gap-free numbers, nextNumber, raise-only), `lib/pagination.ts` (allow-listed ORDER BY, LIKE escaping), `lib/dates.ts` (Africa/Harare),
  `lib/audit.ts` (redacted audit stmt), `jobs/outbox.ts` (enqueue in batch, idempotent; dispatch via waitUntil).
- Tests: unit 96 / integration 30 — 20 parallel numbers unique + gap-free (standalone and in-batch), failed batch leaves no gap.
- Next step: P2.9.

## 2026-11-05 20:45 UTC — P2.7 seeds
- Done: permissions + role matrix (`src/shared/permissions.ts`), seed generator + real copy (6 divisions, 37 sub-services, home/about/
  services/work/products/contact sections, settings, Business Suite product, expense categories, Paynow/PesePay accounts + USD route),
  `seeds/nonprod.sql`, fictional `seeds/dev.sql`, `scripts/seed.ts` with production guard (`npm run db:seed:local`).
- Tests: unit 88 / integration 19 (guard refuses prod dev seed; base twice = no duplicates; routes). verify green.
- Next step: P1.5 review, then P2.8.

## 2026-11-05 20:20 UTC — P2.6 initial migrations
- Done: migrations/0001–0009 covering every docs/04 table (+10b), indexes on FKs/filters, append-only audit trigger, financial guards.
- Tests: unit 80 / integration 17 (table inventory, unique, FK, CHECK, partial unique, audit trigger, line immutability, convert-once,
  testimonial consent, payment guards). Applies cleanly with `wrangler d1 migrations apply DB --local`.
- Next step: P2.7.

## 2026-11-05 20:00 UTC — P2.5 money & pricing core
- Done: shared money (minor units, half-even BigInt mul/div, allocation, parsing/formatting) + pricing engine (lines, discounts, doc discount
  allocation, inclusive/exclusive tax). Server re-exports.
- Tests: unit 80 passed (money/pricing suites per docs/08 §2) / integration 7. verify green.
- Next step: P2.6.

## 2026-11-05 19:45 UTC — P2.4 config & core libs
- Done: config.ts (Zod, fail-closed), errors.ts (AppError + mapping), logger.ts (redaction), ids.ts, context.ts, security-headers.ts,
  Hono requestContext + apiHeaders middleware + global onError/notFound, Astro middleware (headers, private no-store/noindex, ctx in locals).
- Tests: unit 38 / integration 7 passed. Checked with wrangler dev: page + /admin headers correct.
- Next step: P2.5.

## 2026-11-05 19:30 UTC — P2.1–P2.3 scaffold, worker entry, wrangler config
- Done: Astro 7 SSR + Cloudflare adapter 14 + React 19 + Tailwind 4, TS 6 strictest, ESLint 9 (ts, astro, jsx-a11y, react-hooks, no-only-tests,
  no .skip/.fixme), Prettier, .gitignore, .nvmrc, .dev.vars.example, npm scripts. `src/worker.ts` → `createWorker()` (Hono for /api/*, Astro
  handler otherwise, queue + scheduled exported). wrangler.jsonc with local/staging/production envs, all bindings, placeholders for remote IDs.
  `npm run preview:worker` serves `/`, `/api/health`, static assets (checked with curl). Staging dry-run deploy lists all bindings.
- Tests: unit 1 passed / integration 4 passed (health, page routing, queue ack, scheduled). verify green.
- Next step: P2.4.

## 2026-11-05 18:55 UTC — P1.4 brand & tool probe
- Done: Canva logo exploration (1 candidate, chosen), hand-built `public/brand/logo.svg`, `logo-white.svg`, `logo-mark.svg`, `favicon.svg`;
  `public/favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-512.png`, `icon-512-maskable.png`. Figma probe succeeded (file + colour variables).
  pen.dev authenticated.
- Next step: P1.5.

## 2026-11-05 18:40 UTC — P1.1–P1.3 inspection, external facts, conventions
- Done: P1.1 repo inspected: docs + CLAUDE.md + owner notes + `.claude/skills/pen-design`, empty `design/` folders, no code, no tooling,
  no package.json. Node 22.23.4 / npm 10.9.9 in the container. Env has (names only) CLOUDFLARE_API_TOKEN/ACCOUNT_ID, PAYNOW_USD_*,
  PAYNOW_TEST_AUTHEMAIL, RESEND_API_KEY, TURNSTILE_SITE_KEY/SECRET_KEY, PEN_CLI_KEY, PEN_CLAUDE_OAUTH_TOKEN, OPENAI_API_KEY. Connectors
  (Figma, Canva, Cloudflare) present. P1.2 versions + deviations logged in DECISIONS.md (TS 6.0 pin, vitest-plugin rename, adapter v14
  custom entry, per-env builds). P1.3 `docs/CONVENTIONS.md` written.
- Tests: none yet (no code).
- Next step: P1.4.

<!-- Entry template
## YYYY-MM-DD HH:MM UTC — <task id> <title>
- Done: …
- Tests: unit X passed / integration Y passed / e2e Z passed (durations)
- Notes / decisions: … (also logged in DECISIONS.md)
- Next step: <task id> — <exact next action, files involved>
-->

## 2026-11-05 · P3.12 Packages & Pricing page ✅
- Seed catalogue from docs/12 §A.2 (`scripts/seeds/content/packages.ts`): 24 packages with feature rows and comparison keys, 8 global add-ons, all `price_review_required = 1`. 8 pricing FAQs (`content/faq.ts`). CMS page `pricing` (intro + CTA).
- `src/server/modules/cms/packages.ts`: cached catalogue, server-side price redaction, `packagesForCategory`, `listFaqs`, `comparisonRows`. `faqLd` added to seo.ts. `/pricing` in sitemap.
- UI: `components/public/pricing/{PackageCard,ComparisonTable}.astro`, `src/pages/pricing.astro`, packages section on division pages.
- Tests: unit (package price wording), integration `packages.test.ts` (5, incl. switch-off test), e2e `pricing.spec.ts` (2, axe + 375/768/1440 screenshots reviewed).
- Next step: P3.13 Start-a-Project wizard at `/start-a-project` (reads `?package=`); "Get started" links already point there.

## 2026-11-05 · P3.13 Start-a-Project wizard ✅
- `/start-a-project` (CMS intro page `start-a-project`), React island `components/forms/StartProjectWizard.tsx`: 5 steps, `?package=` / `?category=` prefill, sessionStorage resume (try/catch), focus moves to each step heading, 422 errors jump to the owning step, live indicative estimate in a summary aside.
- Server: `projectRequestSchema` (shared), `submitProjectRequest` + shared `persistEnquiry` in `leads/enquiries.ts`, route `POST /api/v1/public/project-requests` (multipart, 11 MB cap).
- Tests: unit `wizard.test.ts` (6), integration `project-requests.test.ts` (6), e2e `start-a-project.spec.ts` (2, axe + screenshots reviewed).
- Admin "view brief nicely + Create quotation from brief" is part of the admin enquiries/quotations tasks (Phase 4); the brief JSON shape is `ProjectBrief` in `leads/enquiries.ts`.
- Next step: P3.14 Industries (index + 8 pages, docs/12 §C.3).

## 2026-11-05 · P3.14 Industries ✅
- Seed `scripts/seeds/content/industries.ts` (8 sectors, challenges, body, linked services checked at build). CMS page `industries`. Service `cms/industries.ts` (`listIndustries`, `getIndustry` with services + packages). Pages `/industries`, `/industries/[slug]`; sitemap entries.
- Tests: integration `industries.test.ts` (3), e2e `industries.spec.ts` (2: every page's service/package/wizard links resolve, axe, screenshots reviewed).
- Next step: P3.15 Insights blog (list, post, categories/tags, RSS, Article JSON-LD, scheduled publishing, 4 launch articles).
