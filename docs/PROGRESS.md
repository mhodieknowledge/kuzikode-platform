# Progress Log

The agent appends a new entry at the top after every task, and always before a session ends.
The **Next step** line must be specific enough that a fresh session can continue without guessing.

## Current status
- **Redesign mission (docs/redesign/ROADMAP.md) started 2026-11-12.** See the newest "Redesign" entries at the bottom for the next step.
- Phases 1–5 complete except **P3.18 site imagery** (Workers AI daily quota; retry later). Phase 6 (payments & email) in progress.
- Last completed task: **P7.6 Link check + migration check** (2026-11-11). Phase 7 done. Phase 6 done except P6.5 `[!]` (owner's Faked Success). P6.5 is `[!]` (Faked Success needs the owner, staging re-run in P8.2). Saved cards wait on Paynow approving tokenization (BLOCKERS).
- **Status (2026-11-12 00:10 UTC): roadmap complete.** All tasks `[x]` except P6.5 `[!]` (owner's Paynow Faked Success). Staging
  deployed and smoke-verified; production waits for the owner (docs/PRODUCTION-CHECKLIST.md). FINAL-REPORT written.
- Previous next step (done): **Phase 8, P8.1 Remote
  resources** (docs/09; `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` exist in the build env): create only `kuzikode-*` resources
  (staging D1, R2, KV, Queue), put real IDs into wrangler.jsonc, record in PROGRESS. Then P8.2 staging deploy + smoke tests.
  State on 2026-11-11 21:40 UTC: `wrangler d1 list` shows no `kuzikode-*` database yet; wrangler.jsonc still has
  `<STAGING_D1_ID>`, `<STAGING_KV_ID>`, `<PROD_*>` placeholders (docs/09 §2–3 list every resource and name).
- **For P8.2 (staging):** send a test email from staging (Admin → Settings → email test) and confirm `delivered` arrives through the
  Resend webhook once the owner has configured it (BLOCKERS); re-run `LIVE_RESULT_URL=https://<staging>/api/payments/callbacks/paynow/<accountId> npm run test:payments:live`
  so Paynow's result URL is reachable, and record it.
- Staging URL: — (workers.dev subdomain `mhodieknowledge`) · Figma file: https://www.figma.com/design/xB9rBVFa7BKitPiUqcYdhh · CI: green on main
- New entries are appended at the **bottom** of this file.


## 2026-11-12: NEW MISSION, UI/UX reconstruction
- Owner brief: `docs/redesign/BRIEF.md`. Roadmap: `docs/redesign/ROADMAP.md`. Old design docs (05-DESIGN-SYSTEM, 11-DESIGN-TOOLS,
  13-IMAGERY, design/briefs, design/mockups, PROMPT-PACK) removed on purpose. Design skills installed in `.claude/skills/`.
- **Next step:** R0.1 skills check, then R0.2 audit and R0.3 the 29 inspiration images.

## 2026-11-12 11:50 UTC: OWNER STOP, design reset
- The owner rejected the first foundation as a generic "dead UI" (navy hero, blue pill buttons with round arrow knobs, pill tabs).
  The session was stopped. New rules: BRIEF B.0b (no blue), B.0c (no wizard), **B.0d (concept gate + anti-generic list + side-by-side
  boards + reviewer subagent)**. R1.1, R2.1–R2.4 and R3.1–R3.2 are reopened.
- Research (R0.x) and specs (R1.2) stay valid where they don't conflict with B.0b/B.0d. The code in `src/ui/` is replaced from the new concept.
- **Next step:** R1.5 visual concept gate. Open the inspiration image files themselves, then build 3 concepts with comparison boards.
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

## 2026-11-05 · P3.15 Insights ✅
- Content `scripts/seeds/content/insights.ts` (4 categories, 8 tags, 4 launch articles). CMS page `insights`. Service `cms/insights.ts` (listPosts, findPosts, getPost, relatedPosts, publishDuePosts, articleLd, renderRss). Cron task `publish-due-posts` on `*/5`.
- Pages: `/insights`, `/insights/[slug]`, `/insights/category/[slug]`, `/insights/tag/[slug]`, `/insights/rss.xml`; sitemap entries; components `components/public/insights/{PostCard,PostCover,InsightsListing}.astro`.
- Tests: integration `insights.test.ts` (4), e2e `insights.spec.ts` (3; RSS parsed with DOMParser, all item links resolve; axe; screenshots reviewed).
- Hand-off note: `create_session` with permission_mode auto is refused because this session runs in "default" mode, so this session continues the loop itself.
- Next step: P3.16 How we work, FAQ page (≥ 20 items + FAQPage schema, categories, search filter), testimonials block (hidden when empty), technologies strip, site search. Service terms + accessibility pages already exist (P3.9). 8 pricing FAQs already seeded (`content/faq.ts`).

## 2026-11-05 · P3.16 How we work, FAQ, testimonials, technologies, search ✅
- `/how-we-work` (CMS page with process, engagement models, expectations, quality practices, CTA), `/faq` (24 FAQs in 5 categories, FAQPage JSON-LD, progressive filter, deep links open answers), `/search` (header icon + mobile form), testimonials block on home (renders nothing unless published, consented testimonials exist), technologies strip on home and how-we-work. Service terms + accessibility pages were done in P3.9.
- Services: `cms/content.ts` (listAllFaqs, listTechnologies, listTestimonials), `cms/search.ts` (searchSite).
- Fix: edge page-cache key includes the build ID (stale HTML after deploy).
- Tests: integration `site-content.test.ts` (4), e2e `site-content.spec.ts` (4); screenshots reviewed.
- Next step: P3.17 Engagement widgets: WhatsApp chat button (`contact.whatsapp_number`, hidden when unset), consultation booking (`booking.cal_url` link, else request form with 3 preferred slots → enquiry kind `consultation`, already supported by `submitEnquiry`), newsletter double opt-in (`newsletter_subscribers` table exists in 0008).

## 2026-11-05 · P3.17 Engagement widgets ✅
- WhatsApp: `components/public/WhatsAppButton.astro` + `whatsappHref` (shared), `whatsappMessage` prop on PublicLayout.
- Consultation: `/consultation` (Cal link when `booking.cal_url` set, else `ConsultationForm` island → enquiry kind `consultation` with preferredTimes); linked from /contact.
- Newsletter: module `server/modules/newsletter` (subscribe, confirmSubscription, unsubscribeUrl/unsubscribe, pruneUnconfirmed nightly), `POST /api/v1/public/newsletter`, pages `/newsletter/confirm`, `/newsletter/unsubscribe`, footer `NewsletterForm` island (client:idle), email template `newsletter_confirmation`, `lib/same-origin.ts`.
- Admin subscriber list + CSV export (with unsubscribe URLs via `unsubscribeUrl`) belongs to the Phase 4 CMS/admin tasks.
- Tests: unit (whatsappHref), integration `newsletter.test.ts` (5), e2e `engagement.spec.ts` (4). Full e2e suite: 42 passed.
- Next step: P3.18 Site imagery (docs/13 §4 shot list; Workers AI daily neuron limit was hit earlier, so check the limit has reset, else use the OPENAI_API_KEY fallback noted in DECISIONS), then P3.19 Careers (public).

## 2026-11-05 · P3.19 Careers (public) ✅
- Module `server/modules/careers` (listOpenPostings, getPostingView, jobPostingLd, submitApplication, autoClosePostings on `*/5`, applyApplicationRetention nightly), schema `shared/schemas/careers.ts`, routes `POST /api/v1/public/careers/:slug/applications` and `/careers/applications` (general, setting-gated), email `application_acknowledgement` (+ resolver for the reference).
- Pages `/careers` (filters: department/type/workplace, empty state, general-application link when enabled), `/careers/[slug]` (details, salary when shown, share links, JSON-LD only when open, closed state, 410), `/careers/apply`; `ApplicationForm` island; sitemap includes open roles; About links to Careers. Header nav already shows Careers only while a role is open.
- Tests: integration `careers.test.ts` (7: PDF accepted, renamed EXE rejected, closed/future/past-deadline rejected, auto-close, JSON-LD, 410, retention anonymises + deletes CV), e2e `careers.spec.ts` (2). Full e2e suite: 44 passed.
- Admin side (postings CRUD, pipeline/kanban, erase applicant) is in Phase 4.
- Next step: P3.18 Site imagery (deferred until the Workers AI free neuron quota resets at 00:00 UTC: `npm run img:gen -- --id <slot> --size 1344x768 --variants 2`, prompts in design/images/prompts/, see docs/13 §4 shot list; keep steps at 20 to fit ~2× more images/day). If the quota is still exhausted, continue with Phase 4 (P4.1) and come back to imagery.

## 2026-11-05 · P4.1 Admin shell ✅
- Server: `server/lib/admin-page.ts` (loadAdminPage, adminStage, safeNext, seeOther), `server/modules/admin` (ADMIN_NAV + adminNavFor, adminSearch, routes `GET /api/v1/admin/search`, `GET /api/v1/admin/notifications`, `POST /api/v1/admin/notifications/read`), notifications service list/mark-read.
- UI: `layouts/AuthLayout.astro`, rewritten `layouts/AdminLayout.astro` (sidebar, mobile drawer, top bar), islands `components/auth/AuthForms.tsx` (Login with Turnstile after failures, Forgot, SetPassword for reset/invite, ChangePassword, MfaVerify, MfaSetup with QR via `ui/QrCode`), `components/admin/{CommandPalette,NotificationsBell,UserMenu,AccountActions}.tsx`.
- Pages: /admin (home), /admin/login, /admin/forgot-password, /admin/reset-password, /admin/accept-invite, /admin/password, /admin/mfa, /admin/mfa/setup, /admin/notifications, /admin/account/sessions, /admin/account/security.
- New dependency: qrcode-generator 2.0.4.
- Tests: unit `admin-shell.test.ts` (6, permission-filtered nav per role), integration `admin-shell.test.ts` (3), e2e `admin-shell.spec.ts` (5). Full e2e suite: 49 passed.
- Next step: P4.2 Users & roles (invite staff → /admin/accept-invite already works; deactivate, assign roles, permissions matrix, super-admin custom roles, audit). Flip `built: true` for Users in `server/modules/admin/navigation.ts` when the page exists. P3.18 imagery still waits for the Workers AI quota (resets 00:00 UTC).

## 2026-11-06 · P4.2 Users & roles ✅
- Service: users/service.ts (listStaff, getStaff with audit history, inviteStaff, resendInvitation, renameStaff; enable fix), users/roles.ts (listRoles, createRole, updateRole, deleteRole), schemas shared/schemas/users.ts, routes `/api/v1/admin/users` (+ /:id, roles, disable, enable, invitation, mfa/reset) and `/api/v1/admin/roles`.
- UI: /admin/users (filters, invite dialog), /admin/users/[id] (name, roles, resend invite, reset 2FA, disable/enable, history), /admin/users/roles (role cards, permission matrix, custom-role editor for super admins); islands components/admin/UsersAdmin.tsx; readable 403 page (`forbiddenPage`); nav item Users is built.
- Tests: integration `users-admin.test.ts` (4), e2e `users-admin.spec.ts` (2). Full e2e: 51 passed.
- Next step: P4.3 Settings (company, branding/logo, addresses/contacts, socials, numbering that can't be lowered, currencies, taxes, provider status, email status + test send, notification prefs; all audited). Then flip Settings to built in server/modules/admin/navigation.ts. P3.18 imagery: retry `npm run img:gen -- --id home-approach --size 1024x768 --variants 1 --steps 20` after ~16:00 UTC.

## 2026-11-06 · P4.3 Settings ✅
- Registry `src/shared/settings.ts` (+ `src/shared/notifications.ts` types), service/routes `server/modules/settings` (`/api/v1/admin/settings/sections/:id`, `/numbering/:kind`, `/currencies/:code`, `/tax-rates`, `/payment-accounts/:id`, `/logo`, `/email/test`, `/notification-preferences`), email template `system_test`.
- Pages: /admin/settings (general), /billing (logo, documents, invoicing defaults, currencies, tax rates), /numbering, /website (pricing switch, booking link, careers), /integrations (payment accounts status/mode, email status + test send, recent emails), /admin/account/notifications; islands `components/admin/SettingsAdmin.tsx`, `SettingsNav.astro`, `SettingsSections.astro`; Settings nav item built.
- Tests: integration `settings.test.ts` (6), e2e `settings.spec.ts` (3, incl. public site showing a saved change immediately). Full e2e: 54 passed.
- Next step: P4.4 Clients (CRUD, contacts, notes, tags, archive, detail tabs, credits balance, portal access tab: invite contact, approve/revoke links). P3.18 imagery still pending on the Workers AI quota (retry after ~16:00 UTC).

## 2026-11-06 · P4.4 Clients ✅
- Module `server/modules/clients` (create with gap-free number + main contact, update, archive/restore, guarded delete, list with search/tag/status + pagination, detail with contacts/notes/credit balances/portal access/related counts, contacts CRUD, notes, portal invite + approve/revoke), schemas `shared/schemas/clients.ts`, routes `/api/v1/admin/clients/*`.
- UI: /admin/clients (filters, pagination), /admin/clients/new, /admin/clients/[id] (Overview, Contacts, Notes, Portal access tabs), /admin/clients/[id]/edit; islands `components/admin/ClientsAdmin.tsx`; Clients nav item built.
- Tests: integration `clients.test.ts` (5), e2e `clients.spec.ts` (2; docs/08 step 3 "admin creates a client"). Full e2e: 56 passed.
- Next step: P4.5 Enquiries & leads (inbox, triage, spam, lead pipeline list + board, assignment, follow-ups, activities, convert lead → client). Enquiry briefs from the wizard (`ProjectBrief` JSON) should render nicely in the enquiry detail. P3.18 imagery still pending (Workers AI quota; retry after ~16:00 UTC).

## 2026-11-06 · P4.5 Enquiries & leads ✅
- Server: `server/modules/leads/admin.ts` (enquiry inbox list/detail with parsed wizard brief, status new/spam/closed/reopen, triage → lead; lead list with open/stage/assignee/due filters, detail with services/activities/enquiries/client, create/update with stage-change activity + assignment notification, activities, follow-ups + completion, convert → client via `buildCreateClient` in one batch, nightly follow-up reminders, `leadFormOptions`), routes `/api/v1/admin/enquiries/*` and `/api/v1/admin/leads/*`, schemas `shared/schemas/leads.ts` (service ids accept generated ULID ids).
- UI: /admin/enquiries (views Inbox/New/Closed/Spam/All, search, type), /admin/enquiries/[id] (message, project brief, preferred times, contact, attachment download, lead link, actions), /admin/leads (list + board view, filters), /admin/leads/new, /admin/leads/[id] (log activity, open follow-ups, timeline, details, convert), /admin/leads/[id]/edit; islands `components/admin/LeadsAdmin.tsx`; Enquiries and Leads nav items built.
- Tests: integration `leads.test.ts` (5), e2e `leads.spec.ts` (2; docs/08 flows 2–3: enquiry → lead → note → convert). Full e2e suite green (the "58" first written here was a miscount; `playwright test --list` shows 56 tests after P4.6).
- Next step: P4.6 Services management (divisions + services CRUD with rich-text description, benefits/deliverables/FAQ, icon, pricing model, status, featured, drag sort, SEO; content_version bump so the public site updates at once). P3.18 imagery still pending (Workers AI quota; retry after ~16:00 UTC).

## 2026-11-06 · P4.6 Services management ✅
- Module `server/modules/catalogue` (list incl. hidden, get, create/update/delete divisions and services, reorder, `serviceInUse`), schemas `shared/schemas/catalogue.ts`, routes `/api/v1/admin/catalogue/*` (services.manage), allowed icons `shared/icons.ts`; every write bumps content_version + audit row in one batch.
- UI: /admin/services (sortable divisions and per-division services), /admin/services/divisions/new and /[id] (summary, rich-text description, benefits, deliverables, FAQ, icon, status, featured, SEO, delete when empty), /admin/services/new and /[id] (division, pricing model + price, status, featured, delete when unused); islands `components/admin/ServicesAdmin.tsx`; new `ui/RichTextEditor`; Services nav item built.
- Tests: integration `catalogue.test.ts` (4: public catalogue updates at once + sanitizing + audit, validation/duplicates/custom-quote, reorder + stale rejection, guarded deletes + permission), e2e `services.spec.ts` (1: create division + service → visible on /services/[slug] → reorder → delete). Full e2e: 56 of 56 listed tests passed.
- Next step: P4.7 Quotations (editor with LineItemEditor, versions, send, public link, accept/reject, expire cron, duplicate, void, convert to invoice idempotent, create project). Note P4.8 PDF engine is a dependency for quotation PDFs: build P4.7 without the PDF button first or do P4.8 right after. P3.18 imagery still pending (Workers AI quota; retry after ~16:00 UTC).

## 2026-11-06 · P4.7 Quotations ✅
- Module `server/modules/quotations` (create/update/delete drafts, list, detail with versions + invoice link, send/resend with number + snapshots + email, public view marks viewed + notifies, public accept/reject, staff-recorded response, revise, duplicate, void, convert → draft invoice idempotent, nightly `expire-quotations`, editor options), shared `shared/quotations.ts` (state machine) and `shared/schemas/quotations.ts`, email template `quotation_sent` + resolver, routes `/api/v1/admin/quotations/*` and `/api/v1/public/quotations/:token/respond`.
- UI: /admin/quotations (filters), /new (from client or lead), /[id] (document preview, history, versions, actions), /[id]/edit; public /q/[token] (document + accept/decline); `components/admin/LineItemEditor.tsx`, `QuotationsAdmin.tsx`, `forms/QuotationResponse.tsx`, `documents/QuotationDocument.astro`; "New quotation" on client and converted-lead pages; Quotations nav item built.
- Tests: unit `quotations.test.ts` (state machine + schemas), integration `quotations.test.ts` (4: pricing/number/snapshot/email/read-only, public view/accept/convert ×5 concurrent → one invoice, revise/-v2/reject/expire/void/delete, package price copy + validation + permissions), e2e `quotations.spec.ts` (docs/08 flows 4–6 up to conversion; issuing the invoice comes with P4.9). Full e2e: 57 of 57 passed.
- Next step: P4.8 PDF engine (pdf-lib layout kit, quotation/invoice/receipt/credit note, TEST watermark outside prod, R2 storage, never regenerate issued docs), then add the PDF download to /admin/quotations/[id] and /q/[token]. Check pdf-lib runs on workerd first. P3.18 imagery still pending (Workers AI quota).

## 2026-11-06 08:20 UTC · P4.8 PDF engine ✅
- `src/server/pdf/`: `layout.ts` (Composer over pdf-lib: A4, Helvetica standard fonts with safe character replacement, word wrap, page
  breaks, brand bar, vector Kuzikode mark or uploaded PNG/JPEG logo, footer with "Page x of y", TEST/DRAFT watermark), `document.ts`
  (one renderer: header, parties, table with repeated header + split of over-tall rows, totals, sections), builders `quotation.ts`,
  `invoice.ts`, `receipt.ts`, `credit-note.ts`, `common.ts` (parties, line-item table, HTML → text).
- `modules/documents`: `ensureStoredPdf` (render once → R2 via `storeGenerated` → guarded link; concurrent losers delete their copy),
  `documentPdf` (drafts = unstored preview), watermark rule, routes `GET /api/v1/admin/documents/:kind/:id/pdf` (permission per kind,
  audited `file.downloaded`) and `GET /api/v1/public/quotations/:token/pdf` (rate-limited, noindex). Job `pdf.generate` (queued by
  quotation send; permanent failure for missing records). `lib/public-links.ts` shared token derivation (quotation links unchanged).
- UI: "Preview PDF"/"Download PDF" on /admin/quotations/[id]; "Download PDF" on /q/[token].
- Tests: unit `pdf.test.ts` (9) · integration `documents.test.ts` (5, on workerd: job, single file, bytes unchanged after settings
  change, public token, concurrency ×5, permissions, invoice/receipt/credit note from rows) · e2e quotations spec downloads both PDFs.
  verify: unit 213 / integration 149 green; e2e quotations green.
- CPU (Node 22, warm, wall ≈ CPU): typical 3-line quotation ≈ 5 ms median; 40 lines ≈ 10 ms. Rendered off the request path (queue) and
  once per document, so within docs/02 §4.

## 2026-11-06 08:35 UTC · P4.9 Invoices ✅
- Shared: `shared/invoices.ts` (statuses, transitions, `deriveStatus` from money + due date, void rule, reminder schedule parsing,
  manual methods), `shared/schemas/invoices.ts`. Line pricing moved to `server/lib/line-pricing.ts` (quotations + invoices).
- `modules/invoices`: list (+ outstanding/overdue per currency), detail (payments, credits, history, reminders, available credit), draft
  create/update (guarded by `updated_at`)/delete, issue (conditional sequence bump → gap-free number, snapshots, token, history, audit,
  PDF + email jobs in one batch), resend, manual payments (receipt number, allocation up to balance, overpayment → `client_credits`,
  receipt PDF + email, optimistic retry on balance change), apply credit (ledger-sum guard), void (no money applied), public view by
  token, `markOverdue` (nightly) and `sendReminders` (new 07:41 Harare cron; latest reached offset only, once per kind; skipped at send
  time if paid). Email templates `invoice_issued`, `invoice_reminder`, `payment_receipt` + resolvers; `SkipEmail` for stale jobs.
- UI: /admin/invoices (filters, outstanding tiles), /new (also "New invoice" on client page), /[id] (document, actions: issue with
  optional email, record payment with overpayment notice, apply credit, resend, PDF, copy link, void, delete), /[id]/edit, public
  /i/[token] (status notice, payments received, PDF). LineItemEditor `allowRecurring={false}`; Invoices nav item on; quotation page
  links to its invoice. Setting `invoice.reminder_schedule` (validated).
- Tests: unit `invoices.test.ts` (7) · integration `invoices.test.ts` (8: issue/snapshot/immutability/email/PDF, 20 concurrent issues
  → 20 sequential numbers + double issue no gap, partial/exact/over payments + credit applied, 4 concurrent payments, void rules,
  overdue + reminders run twice, quotation → invoice, permissions) · e2e `invoices.spec.ts` (draft → issue → email → client /i/ +
  PDF → part paid → paid). verify: unit 223 / integration 157 green.

## 2026-11-06 08:50 UTC · P4.10 Credit notes ✅
- `shared/credit-notes.ts` (proportional credit per quantity, half-even; limits: balance against the invoice, money paid less earlier
  give-backs for credit/refund, never above the invoice total), `creditNoteSchema` (item lines by quantity or free adjustments).
- `modules/invoices/credit-notes.ts`: issue in one batch guarded by the invoice `updated_at` (conditional sequence bump → gap-free
  CN number, credit_notes + items, invoice credited/balance/status for 'invoice', `client_credits` 'credit_note' for account credit,
  history, audit, `pdf.generate`); remaining quantities and limits for the dialog; list on the invoice.
- UI: "Credit note" dialog on /admin/invoices/[id] (application with limits, per-line quantities, "credit everything left", adjustment,
  reason, live total) and a Credit notes panel with PDF links.
- Tests: unit `credit-notes.test.ts` (3) · integration `credit-notes.test.ts` (3: partial + full credit → paid, quantity/balance caps,
  account credit and refund limits, permanence, PDF, concurrency, permission, drafts refused) · e2e invoices spec issues a credit note.
  verify: unit 226 / integration 160 green; invoices, quotations and admin-shell e2e green.

## 2026-11-06 09:05 UTC · P4.11 Payments admin ✅
- `modules/payments`: list with filters (status, provider, method, currency, client, date range, search by receipt/invoice/reference/
  client) and per-currency received/refunded totals; detail (allocations, account credit kept, refunds, attempt + redacted events
  timeline when a gateway attempt exists); manual refunds that must be covered by a "to be refunded" credit note or account credit,
  in one guarded batch (refund ≤ payment, cover ≥ amount, account-credit ledger entry, payment status, audit); unmatched queue.
- UI: /admin/payments (All payments | Unmatched), /admin/payments/[id] (details, applied to, refunds, gateway timeline, receipt PDF,
  "Record refund" dialog). Payments nav on; invoice payment entries link to the payment.
- "Reconcile" is not rendered yet: no provider adapter exists until Phase 6 (P6.x adds it with `checkPaymentStatus`).
- Tests: integration `payments-admin.test.ts` (4: filters/detail, refund cover + limits + status, concurrent refunds, unmatched +
  permissions) · e2e invoices spec visits payments list/detail. verify: unit 226 / integration 164; full e2e 58/58 green.

## 2026-11-06 09:30 UTC · P4.12 Projects ✅
- Shared `shared/projects.ts` (statuses, labels, `autoProgress`), `shared/schemas/projects.ts`.
- `modules/projects`: list/detail scoped (view_all or member; others 404), create (PRJ number, creator as lead), edit (members/lead),
  progress mode + internal notes, from accepted quotation (idempotent, gap-free, one client-visible milestone + task per line),
  milestones (client-visible, linked invoice, completed_at), tasks (board/list; assignees join the project; members may move their own
  tasks), progress recomputed in SQL in every batch, updates (client-visible → portal notifications + `project_update` email),
  messages, files via `storeUpload` 'deliverable' (internal files never client-visible), activity from audit_logs. Staff file reads for
  project files now require membership unless `projects.view_all`. `loadAdminPage` accepts `anyOf`.
- UI: /admin/projects (list with progress), /new, /[id] (tabs Overview/Tasks/Updates/Files/Messages/Activity), /[id]/edit; "Create
  project" on accepted quotations (+ link to the created project). Projects nav on.
- Tests: integration `projects.test.ts` (6: numbering + scoping, progress auto/manual, assignee moves, quotation → project ×3
  concurrent, client updates/notifications/email, files + visibility + portal/staff access) · e2e quotations spec covers docs/08
  step 15. verify: unit 227 / integration 170 green; e2e 58/58 (quotations re-run green after an a11y underline fix).

## 2026-11-06 09:20 UTC · P4.13 Expenses ✅
- `modules/expenses`: list with filters (status, category, currency, project, client, dates, search) and per-currency totals; record/
  edit (project implies client; mismatches refused), void with reason (conditional audit), receipt upload (`storeUpload` 'receipt',
  owner 'expense'), categories (unique names; used ones only deactivate), report by category and by month per currency, CSV export
  (disclaimer line, RFC 4180 quoting, spreadsheet-formula cells prefixed with an apostrophe, audited).
- UI: /admin/expenses (filters, totals, Report, Categories, Export CSV, Record expense), /new, /[id] (edit form with receipt or read-only
  view, void), /categories, /report. Expenses nav on.
- Tests: integration `expenses.test.ts` (3) · e2e invoices spec records an expense with a receipt and opens the report.
  verify: unit 227 / integration 173 green; e2e 58/58 green.

## 2026-11-06 09:45 UTC · P4.14 Support inbox ✅
- `shared/support.ts`, `shared/schemas/support.ts`; `modules/support`: list (active/status/priority/assignee incl. me/none/client/
  search, counts, "client replied" marker), thread with attachments, open a request on a client's behalf (SUP number, staff
  notification, audit), replies (email `support_reply` to the main contact, portal-user notifications, status → waiting for the client,
  replier auto-assigned) vs internal notes (no email/notification, status kept), attachments (multipart, ≤ 5, `storeUpload` 'document'
  owner 'support'; internal-note files unreadable from the portal), assignment/status/priority (support.manage; assignee notified).
- UI: /admin/support (list + filters), /new, /[id] (conversation, reply/note composer with attachments, request controls). Nav on.
- Tests: integration `support.test.ts` (3) · e2e invoices spec opens a request, adds a note and replies. settings e2e: account-menu
  click now retries until the island hydrates (was flaky under parallel load).
- verify: unit 228 / integration 176 green; e2e green (invoices + settings re-run after the fixes; full run 56/58 before them).

## 2026-11-06 10:15 UTC · P4.15 CMS editors ✅
- Preview: `?preview=1` on any public page, honoured only for an admin session with `cms.manage` (page middleware sets `ctx.preview`);
  `getPage`/`listPortfolio` then read drafts and skip every cache; responses get `Cache-Control: private, no-store` and
  `X-Robots-Tag: noindex`; a "Preview of unpublished changes" bar shows. Requests with a session cookie are never edge-cached anyway.
- `cms/admin.ts` + `/api/v1/admin/cms/*`: pages list (unpublished-changes flag), section drafts validated by the section schemas
  (rich text sanitised), hide/show and move (bump version), page title/SEO/share image (bump), publish (drafts → published, bump),
  discard; media library (PNG/JPEG/WebP/AVIF, public, alt text required, edit, delete blocked while used); portfolio (draft →
  publish/unpublish, unique slug, cover + gallery, delete only unpublished); products; announcements (window, link pairs).
- UI: /admin/cms (pages incl. legal), /admin/cms/pages/[key] (generic section editor from `shared/cms-fields.ts`, publish bar with
  preview/live links, details form), /admin/cms/portfolio(+[id]), /products, /announcements, /admin/media. Pages + Media nav on.
- Tests: integration `cms-admin.test.ts` (4) · e2e `cms.spec.ts` (draft → staff preview with no-store/noindex → visitor never sees it,
  even with ?preview=1 → publish → visible; restores the original hero). verify: unit 228 / integration 180; e2e 59/59 green.


## 2026-11-06 12:25 UTC · P3.18 still blocked · P4.16 Notifications ✅
- P3.18 imagery: Workers AI daily neurons already spent at 12:00 UTC, OpenAI key has no credit, Canva gives only 200 px thumbnails.
  `img:gen` gained `--provider openai`; BLOCKERS has the owner action. Phase 4 continues.
- Migration 0010: `notifications.in_app`, `notifications.email_state` (+ partial index on pending).
- `modules/notifications`: preference-aware `notifyStaffWithPermission` / `notifyUser` / new `notifyClientUsers` / `notifySecurity`
  (actor excluded by default; `email: false` option), bell/page read only in-app rows, `dispatchNotificationEmails` (cron
  `*/5`, `notification` template, idempotency `email:notification:<id>`, inactive recipients → skipped).
- Triggers added: `milestone.updated` on status change (team + portal), `support.replied` to the assignee for others' replies/notes,
  `security.alert` (new browser sign-in alert + email, password changed/reset, 2FA). New tunable types: lead.assigned, lead.follow_up,
  system.job_failed. `payment.failed` and `client.registered` triggers are carried into P6.2 / P5.1 (noted in the roadmap AC).
- UI: /admin/notifications All/Unread filter, type label, per-item "Mark as read", Preferences link.
- Tests: integration `notifications.test.ts` (9: viewed/rejected, issued/payment received, milestone, support replied, security,
  preferences, email dispatch double-run, job-failed in-app only, mark-read ownership); support test now checks actor exclusion;
  e2e admin-shell covers the filter. verify: unit 229 / integration 189 green; e2e admin-shell 5/5.
- Next step: P4.17 Dashboard (KPIs per currency, charts, recent lists, permission-filtered tiles; test figures against fixtures).

## 2026-11-06 12:45 UTC · P4.17 Dashboard ✅
- `modules/dashboard`: `getDashboard` (permission-filtered sections; null when not allowed): revenue all time / this month (net of
  refunds, reversals excluded), outstanding + overdue per currency with counts, 12-month revenue per currency, invoices issued vs
  paid per month, pending quotations (count + value per currency), active/completed projects (member-scoped without
  projects.view_all), upcoming milestones (30 days), new enquiries + wizard briefs (7 days), open roles + new applicants, recent
  payments (with provider reference), invoices due in 14 days, recent business activity. `GET /api/v1/admin/dashboard`.
- UI: /admin KPI tiles (2-up on phones), `components/admin/BarChart.astro` (SVG, tooltips, table view), lists; notifications and
  account cards kept below.
- Tests: integration `dashboard.test.ts` (4: exact figures from fixtures incl. Harare month boundary, refunds, reversed/draft/void,
  member scoping, API parity + role filtering) · e2e admin-shell dashboard test (tiles, table view, axe, 375/768/1440, support staff
  sees no financial tiles).
- Next step: P4.19 Packages & pricing admin (packages, features, add-ons, comparison order, price-review flag + dashboard warning
  tile, "Add package" in the quotation editor; price-copy test).

## 2026-11-06 13:05 UTC · P4.19 Packages & pricing admin ✅
- `shared/schemas/packages.ts`; `modules/packages` (+ routes at `/api/v1/admin/packages`): list (all tabs, add-ons, review count,
  show-prices state), create/edit with ordered feature rows (content_version bump + audit), delete when unused, one "most popular"
  per tab, comparison order per tab, add-on CRUD, price review flag + approve one/all (`packages.price_review`), quotation picker and
  `quote-lines` (prices copied at that moment, ZWG via manual price). Dashboard: price-review warning banner (`priceReview`).
- UI: /admin/packages (tabs with drag/arrow ordering, review badges + approve, "Awaiting review" view, add-ons table + dialog),
  /admin/packages/new, /admin/packages/[id] (package editor with feature rows); quotation editor "Add package" dialog. Nav: Packages on.
- Tests: integration `packages-admin.test.ts` (5: CRUD/features/audit/version/cost-note privacy, price review + dashboard, most
  popular + order, price-copy into quotations + ZWG + delete guard, add-ons + permissions) · e2e `packages.spec.ts` (2).
- Next step: P4.20 Subscriptions & recurring billing + managed services register (renewal reminders, portal "Your services" data,
  double-run cron test, MRR/ARR + upcoming renewals tiles on the dashboard).

## 2026-11-06 13:25 UTC · P4.20 Subscriptions, recurring billing & managed services ✅
- Invoices: `draftInvoiceStatements` (shared by staff create and billing; links `subscription_id`, stamps line periods) and
  `issueDraft` (no auth; `issueInvoice` authorises then calls it).
- `modules/subscriptions`: list (filters, MRR summary), detail (periods history, next-invoice preview, linked services), create/edit
  (fixed fields once billed), pause/resume (no back-billing)/cancel, `billSubscriptions` (morning cron), `flagAtRisk` (nightly),
  `recurringRevenue`, `subscriptionsFromQuotationStmt` (quotation acceptance), `clientServices` (portal-ready, no internal notes);
  `assets.ts`: register CRUD, `sendRenewalReminders` (morning cron, 30/14/7, `renewal_reminder` email when billable),
  `upcomingRenewals`. Settings: `subscriptions.lead_days`, `subscriptions.at_risk_days`. Notification types: subscription.alert,
  renewal.upcoming.
- UI: /admin/subscriptions (+ new, [id], [id]/edit), /admin/assets (+ new, [id], 90-day renewals calendar), client "Services" tab,
  dashboard MRR/ARR tile + "Upcoming renewals (30 days)". Nav: Subscriptions + Managed services on.
- Tests: integration `subscriptions.test.ts` (8: anchoring/labels, double + concurrent cron runs, catch-up + auto-issue, pause/
  resume/cancel/edit rules, at-risk flag + clear, MRR/ARR + dashboard parity, quotation → subscription, register + reminders +
  privacy) · e2e `subscriptions.spec.ts`.
- Next step: P4.21 Careers admin (postings with custom questions, pipeline kanban, ratings, notes, templated emails, bulk reject,
  retention job already exists in modules/careers, Hiring Manager role).

## 2026-11-06 13:45 UTC · P4.21 Careers admin ✅
- `shared/schemas/careers-admin.ts`; `modules/careers/admin.ts` + `/api/v1/admin/careers/*`: postings CRUD (sanitised description,
  ≤ 5 custom questions), status transitions, duplicate, applicant list/filters (posting/general, stage, reviewer, tag, rating,
  search), detail (answers, CV/cover links via the authorised file route, history), stage/rating/tags/reviewer (notified) with history
  events, notes, candidate email templates + per-email edit, bulk reject + regret, erase. Staff preview of drafts on the public page.
- UI: /admin/careers (postings + general applications), /new, /[id] (editor + actions + preview link), /applicants (list/board),
  /applications/[id] (details, history, panel), /templates. Nav: Careers on.
- Tests: integration `careers-admin.test.ts` (3) · e2e `careers-admin.spec.ts` (draft → preview → open → board → stage, rating,
  email → close → archive); careers.spec still green.
- Next step: P4.22 Content admin (insights, industries, FAQ, testimonials with consent enforced, technologies, newsletter list +
  export). Check modules/cms (content.ts, insights.ts, industries.ts) for the existing public readers first.

## 2026-11-06 17:45 UTC · Owner image import + P3.18 Site imagery ✅
- Connectors present (Figma, Canva, Cloudflare). Downloaded the owner's 20 Gemini images read-only from R2 `images` (account checked) to the
  session scratchpad (originals never committed), viewed each one, mapped them to the 20 PROMPT-PACK slots; all passed the §6 bar.
- `img:process` now takes owner uploads (`--src`, `--model`, `--category`, `--focus`, empty `--alt` for decorative); 20 images → AVIF/WebP/JPEG
  at 640/1024/full, LQIP, manifest rebuilt (12 MB in public/images/site). OG cards re-rendered on the `bg-og` background.
- Placement: Hero, Features (home `why`, how-we-work `engagement`), new `WorkGallery.astro` + `PhotoPair.astro`, services/[slug] hero,
  about, careers, contact, products, `CtaBand` background. Removed the owner's `imgs/` folder.
- Tests: verify green; public e2e specs (home, about, careers, contact, services, products, public, public-layout) pass. 5 admin specs
  failed only on login rate-limiting when the whole filtered set ran together and passed when re-run on their own. Visual QA 375/768/1440 for home,
  a service page, about, careers, contact, products: no overflow, no broken images.
- Next step: P4.22 Content admin.

## 2026-11-06 18:40 UTC · P4.22 Content admin ✅
- `shared/schemas/content-admin.ts`; `modules/cms/content-admin.ts` + `/api/v1/admin/content/*`: articles (draft/scheduled/published,
  sanitised body, reading time, tags, cover, SEO; delete drafts only), categories, industries (challenges, linked services, icon,
  status), FAQ, testimonials (real client + consent + date, project must match client), technologies (same-origin SVG paths only),
  newsletter list (status/search/paging, counts) + CSV export (confirmed by default, audited). `lib/csv.ts` shared CSV helper.
- UI: /admin/content → insights (list + categories), insights/[id|new], industries (+ editor), faq, testimonials, technologies,
  newsletter; `ContentTabs` hides tabs without permission. Nav: Content on (content.manage or newsletter.view).
- Fix: the redactor no longer masks ISO dates as phone numbers (unit test added).
- Tests: integration `content-admin.test.ts` (6) · e2e `content-admin.spec.ts` (article → publish → public page → cleanup, FAQ to /faq,
  testimonials consent copy, newsletter without export for Content Manager, axe + 375/768/1440). verify: unit 232 / integration 215 green.
- Next step: P4.23 Time tracking (entries, timer, timesheet, bill unbilled time to invoice; concurrent billing test). Check
  migrations for `time_entries` and the `time.*` permissions first.

## 2026-11-06 19:20 UTC · P4.23 Time tracking ✅
- `shared/schemas/time.ts`; `modules/timetracking` (+ `/api/v1/admin/time/*`): entries CRUD (own unless time.view_all, billed locked),
  timer start/stop/discard, weekly timesheet, project time summary, unbilled-by-project, `billUnbilledTime` (guarded batch → new
  draft invoice, entries linked to their lines). Invoices: `draftInvoiceStatements({ guard })` + `itemIds`; draft edit clears time
  line links, draft delete and void release billed time. Settings: default hourly rate + time currency on the billing page.
- UI: /admin/time (My time with timer + log/edit dialog, Timesheet with week nav and person picker for time.view_all, Unbilled time),
  /admin/time/bill/[project] (choose entries → draft invoice), project "Time" tab. Nav: Time on.
- Tests: integration `time.test.ts` (5, incl. 4 concurrent billing requests → one invoice per winning set, no orphans) · e2e
  `time.spec.ts`. verify: unit 232 / integration 220 green; invoices/admin-shell/settings/subscriptions e2e green.
- Next step: P4.18 Reports & export (still open in Phase 4).

## 2026-11-06 19:55 UTC · P4.18 Reports & export ✅
- `modules/reports`: revenue by month / by client, invoiced by service, ageing buckets, quotation conversion, expenses by category,
  indicative profit (all per currency), CSV export per report (`reports.export`, audited). `modules/audit`: audit list/filters
  (actor, record type, record id, action or action prefix, Harare dates; finance-only scope without users.manage), CSV export
  (audited), full data export per module (JSON) or table (CSV) for `data.export` with secrets stripped.
  Routes: `/api/v1/admin/reports`, `/audit`, `/data-export`.
- UI: /admin/reports (range form, revenue charts per currency, tables, export links), /admin/audit (filters, before/after details,
  paging, export), /admin/settings/data-export (Super Admin tab in Settings). Nav: Reports + Audit log on.
- Tests: integration `reports.test.ts` (5: exact aggregates from a 2031 fixture set incl. the Harare month boundary, failed refund,
  reversed payment, void/draft exclusions, ageing edges at 60/90 days; API permissions + CSV content + audit; audit filters/scope/
  export; data export whitelist + secret stripping) · e2e `reports.spec.ts`. verify: unit 232 / integration 225 green.
- Phase 4 is complete. Next step: P5.1 Portal auth UX (accept invite, login, reset, verify email, sessions, profile, optional approved
  registration off by default; no auto-linking by email; `client.registered` notification for clients.view staff, with a test). Read
  docs/07 portal sections and check src/pages/portal + modules/auth for what exists.

## 2026-11-06 18:50 UTC · P5.1 Portal auth UX ✅
- Connectors present (Figma, Canva, Cloudflare). Hand-off session.
- Backend: `registerPortalAccount` (setting-gated 404, Turnstile, per-IP + per-email limits, generic reply, set-password link via
  `invite_client` token with registration metadata), `acceptInvitation` raises `client.registered` (clients.view staff, deduped) +
  audit on a completed sign-up, `updateProfile` (name, phone; audited) for both audiences. Clients: `listPortalSignups`,
  `linkPortalSignup` (explicit, audited, notifies the user), `declinePortalSignup` (disable + revoke sessions). Routes:
  `POST /auth/portal/register`, `PUT /auth/{admin|portal}/profile`, `/admin/clients/portal-signups[/:userId/link|decline]`.
  Setting `portal.self_registration` (Settings → General → Client portal).
- Pages: `server/lib/portal-page.ts` guard; /portal (overview with "waiting to be linked" state), /portal/login, register,
  forgot-password, reset-password, accept-invite, verify-email (+ /admin/verify-email, which was missing), password, mfa, mfa/setup,
  account (details, email status + resend, companies, password, 2FA), account/sessions. PortalLayout: account menu with sign out,
  mobile nav row. Admin /admin/clients/portal-signups + link from Clients when sign-ups wait. Session/2FA actions take an audience.
- Tests: integration `portal-auth.test.ts` (8: off by default, Turnstile, no sign-in before finishing, no enumeration, no auto-link with
  matching contact email, notification only to clients.view staff, link/decline permissions and guards, re-registration replaces the
  link, profile CSRF/validation/audit) · e2e `portal-auth.spec.ts` (sign-in → profile → devices → sign out; sign-up → mailbox link →
  password → unlinked state → staff link → client visible; axe + 375/768/1440). verify: unit 232 / integration 233 green; clients,
  settings, admin-shell e2e green.
- Next step: P5.2 Portal overview (outstanding balance per currency, open quotations, active projects, recent activity) on
  `src/pages/portal/index.astro` (keep the unlinked state). Every query scoped by `page.auth.clientIds`; add a `modules/portal`
  service for portal reads. Add nav items in `PortalLayout.astro` as sections ship.

## 2026-11-06 19:05 UTC · P5.2 Portal overview ✅
- `AuthState.clientRoles` + `portalAreaClientIds(ctx, area)` (finance / projects / quotations / support) in lib/policies; files
  `portalCanRead` scoped per area. `modules/portal` (`portalOverview`, `GET /api/v1/portal/overview`, portal sessions only).
- /portal: balance cards per currency (open count, overdue part), quotations waiting (count + 5), active projects (progress bar with
  aria values, next client-visible milestone or target date), recent activity (8), contact email; unlinked state kept. Sections a
  role can't see are not rendered.
- Tests: integration `portal-overview.test.ts` (5: exact per-currency aggregates incl. draft/void/paid/other-client exclusions,
  expired quotations, internal milestones/updates hidden, reversed payments hidden, billing vs member areas, file route per area,
  unlinked + staff/anonymous refused) · e2e portal-auth spec checks the overview against fixed fixtures (global-setup) + axe +
  375/768/1440 reviewed. verify: unit 232 / integration 238 green.
- Next step: P5.3 Portal quotations (list, view, PDF, accept/reject; isolation tests). Reuse modules/quotations public
  accept/reject + PDF code (`publicQuotationRoutes`, `QuotationDocument.astro`), scope with `portalAreaClientIds(ctx, 'quotations')`,
  add "Quotations" to PortalLayout items and link the overview quotation rows + activity items to `/portal/quotations/<id>`.

## 2026-11-06 19:15 UTC · P5.3 Portal quotations ✅
- quotations service: `markViewed` (shared with the public link), `listPortalQuotations` (open first, `show=open` filter),
  `getPortalQuotation`, `respondPortal`, `portalQuotationId`; all scoped by `portalAreaClientIds(ctx, 'quotations')`, never drafts.
  Routes `/api/v1/portal/quotations[/:id[/respond|/pdf]]` (CSRF, per-user rate limit on respond).
- Pages /portal/quotations (All / Waiting tabs, status pills with client wording) and /portal/quotations/[id] (QuotationDocument,
  newer-version link, PDF, response form via `QuotationResponse endpoint=…`). `loadPortalPage({ area })` returns 404 for areas the
  role can't see; PortalLayout menu shows Quotations only when allowed; overview rows + activity link to the detail page.
- Tests: integration `portal-quotations.test.ts` (4: list scope, drafts/other clients 404 on view/PDF/respond, first view + single
  notification, PDF headers, accept validation/CSRF/audit actor/notification/once-only, decline reason, expired refused) · e2e
  portal-auth spec: list → detail → accept (axe + 375/768/1440 reviewed). quotations.spec still green. verify: integration 242 green.
- Next step: P5.4 Portal invoices & credit notes (list with status, view, PDF, Pay now). Reuse invoices public page pieces
  (`src/pages/i/[token].astro`, `InvoiceDocument.astro`, `invoiceIdForToken`), scope by `portalAreaClientIds(ctx, 'finance')`.
  "Pay now" must lead to the payment flow: check what `/i/[token]` does for paying today (P6 builds checkout) and link to the same
  place; don't render a dead button. Add "Invoices" to PortalLayout items when `page.areas.finance`; link overview invoice activity.

## 2026-11-06 19:25 UTC · P5.4 Portal invoices & credit notes ✅
- `modules/invoices/portal.ts`: `listPortalInvoices` (open first; `show=open`), `getPortalInvoice` (items, non-reversed payments,
  credit notes, payment instructions while open, effective overdue), `listPortalCreditNotes`, `portalInvoiceId`,
  `portalCreditNoteId`; all scoped by the finance area, never drafts. Routes `/api/v1/portal/invoices[/:id[/pdf]]`,
  `/api/v1/portal/credit-notes[/:id/pdf]` (`?inline=1`).
- Pages /portal/invoices (To pay / All / Credit notes) and /portal/invoices/[id] (status, "to pay" panel with bank details,
  InvoiceDocument, payments received, credit notes with PDFs). Menu "Invoices" for finance roles; overview balance + invoice
  activity link here. No "Pay now" yet (P6.3c), see DECISIONS.
- e2e fixtures: portal invoices are inserted as drafts, given lines, then issued (lines are locked after issue).
- Tests: integration `portal-invoices.test.ts` (4: scope/order/drafts/other clients 404 incl. PDFs, detail with payment + credit
  note + bank details, PDF attachment/inline, credit note PDF isolation, effective overdue, member role has no invoices) · e2e
  portal-auth spec (list → overdue invoice → how to pay; axe + 375/768/1440 reviewed). verify: integration 246 green.
- Next step: P5.5 Portal payments & receipts (history, receipt PDFs, attempt status page). Payments table + `documentPdf(ctx,
  'receipt', paymentId)`; scope by finance area. "Attempt status page": check `payment_attempts` in migrations/0006 — if no
  attempts exist until P6, build the read-only status page for attempts in the caller's scope (pending/succeeded/failed) and
  test it with inserted attempts. Add "Payments" either as a tab of Invoices or its own menu item.

## 2026-11-06 19:35 UTC · P5.5 Portal payments & receipts ✅
- `modules/payments/portal.ts`: `listPortalPayments` (with the invoices each paid), `portalPaymentId` (receipt PDF),
  `getPortalAttempt` (client-safe phase/message, masked phone, method, invoice, resulting receipt). Routes
  `/api/v1/portal/payments`, `/payments/:id/receipt` (`?inline=1`), `/payment-attempts/:id`. `shared/payment-methods.ts` labels.
- Pages /portal/payments (history + receipt links) and /portal/payments/attempts/[id] (`AttemptStatus` island polls while
  waiting). Menu: Payments (finance roles); desktop menu from `lg`, wrapping row below. Overview payment activity links here.
- Tests: integration `portal-payments.test.ts` (2: list scope + allocations, receipt PDF + isolation; attempt phases, no provider
  details leak, other client/member/staff refused) · e2e portal-auth spec (payments list, receipt PDF, failed attempt page; axe +
  375/768/1440 reviewed). verify: integration 248 green.
- Next step: P5.6 Portal projects (milestones, client updates, progress, deliverables download, messages; AC: internal items
  never visible, with a test). Scope by `portalAreaClientIds(ctx, 'projects')`. Check `project_messages` and `project_files`
  (client_visible) in migrations/0007 and the admin projects service for message posting + notifications (notifyClientUsers /
  staff). Add "Projects" menu item; link overview project rows + project_update activity.

## 2026-11-06 19:45 UTC · P5.6 Portal projects ✅
- `modules/projects/portal.ts`: `listPortalProjects` (unread team messages), `getPortalProject` (client-visible milestones,
  client updates, shared non-internal files, thread; marks team messages read), `postPortalMessage` (rate-limited, notifies
  members + creator, audited). Staff `postMessage` now notifies the client's portal users. File route: `internal` project files
  never served to the portal. Notification type `project.message`. Routes `/api/v1/portal/projects[/:id[/messages]]`.
- Pages /portal/projects (cards with progress + unread badge) and /portal/projects/[id] (progress + milestones, updates, messages
  with `ProjectMessageForm`, deliverables). Menu "Projects" (projects roles). Overview: project rows and every activity item now
  link to their record (`targetId` on activity).
- Tests: integration `portal-projects.test.ts` (4: internal tasks/updates/milestones/files/budget/description never returned,
  hidden + internal files 404, unread → read, message notifies team only + audit, other client/billing/staff refused, staff
  message notifies client) · e2e portal-auth spec (projects → project → send message; axe + 375/768/1440 reviewed).
  verify: integration 252 green.
- Next step: P5.7 Portal support (create, reply, attachments, status) + "Your services" page (clientServices from P4.20) with
  "Request cancellation" creating a support request (docs/12 §A.3). Check modules/support (admin side, attachments via
  `support_attachments`, is_internal_note) and modules/subscriptions for `clientServices`.

## 2026-11-06 22:55 UTC · P5.7 Portal support & "Your services" ✅
- `modules/support/portal.ts`: list (open/all), detail (internal notes + their files never selected), create (multipart with up
  to 5 files, client choice when linked to several, project check, rate-limited, staff notified, `support_ack` email), reply
  (reopens; closed refused), mark resolved. Shared `requestStatements` in support/service.ts (staff + portal create).
  `modules/subscriptions/portal.ts`: `listPortalServices` (finance area), `requestCancellation` (billing request, deduped).
  Routes `/api/v1/portal/support[/:id[/messages|/resolve]]`, `/services`, `/services/subscriptions/:id/cancellation`.
- Pages /portal/support, /portal/support/new, /portal/support/[id], /portal/services (`SupportForms.tsx` islands). Menu
  "Services" (finance) + "Support" (all roles); desktop menu now from `xl`.
- Tests: integration `portal-support.test.ts` (5) + unit email template · e2e portal-auth spec P5.7 (new request with file →
  reply → resolve → services → cancellation request; axe + 375/768/1440 reviewed). Second e2e portal user (login rate limit);
  `hydrated()` scrolls `client:visible` islands into view (was flaky). verify: integration 257 green.
- Next step: P5.8 Public document pages `/q/:token`, `/i/:token`, `/pay/return` (AC: token tests, noindex/no-store). Check
  `src/server/lib/public-links.ts` (documentToken) and whether any of these pages already exist under src/pages/q, src/pages/i.

## 2026-11-11 11:50 UTC · P5.8 Public document pages ✅
- `/q/:token` and `/i/:token` existed (P4.7/P4.9); added the docs/07 §6 rate limit (`publicDocumentPageLimit`, 300/h per IP
  shared by all token pages, plain 429). noindex/no-store come from the middleware (`/q/`, `/i/`, `/pay` private prefixes) plus
  the `robots` meta in DocumentLayout.
- `/pay/return?attempt=<id>&t=<sig>`: gateway browser return. `paymentReturnUrl` / `verifyPaymentReturn` (HMAC of the attempt
  id, constant-time compare, no storage). `getPublicAttempt` reuses the portal's client-safe attempt view (shared loader in
  payments/portal.ts) with session-free links: `/api/v1/public/payment-attempts/:id?t=` (status, polled) and `/receipt?t=`
  (receipt PDF once paid), invoice link = public `/i/` page. Read-only: never applies a payment. `AttemptStatus` takes `links`.
- Tests: integration `public-documents.test.ts` (3: tokens per kind/draft/flipped/malformed/oversized, PDF headers on 200 and
  404; return signature per attempt, status/receipt, no provider detail leak, status read never mutates; rate limit 300→429) ·
  unit isPrivatePath `/pay/return` · e2e `public-documents.spec.ts` (return page without session, no portal links, axe,
  375/768/1440 reviewed; bad tokens/signatures 404 with private headers). portal-auth, invoices, quotations e2e still green.
  verify: unit 234 / integration 260 green.
- Note: run Playwright locally **without** `CI=1` (CI mode skips the preinstalled Chromium).
- Next step: P6.1 (see Current status).

## 2026-11-11 12:45 UTC · P6.1 Payments package, router, mock checkout ✅
- `packages/payments` (`@kuzikode/payments` 0.1.0, no dependencies): types (+ `credentialFields`), integer money helpers,
  `ProviderError` (safe message, `retryable`), `redact` (secrets dropped, phone/e-mail/instrument masked, secret values scrubbed),
  mock adapter (injectable `MockStore`; test numbers 1111111/2222222/3333333/4444444, InnBucks code, O'mari OTP 123456, hosted
  outcomes, HMAC-signed callbacks, refunds), conformance kit `test/conformance.ts`, boundaries test (no app imports), README
  (usage, new adapter guide, extraction), CHANGELOG, standalone `npm test -w @kuzikode/payments` (CI step added).
- App: `modules/payments/providers.ts` (registry, D1 mock store, mock allowed only when `config.mockPaymentsEnabled`),
  `router.ts` (`resolveRoute`: exact currency > `*`, exact method > `*`, then priority; skips disabled/not-allowed accounts,
  missing secrets, currency/method mismatch; `paymentMethodOptions`; `credentialStatus` names only; `accountConfig` resolves
  `<prefix>_<env>` secrets and `*Secret` options), `mock-checkout.ts` + page `/dev/mock-checkout/:reference` (TEST banner,
  same-origin form POST, redirects only to our own site). Migration 0011 adds mock state columns.
- Tests: package unit 22 (conformance on mock, money, redaction, boundaries, simulation) · integration `payment-router.test.ts`
  (4: specificity/priority/skips/no route, secrets outside development, mock unreachable with production config even with the
  flag and a secret, hosted page settle-once) · e2e mock page (axe, 375/768/1440 reviewed). verify: unit 256 / integration 264.
- Next step: P6.2 (see Current status).

## 2026-11-11 13:40 UTC · P6.2 Payments service ✅
- `invoices/service.ts`: `applyIncomingPayment` (shared core of manual + online payments: receipt number, allocation up to the
  balance, excess → client credit, history, audit, receipt PDF + email jobs; `before`/`onlyIf` hooks for the attempt claim;
  online payments are recorded even if the invoice was paid or voided meanwhile) and `reverseIncomingPayment` (payment marked
  reversed/refunded, balance restored, overpayment credit withdrawn). `recordManualPayment` now calls the core.
- `payments/orchestration.ts`: `invoicePaymentOptions` (no route → staff alert once a day), `initiateInvoicePayment`
  (Idempotency-Key per invoice, 30-min reuse for methods without a phone, phone normalised + masked, returnUrl =
  `paymentReturnUrl`, refused/unreachable → failed/error + payment.failed), `handleCallback` (authenticate → events with dedupe →
  match within the account → confirm with `checkAttempt`), `checkAttempt` (5 s throttle unless forced; forced checks also
  re-check finished attempts so a late success is recorded), `applyStatus` (state machine incl. amount/currency/reference
  mismatch → error + review alert, partially_paid alert, disputed, reversed/refunded), `submitAttemptOtp`.
- Routes: portal `GET /invoices/:id/payment-options`, `POST /invoices/:id/pay`, `POST /payment-attempts/:id/otp`, status GET
  asks the gateway while waiting; public `GET /invoices/:token/payment-options`, `POST /invoices/:token/pay` (Turnstile),
  `POST /payment-attempts/:id/otp?t=`; callbacks `POST /api/payments/callbacks/:provider/:accountId` (always 200, 64 KB cap).
  The mock hosted page now delivers its signed callback in-process.
- Tests: integration `payments-online.test.ts` (11: options + express + 5 concurrent callbacks → 1 payment; idempotency/reuse;
  insufficient → failed + notification; forged and unconfirmed callbacks; missed callback via status poll; amount mismatch;
  overpayment → credit; disputed → reversed once; O'mari OTP; route switch affects new attempts only + late success on the old
  account; scoping + public Turnstile + signed status; mock page end to end) · unit phone normaliser. verify: unit 267 /
  integration 275 · e2e public-documents, portal-auth, invoices green.
- Next step: P6.3 (see Current status).

## 2026-11-11 14:20 UTC · P6.3 Paynow adapter ✅
- Re-verified Paynow docs (initiate_transaction, express_checkout_transactions, status_update, polling_status, generating_hash,
  validating_hash, test_mode). New fact recorded in docs/06 §4: polling is an empty POST; `/interface/trace` + `merchanttrace`.
- `packages/payments/src/providers/paynow.ts` (package 0.2.0): fetch + WebCrypto SHA-512; ordered request signing; every
  response/status update hash-verified in constant time before use (a redirect URL is never returned unverified); express
  (EcoCash/OneMoney prompt text, InnBucks code + Harare-time expiry, O'mari OTP step + submission), `authemail` = test merchant
  e-mail in test mode / customer e-mail in live mode, `merchanttrace` = attempt id; status by poll URL or trace; status map,
  unknown → pending (logged); poll/OTP URLs pinned to Paynow hosts over https; errors → `ProviderError` (insufficient →
  declined, network/5xx retryable). Registered in the app; wrong O'mari code can be retried (422).
- Tests: package 28 new (both docs hash vectors, parsing, every status, express shapes, errors, trace, URL pinning, conformance
  kit with a fake Paynow) · integration: seeded Paynow USD account chosen once its secrets exist, `testAuthEmailSecret`
  resolved. verify: unit 295 / integration 276.
- Live smoke test (adapter only, from this container, Paynow test mode, owner's USD integration): EcoCash 0771111111 → initiate
  OK (real response hashes verified) → poll after 9 s **Paid**, $1.00, our reference; trace by merchanttrace **Paid**;
  0774444444 → declined "Insufficient balance"; redirect initiate → verified www.paynow.co.zw page + poll URL. Note: Node's
  fetch here needs `NODE_USE_ENV_PROXY=1` (the container proxy). The full P6.5 suite against staging remains.
- Next step: P6.3b (see Current status).

## 2026-11-11 15:00 UTC · P6.3b PesePay adapter ✅
- Re-verified PesePay docs (llms-full.txt): encryption, initiate, check-payment, callback, verifying callbacks, statuses,
  method codes, errors. docs/06 §5 updated: `ZiG` vs `ZWG` per method, method codes, sandbox numbers, callback details.
- `packages/payments/src/providers/pesepay.ts` (package 0.3.0): WebCrypto AES-256-CBC (equal to Node's createCipheriv
  output), initiate with method preselection + per-method currency code, check-payment by reference, status table, amounts
  read back as minor units, unsigned callbacks: `authentic` = reference present + Authorization header equals our key (the
  app confirms by status check anyway), sandbox/production base URL by account mode, redirect/poll URLs pinned to PesePay.
  Registered in the app.
- Tests: package 30 new (AES vs Node reference, every status, method/currency codes, errors, callbacks, conformance kit with
  a fake PesePay) · integration `payment-switch.test.ts`: real Paynow + PesePay adapters on faked HTTP; switching the USD route
  moves only new attempts; the old Paynow attempt reconciles on Paynow and is recorded there. verify green.
- Next step: P6.3c (see Current status).

## 2026-11-11 15:45 UTC · P6.3c Gateway accounts & routing admin ✅
- `modules/payments/admin-config.ts`: config view (accounts with provider name, usable flag, secret names found/missing,
  what the gateway offers; routes with account labels), create/update account (validated against the gateway's currencies
  and methods and our active currencies, unique secret prefix), create/update/delete route (account must take the currency
  and offer the method); every change audited in the same batch. Super Admin only (route middleware before the body is read
  + service check); routes under `/api/v1/admin/payments/config`.
- Page `/admin/payments/gateways` (+ "Gateways" tab for Super Admins) with `PaymentGateways` island (account dialogs,
  routes table, add/edit/remove route).
- e2e: new Super Admin e2e user with 2FA (known TOTP secret, local D1 only); spec signs in with a TOTP code, checks secret
  status, adds and removes a route; axe + 375/768/1440 reviewed (fixed: sr-only cell labels escaping the table scroll box).
- Tests: integration `payment-config.test.ts` (4). verify: unit 325 / integration 281.
- The portal/public "Pay now" (P6.3c AC) is delivered with the checkout page in P6.3d, since its target is that page.

## 2026-11-11 13:20 UTC · P6.3d Custom checkout page ✅
- `modules/payments/checkout.ts`: `checkoutView` (summary: first 5 lines + "and N more", total, paid + credited, amount due;
  routed methods; bank details from Settings while open; phone prefill: portal user's phone, else the invoice's client;
  no gateway internals) and `reportBankTransfer` ("I've paid, notify Kuzikode": `payment.reported` notification for
  `payments.record_manual` staff, one per invoice per day, audited, marks nothing paid). Routes: public
  `POST /api/v1/public/invoices/:token/bank-transfer-notice` (Turnstile, 10/h/IP), portal `POST /api/v1/portal/invoices/:id/bank-transfer-notice`.
  Both pay endpoints now return `statusUrl` + `otpUrl` (public ones signed like the gateway return link).
- `components/payments/CheckoutPage.tsx` (island) + `CheckoutSummary.astro` (server-rendered, `<noscript>` bank details); pages
  `/pay/[invoiceToken]` and `/portal/invoices/[id]/pay`. Method tiles (radio inputs), phone check, Turnstile (public), Pay button
  locked per click with a fresh idempotency key, waiting panel (instructions, 10-min countdown, poll every 3 s, "Still waiting? Check
  again"), InnBucks code + QR + app link + expiry (`walletDeepLink`, per method), O'mari OTP (6 boxes, paste, backspace), card →
  gateway page → `/pay/return`, success (receipt number, PDF link, back to invoice) / failure (Try again, Choose another method),
  TEST PAYMENT banner, aria-live announcements, trust footer. "Pay now" on `/i/[token]` and `/portal/invoices/[id]` when payable.
- Tests: integration `checkout.test.ts` (4: view, phone/paid invoice, status/OTP URLs portal + public, bank notice dedupe/audit/scope/
  Turnstile/409 once paid) · e2e `checkout.spec.ts` (4: public EcoCash → paid + receipt PDF, insufficient → Try again → cancelled →
  InnBucks code/QR/link → bank notice, portal O'mari OTP by paste with double-click = one request, card hand-off → mock page →
  `/pay/return` paid); axe clean; 375/768/1440 screenshots reviewed. global-setup creates 4 fresh checkout invoices per run for a
  separate e2e client/user and sets test bank details. Portal, public-documents, gateways and invoices specs re-run green.
- Next step: P6.3e (see Current status).

## 2026-11-11 17:10 UTC · P6.3e Cards on our checkout ✅ (saved cards blocked on Paynow approval)
- Package 0.4.0: `InitiateInput.tokenize` / `cardToken`, `StatusResult.cardToken` (server-only, never in `raw`). Paynow: `tokenize=true`
  on card entry, saved card = express `method=vmc|zimswitch` + `token` + `merchanttrace`, `tokenexpiry` (D-MMM-YYYY) parsed, fresh
  token read from every paid status (re-tokenization). Mock: same, Paynow's test-token outcomes. Only with account option `tokenizationEnabled`.
- App: migration 0012 (`payment_attempts.tokenize`, mock state, index). `modules/payments/saved-cards.ts` (AES-GCM token at rest,
  capture from a verified paid status, dedupe by brand/last 4, portal list/default/remove, per-plan auto-charge consent),
  `autocharge.ts` (morning cron after billing: one attempt per due subscription invoice; failure → `card_charge_failed` email with the
  pay link, same batch). Card entry returns to new `/pay/card-return` (postMessage + BroadcastChannel, closes itself, else shows status).
  COOP per page (`openerPolicyFor`). Saved cards for signed-in portal payers only. Super Admin switch "Saved cards (card tokenization)".
- UI: `CheckoutPage` card window (about:blank from the click → gateway URL; popup blocked / < 640 px → same tab), "Complete card entry
  in the secure window…" state, "Open secure window", saved-card radio list + "Use a new card" + opt-in "Save this card"; portal
  `/portal/payments` "Saved cards" (make default, remove with confirm); `/portal/services` "Charge my saved card automatically for this plan".
- Tests: package +5 · unit (COOP, email template) · integration `saved-cards.test.ts` (5: no tokenization, save + saved-card pay with
  re-tokenization + no token in API/events/audit, declined/scoping/expired, management, auto-charge consent/once/failure email/withdraw) ·
  e2e checkout (popup blocked fallback → /pay/card-return; portal popup → saved → paid on our page with no window, no token in any API
  response → removed). Screens 375/1440 reviewed; axe clean.
- Live check (Paynow test mode, owner's USD integration, official test tokens): refused by Paynow, "You are not permitted to tokenize
  payment instruments" / "does not have any ACTIVE 'vmc' payment method" / "tokenized transactions not permitted for your merchant".
  Owner action in BLOCKERS. Re-check script: bundle a small script that calls `createPaynowProvider().initiatePayment` with
  `cardToken {11111111-1111-1111-1111-111111111111}` (esbuild → node, `NODE_USE_ENV_PROXY=1`).

## 2026-11-11 17:20 UTC · P6.4 Reconciliation ✅
- `modules/payments/reconciliation.ts`: `reconcilePayments` on the 5-minute cron (`payment-reconciliation`): open attempts older
  than 2 min whose `next_check_at` is due (or past `expires_at`) are checked with the gateway (forced) and applied; backoff 2/5/10/30/60
  min then hourly; past the 72 h lifetime → one final check → `expired` (+ `reconcile` event, payment.failed alert; a success at the
  final check wins); `created` for 30 min with no gateway reference → `error`; succeeded payments re-checked daily for 7 days, disputed
  hourly for 90 days (late dispute/refund/reversal). Attempts the gateway can't be asked about still move to their next slot. 25 per
  group per run. `checkAttemptNow` (payments.view, audited `payment.attempt_checked`, 30/user/10 min) and `listInvoiceAttempts`.
- API: `GET /api/v1/admin/payments/attempts?invoiceId=`, `POST /api/v1/admin/payments/attempts/:id/check`.
- UI: "Online payment attempts" panel on `/admin/invoices/[id]` (status badge, test badge, masked phone, checks, next automatic
  check, "Check now" → reloads when the status changes, aria-live result).
- Tests: integration `reconciliation.test.ts` (7: schedule, missed callback applied once incl. concurrent runs, backoff, expiry,
  never started, late reversal + daily/7-day bounds, Check now permissions/audit/no internals/list) · e2e `reconciliation.spec.ts`
  (seeded waiting attempt, Check now → no change; axe; 375/768/1440 reviewed). verify: unit 331 / integration 297. Checkout,
  public-documents, gateways, portal-auth, invoices e2e re-run green.

## 2026-11-11 17:30 UTC · P6.5 Paynow test-mode verification `[!]` (automated part done)
- New opt-in vitest project `payments-live` (`tests/live/paynow.live.test.ts`, `npm run test:payments:live`, sets
  `NODE_USE_ENV_PROXY=1`); not in verify/CI. Skips per gateway without credentials; `LIVE_RESULT_URL`/`LIVE_RETURN_URL` optional.
- Live run 2026-11-11 17:20 UTC from the build container, owner's Paynow USD integration in test mode: 0771111111 → **Paid** $1.00,
  our reference, also found by trace (23 s) · 0773333333 → **Cancelled** (46 s) · 0774444444 → refused at once, **declined
  "Insufficient balance"**, not retryable · redirect (card) → verified paynow.co.zw page, status **Created** (waiting). 4/4 passed.
  PesePay: skipped (no test keys).
- Not done (owner/staging): result URL reachable on staging (P8.2), manual "Faked Success" on Paynow's page (BLOCKERS).

## 2026-11-11 17:45 UTC · P6.6 All email templates ✅
- 23 templates (PRD §7 list complete). New `quotation_accepted` staff email (number, title, client, total, accepted on/by, link-or-staff
  wording; resolver loads details at send time; the notification dispatcher uses it for `quotation.accepted`, same email preference).
  `invoice_reminder` gains the "due today" wording for the on-the-day reminder (`dueToday` set by the resolver at send time).
- `src/server/email/templates/samples.ts`: sample data typed `Record<TemplateName, …>` (a template without a sample fails the
  typecheck) + 6 variants. Dev preview `/dev/emails` (list with subjects) and `/dev/emails/<name>[?variant=&format=text]`
  (real renderer, 404 outside development); linked from the dev nav.
- Tests: unit email (39: HTML + subject/text snapshots for every template and variant, PRD list complete, before/on/after wording) ·
  integration notifications (acceptance → dedicated email to staff, rendered from the queue) and invoices (on-due reminder "due today")
  · e2e `email-preview.spec.ts`. ui-kit e2e green.

## 2026-11-11 17:55 UTC · P6.7 Resend webhooks ✅
- `modules/email-webhooks`: `POST /api/webhooks/resend` (re-verified Resend + Svix docs): Svix signature with WebCrypto (`whsec_` base64
  key, `id.timestamp.body`, space-separated `v1,` signatures, 5-min tolerance, constant-time compare), 256 KB cap, 1200/h/IP; events →
  `email_logs.status` by `provider_message_id` (provider `resend` only), monotonic so retries/out-of-order events never go backwards;
  bounce details / complaint / suppression into `email_logs.error`. Owner setup (endpoint + secret) in BLOCKERS.
- Tests: unit `resend-webhook.test.ts` (3: equals Node HMAC reference, tolerance, malformed headers/secret) · integration
  `resend-webhooks.test.ts` (5, signed fixtures: forward-only + replay + complaint after delivery, bounce/failed/suppressed, secret
  rotation, forged/stale/future/unsigned/v2/tampered refused, unknown/other provider/ignored types/bad JSON acknowledged).

## 2026-11-11 18:00 UTC · P6.8 Live email verification ✅ (container; staging repeat in P8.2)
- Real send with the owner's `RESEND_API_KEY` through `resendProvider` (our adapter, `system_test` template rendered by our renderer),
  from `Kuzikode <onboarding@resend.dev>` to Resend's test inbox `delivered@resend.dev`: id `01a1cbb7-62c4-7799-9cd4-9f94c0156a33`,
  `GET /emails/:id` → `last_event: delivered` within 5 s. (Real client addresses need a verified sending domain: BLOCKERS "Domain kuzikode.com".)

## 2026-11-11 18:40 UTC · P7.1 Full E2E journey ✅
- `tests/e2e/full-journey.spec.ts`: the 16 steps of docs/08 §4 in one serial test with fresh data: contact enquiry (reference) →
  admin notification → lead + log note → client → quotation (3 lines, 5% discount, VAT; $1,081.67) sent → mailbox link → public
  `/q/` PDF + accept → convert (second convert refused/idempotent) → issue → invoice email with `/i/` and portal links → portal
  invitation (Owner) → set password → portal sign-in → invoice PDF → $500 bank transfer recorded (Part paid) → portal Pay now →
  EcoCash mock → "Waiting for approval" → "Payment received" after the server-side check → Paid, 2 receipts → both receipt PDFs in
  the portal → dashboard + payments list with the gateway reference → project from the quotation (milestone, update, deliverable) →
  client sees progress, milestone, update and downloads the file. Passes in ~58 s; run twice green.
- Fixes found by the journey: invoice email now includes the portal link (resolver `portalLink`); payments list shows the
  gateway/bank reference; the contact form's empty category showed a raw Zod pattern message (now "Choose a category." only);
  dashboard overflowed at 375 px with long references (single-column grids now `grid-cols-1`, references wrap).

## 2026-11-11 19:05 UTC · P7.2 Security suite ✅
- e2e `security.spec.ts` (3): client B (new fixture user `e2e-security@example.com`, owner of the checkout client only) gets 404 on
  client A's invoice/pay/quotation/project/payment-attempt pages and 10 portal APIs (invoice + PDF + payment options, quotation + PDF,
  project, receipt, attempt, file), no client A names leak, lists only own data, admin API/file → 401, `/admin` → login; Content
  Manager: no finance nav, 403 page + API for invoices/payments/clients; signed-out → login with `next`, 401 on APIs, `noindex`
  header + meta, robots closed outside production.
- Manual OWASP pass (no `security-review` diff to review on `main`): SQL interpolation (only constants and a whitelisted export
  table), router auth (public routers: honeypot + per-IP limit + Turnstile; newsletter double opt-in), `set:html` sources sanitized
  on write (CMS, catalogue, quotations, careers, insights, industries) and JSON-LD escapes `<`, cookies (HttpOnly/SameSite Lax),
  no secrets in client bundles or logs, docs/07 §12 test list all present (IDOR, CSRF/Origin, lockout, single-use tokens, spoofed
  uploads, SVG, XSS, mock blocked in production, headers, no-store). Finding fixed: per-invoice initiation limit (10/hour) was
  missing → added + integration test. Earlier in P7.1: raw Zod message on the contact form.
- Fixture hygiene: global-setup hides files on the portal project (portal-auth expects none); the security spec uploads to another
  client's project. verify green; security + portal-auth + checkout e2e green.

## 2026-11-11 19:40 UTC · P7.3 Responsive + accessibility pass ✅
- `tests/e2e/sweep.spec.ts`: every route (35 public/auth, 80 admin, 16 portal; detail pages from fixtures or the first linked record)
  → loads, axe WCAG 2.1 AA has no serious/critical issues, no sideways scroll at 375/768/1440, first Tab lands on "Skip to content".
  Collects all problems per area in one run (~4.3 min). Not swept (covered elsewhere): Super Admin pages, `/careers/apply` (off by
  default). No record to open in the e2e DB: work/[slug] (portfolio empty by design), insights tag, time bill, careers application,
  portal support detail.
- First run found 5 overflow bugs, all fixed: roles permission matrix and other scroll boxes let absolutely-positioned screen-reader
  text escape (all 28 `overflow-x-auto` wrappers now `relative`); sidebar grids sized to their table's min width (now
  `grid-cols-1` + `minmax(0,1fr)` on 12 pages: insights, invoices, quotations, projects, clients, users, support, CMS pages…);
  account sessions at 375 px. axe and keyboard: no findings. Pricing, gateways, reports, users, content specs re-run green.

## 2026-11-11 20:20 UTC · CI e2e red since run 66 → fixed
- Cause: the e2e suite outgrew the sign-in limits it runs against (one client IP for the whole suite: 20 sign-ins / 15 min; shared
  accounts: 5 / 15 min per email). Fix (tests only, limits unchanged): `ownIp(spec)` gives each spec file its own
  `cf-connecting-ip` (wrangler dev passes it through; Cloudflare overwrites it on staging/production), and the newer specs use their
  own accounts (`reconAdmin`, `journeyAdmin`, `securityAdmin`, `sweepAdmin`, `support2`).
- Bug found on the way: with more than 99 unread notifications the bell's label ("103 unread") didn't contain its visible text
  ("99+") → WCAG 2.5.3; the label now says "99+ unread".
- Full e2e suite locally: 92 tests, green (7.1 min).

## 2026-11-11 21:00 UTC · P7.4 Performance pass ✅
- Lighthouse 12.6.1, mobile profile, local production build on `wrangler dev` (`npm run perf:lighthouse`):
  `/` P99 A100 BP100 · `/services/` P100 A100 BP100 · `/services/web-development` P98 A100 BP100 · `/contact` P99 A100 BP96
  (Turnstile iframe); LCP 1.5–2.1 s, TBT 0–10 ms, CLS 0. SEO 69 in development (deliberate `noindex` + robots `Disallow: /`);
  with `APP_ENV=production` SEO = 100 on `/` and `/contact`. All PRD §10 targets met.
- Fixed: font subsets under 4 KB were inlined as `data:` URLs that our CSP blocks (Best Practices 93 → 100).
- Sizes: Worker 4.39 MB raw / 1.24 MB gzip (free limit 3 MB gzip); client JS 242 KB gzip in total across all islands (React
  runtime 65 KB, UI kit 56 KB, Zod schemas 24 KB, the rest per-page islands ≤ 7 KB); CSS 12.6 KB gzip. Home transfers 313 KB
  (script 125 KB, fonts 93 KB, images 69 KB).
- Timings (local `wrangler dev`, warm, wall clock incl. local D1/R2 I/O, median of 7): home SSR 11.8 ms, service page 10.8 ms,
  admin sign-in 41.8 ms (PBKDF2 100k ≈ 21 ms CPU, DECISIONS 2026-11-05), invoice PDF first render 43.2 ms, stored PDF 27.7 ms.
  CPU-heavy paths stay those already recorded (login hash, PDF render once per document); Workers Paid remains the BLOCKERS advice
  before real payments.

## 2026-11-11 21:30 UTC · P7.5 Placeholder sweep ✅ · P7.6 Link + migration check ✅ · CI split
- `scripts/check-placeholders.mjs` (`npm run check:placeholders`, inside `verify`): 7 rules (TODO/FIXME/HACK, lorem, `href="#"`,
  console.log/debug, clickable "Coming soon", permanently disabled buttons, invented social proof); dev-only pages/fixtures and
  generated types skipped; per-line opt-out with a reason. Proven with a probe file (all 7 caught). Real tree: one legitimate CLI log
  in the seed builder (marked). Audit of the rest: "Coming soon" only as non-clickable status labels; seeds ship no testimonials,
  portfolio, team or client logos.
- `scripts/check-migrations.mjs` (`npm run check:migrations`, CI step): all 12 migrations apply to an empty D1 in a throwaway
  directory, then `migrations list` reports nothing pending.
- `tests/e2e/links.spec.ts`: crawls from `/` + sitemap (51 pages, 77 URLs): every internal page/asset < 400, no `#`/`javascript:`
  links. Green.
- CI: runs 75–76 hit the 15-minute job timeout (suite grew to 92 e2e tests); now two parallel jobs, verify (20 min) and e2e (30 min).

## 2026-11-11 21:50 UTC · CI green · session hand-off
- CI run 78 on `main` (d7efa6f): verify job ✅ (4 min 40 s), e2e job ✅ (92 + link check, ~11 min). First green run since run 66.
- Session ending at a phase boundary (Phases 1–7 done; P6.5 `[!]` on the owner's Faked Success). Next: P8.1 (see Current status).

## 2026-11-11 22:00 UTC · P8.1 Remote resources ✅
- Created with wrangler 4.158 (API token from the build env; only `kuzikode-*` names, nothing else touched):
  staging D1 `kuzikode-staging-db` (bfe8dc86-a8b1-4c22-944e-92f735a9fa4f, ENAM), R2 `kuzikode-staging-files` + `kuzikode-staging-backups`,
  KV `kuzikode-staging-cache` (0995450f0a70435f8cd064bb22873572), Queues `kuzikode-staging-jobs` + `kuzikode-staging-jobs-dlq`;
  production D1 `kuzikode-prod-db` (fe59d0e4-4a0d-48f3-95b0-4111ffbff5d0), R2 `kuzikode-prod-files` + `kuzikode-prod-backups`,
  KV `kuzikode-prod-cache` (9ca45b78464f4f16b62badae19599920), Queues `kuzikode-prod-jobs` + `kuzikode-prod-jobs-dlq` (all empty).
- `wrangler.jsonc`: the four `<..._ID>` placeholders replaced with the real IDs. `npm run deploy:staging:dry` lists every staging
  binding against the real resources.

## 2026-11-11 22:20 UTC · P8.2 staging deploy (in progress)
- Staging deployed by hand from this container: 12 migrations applied remotely, base + nonprod seeds, Worker `kuzikode-staging`
  (version 83fe6747) with 7 Worker secrets (`wrangler secret list`: all `secret_text`), 3 crons, queue producer/consumer.
  URL https://kuzikode-staging.mhodieknowledge.workers.dev
- This container can't reach `*.workers.dev` (Cloudflare edge 429 for the shared egress IP, Worker never invoked), so the smoke
  test runs from GitHub Actions: new `deploy-staging.yml` (after CI on main or by hand: build → migrate → deploy → `scripts/smoke.mjs`,
  11 read-only checks incl. security/private headers, robots, sitemap, 404, Turnstile key) and `bootstrap-admin.yml` (manual; owner
  enters their email; `bootstrap-admin --send-email` queues the invite through the outbox, link never logged). Smoke script passes
  11/11 against a local worker; unit tests for both.

## 2026-11-11 22:45 UTC · P8.3 production + backup workflows ✅ · P8.4 restore drill ✅ · P8.2 waiting on the Cloudflare daily limit
- **Blocker found:** all `*.mhodieknowledge.workers.dev` hosts answer Cloudflare **Error 1027** (account's Workers Free daily
  limit used up: `zimindex` ≈160k requests today, Kuzikode 1). So both this container's and GitHub's smoke requests never reach the
  Worker. Deploy staging run #1 (Actions 43110654890): build, migrations, deploy ✅; smoke ✗ (1027). Owner action in BLOCKERS.
  `scripts/smoke.mjs` now names error 1027 and has a 15 s per-request timeout.
- `deploy-production.yml` (manual, type "deploy production", main only, `production` environment): required-secret check →
  `npm run verify` → `scripts/backup-d1.sh production pre-deploy` → `scripts/prod-secrets.mjs` (generates HMAC/DATA keys only if
  the Worker lacks them, passes third-party keys from GitHub secrets, fails on a missing required one; names only in logs) →
  migrations → base seed → build → `wrangler deploy --secrets-file` → smoke `--env production` (HSTS, real Turnstile key,
  indexable robots). Not run (owner's button).
- `backup.yml` (nightly 01:43 UTC + manual, production default) → `scripts/backup-d1.sh`: D1 export (wrangler output, which holds
  a presigned link, never printed) + manifest (`scripts/d1-manifest.mjs`: per-table counts in one scalar-subquery SELECT because
  D1 allows max 5 compound terms, invoice/payment per-currency checksums) → gzip → AES-256-CBC PBKDF2 200k → round-trip check →
  R2 `d1/daily/…` (+ `d1/monthly/…` on the 1st, `d1/pre-deploy/…`). Retention via R2 lifecycle rules set on both backup buckets:
  daily 30 d, monthly 365 d, pre-deploy 90 d.
- **P8.4 drill (staging, 22:22 UTC):** `backup-d1.sh staging pre-deploy` → 45 824-byte encrypted object
  `kuzikode-staging-backups/d1/pre-deploy/20261111T222212Z` → `scripts/restore-drill.sh staging d1/pre-deploy/20261111T222212Z`:
  downloaded + decrypted (288 452 bytes SQL), restored into scratch D1 `kuzikode-restore-test`, **92 tables, 677 rows, checksums
  match**, 26 s, scratch DB deleted (`d1 list` confirms). Staging has seed data only (no invoices yet), so the money checksums
  compared empty sets; production repeats the drill once real data exists (RUNBOOK).
- Unit tests: smoke (5), deploy scripts (5: secrets plan, manifest compare, count SQL).

## 2026-11-11 23:20 UTC · P8.5 Docs ✅ · DATA_ENCRYPTION_KEY rotation
- New: `README.md` (overview, links, local setup, checks, layout), `docs/RUNBOOK.md` (deploy, migrations, rollback, Time
  Travel + encrypted-export restore incl. drill record, secret rotation table, incident basics incl. Error 1027,
  post-deploy checklist), `docs/ADMIN-GUIDE.md` (bootstrap → password → 2FA, settings tabs, roles, clients/portal,
  quotation → invoice → payment → credit note, gateways), `docs/PAYMENTS-ONBOARDING.md` (Faked Success, going live, ZWG
  integration, adding/switching to PesePay by account + route), `docs/EMAIL-SETUP.md` (Resend domain DNS, sender change,
  webhook, Email Routing, limits), `docs/PRODUCTION-CHECKLIST.md`. UI labels in the guides checked against the components.
- Rotation support so the RUNBOOK procedure is real: `DATA_ENCRYPTION_KEY_PREVIOUS` fallback (`lib/data-keys.ts`) + nightly
  `reencrypt-totp-secrets` / `reencrypt-card-tokens`; integration tests (4) in `tests/integration/key-rotation.test.ts`.
- Staging: `PAYNOW_TEST_AUTHEMAIL` Worker secret added (the seeded Paynow USD account reads it in test mode).
- Backup workflow run #1 on GitHub (staging) ✅ → `BACKUP_ENCRYPTION_PASSPHRASE` GitHub secret exists.
- verify: unit 355 / integration 308, green.

## 2026-11-11 23:00 UTC · P8.6 Final screens ✅
- `docs/screenshots/` (index README): home, service page, pricing, contact, admin dashboard, invoices, invoice detail, portal
  overview at 1440 and 375 px, from a local build with fictional demo data; reviewed. Figma rebuild not done (DECISIONS).
- Fix found while reviewing: the admin invoice History card was blank when an invoice had no status rows (imported or seeded data); it now
  says "No status changes recorded."

## 2026-11-12 00:10 UTC · P8.2 ✅ · P8.7 ✅ · roadmap complete
- After the 00:00 UTC Cloudflare reset: `node scripts/smoke.mjs https://kuzikode-staging.mhodieknowledge.workers.dev` → 11/11 passed
  from this container. Deploy staging run #6 (23:03 UTC, after CI) had failed on Error 1027 as expected; run #7 (dispatched 00:07) ✅ build, migrate, deploy, smoke.
- FINAL-REPORT updated (staging verified; Error 1027 kept as an account-level risk). Roadmap: everything `[x]`, P6.5 `[!]` (owner).

## 2026-11-12 10:53 UTC · Redesign R0.1–R0.4 ✅ · R1.1 ✅
- Session start checks: Figma, Canva, Cloudflare connectors present; R2 `images/incoming/` empty; no `design/inbox/`; skills present.
- R0.1: 22 skills load; `impeccable context` + init (PRODUCT.md written from PRD/brief, interview substituted per owner instruction).
- R0.2: `docs/redesign/DESIGN_AUDIT.md` (weaknesses, pricing source of truth, image inventory); 29 screens × 390/1440 before-shots
  in `docs/screenshots/redesign/before/`; `impeccable detect` findings recorded. New visual-loop harness:
  `playwright.visual.config.ts` + `tests/visual/shoot.spec.ts` (`SHOOT=/a,/b SHOOT_SET=all|core|quick SHOOT_LABEL=x`), output `.shots/` (ignored).
- R0.3: all 29 inspiration images analysed (`REFERENCE_IMAGE_ANALYSIS.md`, 29 entries) + `IMAGE_TRACEABILITY.md` (29 rows).
- R0.4: webdev.co.zw, vetech.co.zw (+ website-development page), hoverstat.es, curated.design captured at 390/1440; findings in
  REFERENCE_IMAGE_ANALYSIS.md. landing.love/siteinspire/awwwards refused automation.
- R1.1: `DESIGN_DIRECTION.md`: "Directory" world (felt navy #0B1428 + concrete + cobalt, Archivo wdth + JetBrains Mono, Lucide),
  via impeccable concept-seed (seed:658d80b5dbf5df50, assigned 7/7); surface brief `.impeccable/surfaces/src-pages-index-astro.md`.
- Next step: R1.2 specs (RESPONSIVE_DESIGN_SPEC, MOTION_AND_INTERACTION_SPEC, PANEL_DESIGN_SPEC, UI_UX_RECONSTRUCTION_PLAN,
  IMPLEMENTATION_PLAN), then R1.3 image batch 1.

## 2026-11-12 10:56 UTC · Redesign R1.2 ✅ · R1.3 ✅
- Specs: RESPONSIVE_DESIGN_SPEC.md (breakpoints, global mobile rules, per-page phone → tablet → desktop), MOTION_AND_INTERACTION_SPEC.md
  (tokens, catalogue, reduced motion), PANEL_DESIGN_SPEC.md (workspace vs admin, windows/status bar/dock, mobile shells, auth),
  UI_UX_RECONSTRUCTION_PLAN.md (goals, measures), IMPLEMENTATION_PLAN.md (tokens with compatibility aliases, primitive inventory, order).
- IMAGE-REQUESTS.md batch 1 (9 slots: 6 division frames, about-lobby, contact-counter, careers-desk), ready for owner.
- Next step: R2.1 tokens + fonts (Archivo wdth + JetBrains Mono variable; remove Manrope/Inter; aliases for old Tailwind names).

## 2026-11-12 11:04 UTC · Redesign R2.1 ✅ tokens + fonts
- `tokens.css` rewritten (felt / concrete / ink / cobalt / status, radius, shadows, z-index, motion, layout vars per breakpoint) with
  compatibility aliases for old names so admin/portal reskin at once; `global.css` @theme: new colour names, Archivo (wdth) +
  JetBrains Mono variable, fluid type scale (`text-display-xl` … `text-micro`), utilities `caps`, `wide`, `display`, themed
  selection / focus / caret / scrollbars, tabular numerals in data. Manrope, Inter, static JetBrains removed; latin Archivo preloaded.
  OG render script switched to Archivo. Eyebrow labels removed from the specs (impeccable craft-floor ban; DECISIONS).
- verify green (unit 355, integration 308). Helper: `.shots/restart.sh` (ignored) rebuilds and restarts wrangler dev.
- Next step: R2.2 icon system (Icon.astro wrapper sizes/stroke/label; audit list of icon placements in IMPLEMENTATION_PLAN or a new ICONS section).

## 2026-11-12 11:06 UTC · Redesign R1.4 ✅ clean-slate plan
- Owner inserted BRIEF B.0 (rebuild from zero, never restyle) + R1.4. IMPLEMENTATION_PLAN.md rewritten (new `src/ui/` tree, logic-only
  reuse per area, legacy removal checklist for all 98 legacy files), UI_UX_RECONSTRUCTION_PLAN.md and PANEL_DESIGN_SPEC.md aligned.
- Next step: R2.2 icon system in `src/ui/icons/` (Icon.astro + icon.tsx, semantic registry, sizes/stroke/labels) + icon placement audit.

## 2026-11-12 11:08 UTC · Redesign R2.2 ✅ icon system
- `src/ui/icons/`: registry (meaning → Lucide glyph, division/industry slug mapping, CMS names), `Icon.astro`, `icon.tsx`;
  sizes 16/20/24/32 with matched strokes; decorative by default, `label` for meaningful icons. Unit test `ui-icons.test.ts` (4).
  Placement audit: docs/redesign/ICONS.md.
- Next step: R2.3 primitives in `src/ui/primitives/` (Button/Link, fields, SegmentedControl, Tabs, Accordion, Rail, Sheet, Dialog, Toast, Badge/StatusPill, ListRow, DataTable list mode) + motion scripts in `src/ui/motion/`.

## 2026-11-12 11:31 UTC · Redesign R2.3 ✅ primitives · R2.4 ✅ gallery
- Token layer moved to `src/ui/tokens/` (tokens.css, base.css, components.css with all primitive recipes). New `src/layouts/Base.astro`
  + `src/ui/head/Head.astro` (document shell for every new layout; boots `src/ui/motion/controllers.ts`: segmented/tabs/rail/sheet/reveal).
- Astro primitives (`src/ui/primitives/*.astro`): Button, SegmentedControl (links/tabs/buttons), Tabs, Accordion(+Item), Rail, Sheet,
  StatusPill, ListRow, EmptyState. React twins (`index.ts`): Button/LinkButton/IconButton, Field/TextField/SelectField/TextareaField/
  CheckRow/ChoiceGroup, MoneyInput, Segmented, Sheet/ConfirmSheet (typed confirm), ToastProvider/useToast, StatusPill, Spinner,
  EmptyState, ListRow, DataTable (list rows < 768 px). `stack` utility for vertical grids.
- `/dev/ui` rewritten as the new gallery; legacy KitchenSink deleted; `tests/e2e/ui-kit.spec.ts` rewritten (8 green). QA_REPORT.md started.
- verify green (unit 359, integration 308).
- Next step: R3.1 new PublicLayout + Header (desktop nav with sliding indicator + Services directory mega-panel + About panel;
  mobile full-height top sheet directory; sticky felt → concrete-glass) in `src/ui/public/shell/`, replacing SiteHeader/
  AnnouncementBar/WhatsAppButton/BaseHead/Logo/AppLayout per IMPLEMENTATION_PLAN §8. Run the full e2e suite (not run since R2.1).

## 2026-11-12 11:45 UTC · Redesign R3.1 ✅ header · R3.2 ✅ footer
- New `PublicLayout` on `Base.astro`; `src/ui/public/shell/`: Header (desktop nav + sliding indicator, Services directory mega-panel
  with lit frame and real "from" prices, About panel, mobile full-height felt directory sheet with search, links, CTAs, channels),
  header.ts (menus, hover intent, Escape, indicator, scrolled state), Footer (CTA card, channel tiles, link directories, newsletter,
  legal, wordmark), Announcement, WhatsApp; Logo as inline SVG (`src/ui/brand`); `src/ui/tokens/public.css`.
- `src/shared/directory.ts` divisionFromPrice (+4 unit tests). API client moved to `src/ui/lib/api.ts`; newsletter rebuilt with a hook.
- Legacy deleted: SiteHeader, SiteFooter, AnnouncementBar, WhatsAppButton, NewsletterForm. verify green (unit 363, integration 308).
- Next step: run the full e2e suite (server must not be restarted while it runs), then R3.3 (reveal already in controllers.ts:
  add e2e for reduced motion + reveal) and R4.1 Home rebuild in `src/ui/public/home/`.

## 2026-11-12 14:00 UTC · Redesign R1.5 ✅ concept gate · R1.1 ✅ (redone)
- Session started by the watchdog (session_01LWwAAUtz2tE8RXDbGc2W4B). Connectors: Figma, Canva, Cloudflare present. R2 `images/incoming/`
  empty; no `design/inbox/`. Skills present. `npm ci` was needed (fresh container).
- Opened the reference images again (5054, 5055, 5056, 5066, 5065, 5067, 5015, 5057, 5052, 5069, 5072, 5048) and the existing photo set.
- impeccable context + concept-seed (seed:fc069276a80d2a45, assigned grounded candidate 5). Three static prototypes:
  `design/concepts/a|b|c/index.html` (+ treated images in `design/concepts/img/`), boards in `docs/screenshots/redesign/concepts/`.
  Taste consistency checker run on all three; fresh impeccable-finish-reviewer judged the boards: **B "Route" wins** (sign green +
  verge + mint, Overpass, gantry of route plates with real "from" prices, route tabs, comparison table with phone column picker, road
  strip). Reviewer fixes applied to B before promotion (real plates, no repeated arrows, no third green band, no footer wordmark,
  road strip, "Recommended").
- DESIGN_DIRECTION.md §2–10 rewritten; surface brief + PRODUCT.md updated (no start-a-project); IMAGE_TRACEABILITY updated; DECISIONS.
- Next step: R2.1 tokens from concept B: replace felt/concrete/cobalt in `src/ui/tokens/tokens.css` + `base.css` @theme with
  sign/verge/mint/ink (keep compatibility aliases mapped onto the new world), swap fonts to `@fontsource-variable/overpass` +
  `overpass-mono` (Head.astro preload), then R2.5 (no-blue token test + grep), R2.3 primitives rebuilt as plates (no pills/knobs),
  R2.4 gallery, R3.1/R3.2 header/footer redo.

## 2026-11-12 14:05 UTC · Redesign R2.1 ✅ tokens (Route)
- `src/ui/tokens/tokens.css` rewritten (sign / mint / verge / ink + semantic roles, plate radius 7 px, inset ring, motion);
  `base.css` @theme + Overpass / Overpass Mono (`@fontsource-variable/overpass*` 5.3.0; Archivo + JetBrains removed); old names renamed
  across `src/ui`, layouts and /dev/ui; brand SVGs, favicon, OG render script, email + PDF + admin-page colours recoloured.
  New `tests/unit/ui-tokens.test.ts` (no-blue scan + contrast). Email snapshots updated (colour only). verify green (unit 419, integration 308).
- Visual check /, /dev/ui at 390/1440: tokens apply; primitives are still pills + knobs → R2.3 rebuild.
- Next step: R2.3 primitives as plates (Button/Segmented/Tabs/Rail/Accordion/StatusPill/Sheet + React twins) per concept B,
  rewrite `components.css` recipes; then /dev/ui (R2.4) and R2.5 grep/visual sign-off; R2.2 icon stroke 2.

## 2026-11-12 14:20 UTC · Redesign R2.2 ✅ · R2.3 ✅ plates · R2.4 ✅ gallery
- Icons: stroke 2 at 16–20 px, 1.75 at 24–32 (sign weight); ICONS.md audit updated (no knobs; gantry plates; road strip).
- Primitives: `components.css` button/link recipes rewritten as plates (7 px corners, inset ring via `--ring-plate`, white plate on
  sign); round arrow knob removed (`knob` prop → `arrow`, plain trailing arrow, Astro + React); new `.kz-shield` route shield;
  segmented, tabs bar (3 px, `--kz-bar`), accordion sign, rail dots and status tags squared; lit states use sign-950 text on mint.
- /dev/ui: Route copy, route shields, "Recommended". Visual loop at 375/390/430/768/1440: no overflow; ui-kit e2e 8/8; verify green.
- Header/Footer still carry `kz-btn--knob`/`kz-knob` markup (unstyled now) until the R3.1/R3.2 rebuild.
- Next step: R2.5 sign-off (grep, IMAGE-REQUESTS batch 1 rewritten for the green palette + owner notification), then R3.1 header +
  mobile sheet and R3.2 footer rebuilt from concept B (design/concepts/b) with "Get a quote" (wizard links removed per B.0c).

## 2026-11-12 14:35 UTC · R2.5b [~] multi-accent palette chosen (Zimbabwe earth) + premium hero prototype
- Owner added BRIEF B.0b+ (multi-accent), B.0e (premium hero), B.1a (phone hard limits) and tasks R2.5b, R2.6 while R2.3 was being pushed.
- Prototype `design/concepts/b2/index.html` (`?p=1|2|3`): Route structure re-cut with the workspace-window hero (crafted product
  composition, layered invoice card, no stock photo), route index (phone swipe track / desktop typographic index), route tabs,
  comparison table with "Recommended" in the column header. Phone 360/390/430: H1 32 px ≤ 3 lines, H2 24 px, no button wraps, no overflow.
- Palette board `docs/screenshots/redesign/concepts/palettes-b2-board.webp`; reviewer + author chose **P1 Zimbabwe earth**; tokens
  renamed sign→night, verge→bone, mint→gold, emerald action, six division hues, `.kz-div-1…6`; buttons solid; brand/email/PDF/OG
  recoloured; DESIGN_DIRECTION §2–10 updated. verify green (unit 419, integration 308).
- Next step (R2.5b remainder): port the hero to the real home (`src/ui/public/home/Hero.astro` + `WorkspaceWindow.astro` from b2,
  route index from real division data via `divisionFromPrice`), header CTA "Get a quote" → /contact, then IMAGE-REQUESTS batch 2
  (local workspace photos, warm-neutral grade) + owner notification; then R2.6 (mobile-limits guard spec in CI + boards).

## 2026-11-12 15:40 UTC · R2.5b ✅ · R2.5 ✅ · R2.6 ✅ · R3.1 ✅ · R3.2 ✅
- Home hero rebuilt (`src/ui/public/home/`: Hero, WorkspaceWindow, RouteIndex; `src/ui/tokens/home.css`): four-layer workspace
  window (dock, project + milestone strip + quotation + deliverables + activity log, weekly-update note, invoice with local
  methods), phone order headline → window → copy → CTA, route index (phone swipe track with dots via `[data-kz-track]`, desktop
  3 × 2 typographic index). Reviewer: FAIL → fixes → **PASS** ("premium, established"). Boards: `docs/screenshots/redesign/boards/
  home-hero-board.webp`, `home-first-screen-phones.webp` (360/390/430 vs old home vs webdev.co.zw).
- Header (Get a quote → /contact, Client workspace, division index with hue numerals and short names, no knobs/Floor labels) and
  footer ("Where next" routes, channels, short division names, newsletter `client:idle`, no wordmark overlay) rebuilt.
- R2.6 guard `tests/e2e/mobile-limits.spec.ts` (in the e2e suite, so in CI). Phone type scale in tokens (H2 24 px on phones).
- Fixed inherited red e2e (contact strict label, legal footer overlay, newsletter hydration, products hydration race).
- Next step: R3.3 (reveal framework already in controllers.ts: add reduced-motion e2e), then R4.1 home body rebuild (remove the
  `[data-legacy]` wrappers in src/pages/index.astro), R4.6b wizard removal + 301, R4.3 pricing.

## 2026-11-12 15:35 UTC · R3.3 ✅ motion framework
- CSS cross-document view transitions (180 ms, header held, off for reduced motion); reveal framework documented; `tests/e2e/
  motion.spec.ts` (reduced motion hides nothing / no entrance animations; reveal fires once on scroll). ui-kit spec waits for
  hydration (`openKit`).
- Next step: R4.1 home body rebuild in `src/ui/public/home/` (services night band with route tabs, why/process road strip,
  values, products modest, CTA) replacing the `[data-legacy]` wrappers in `src/pages/index.astro`; then R4.6b, R4.3.

## 2026-11-12 19:00 UTC · R4.1 ✅ home body
- Session started by the watchdog (session_01LWwAATz7q9Z5qUjZjvhSDT). Connectors: Figma, Canva, Cloudflare present; R2 `images/incoming/`
  empty; no `design/inbox/`; skills present. `npm ci` was needed.
- References opened: IMG_5056 (tabbed offering switcher on a dark band), IMG_5066 (numbered steps along a dashed route, dark "what we do"),
  IMG_5067 (title-left/link-right header, stepper with connecting line), IMG_5055 (numbered full-width rows).
- New `src/ui/public/home/`: ServicesBand (night band, route tabs with division hue swatch, packages + prices from the pricing catalogue,
  warm-duotone photo, Get a quote → `/contact?category=`), RoadStrip (S1–S5 on a road with a dashed centre line; phone swipe track),
  Approach (numbered ledger + drawn payment slip), CompanyBand (values 3-up, product with its real status, tools line), WorkRail and
  Voices (render only with published data). `src/ui/primitives/Picture.astro` (warm tone), `src/ui/tokens/sections.css`.
  Footer `lead` prop. Legacy deleted: ServicesGrid, WorkGallery, WorkGrid, ProductsGrid, Testimonials.
- Board + reviewer: FAIL → fixes → PASS. home.spec updated (tabs, panel prices, keyboard, quote preselect). verify green.
- Next step: R4.2 services index + division pages + service detail (rebuild in `src/ui/public/services/`, reuse ServicesBand ideas:
  route tabs for sub-services, packages ledger; delete legacy Features/Process/CtaBand users as they go), then R4.6b wizard removal + 301, R4.3 pricing.

## 2026-11-12 20:00 UTC · R2.5c ✅ Route drawings + image batch 3
- Owner added BRIEF B.4a + R2.5c during R4.1 (pushed R4.1 first, then did R2.5c). `src/ui/illustrations/DivisionArt.astro` (six division
  drawings, one system), `src/ui/tokens/illustrations.css` (colour roles, light/night, one `.i-move` motion), /dev/ui "Route drawings",
  DESIGN_DIRECTION §8a. Division 06 accent → lagoon #1C6E7A (token + test). Services band uses the drawings (no photos).
- IMAGE-REQUESTS: division photos and contact-street superseded (B.4a); batch 3 (6 new: about-hero, services-hero, home-band,
  how-we-work-editorial, how-we-work-band, careers-culture) + about-studio, careers-desk still wanted. Owner notified.
- Reviewer FAIL → fixes → PASS. verify green; home/mobile-limits/motion/ui-kit/public-layout e2e green.
- Next step: R4.2 services index + division pages + service detail in `src/ui/public/services/` using DivisionArt (division hero drawing,
  sub-service route tabs, packages ledger, quote CTA with `?category=`/`?service=`), photo only in the index hero (services-hero, interim
  treatment until delivered); then R4.6b wizard removal + 301, R4.3 pricing. Further drawings (features, process, industries, empty
  states, 404/500) are added to `src/ui/illustrations/` as each page needs them.

## 2026-11-12 21:00 UTC · R4.2 ✅ services index + division pages
- New `src/ui/public/services/`: ServicesHero (photo-led night hero), DivisionAtlas (drawing · display numeral · run-on services ·
  from figure; phone accordion), DivisionHeader (5/7 with the division drawing), ServiceLedger (ruled list), PackageCompare
  (IMG_5071 table, phone selector + full-width action). `src/ui/public/shared/PhotoBand.astro` (mid-page band + editorial card).
  `src/ui/tokens/services.css`. `fromSuffix` helper (+ unit test). Pages rewritten: `src/pages/services/index.astro`, `[slug].astro`.
- Board review: FAIL → recomposed → PASS. verify green (unit 445, integration 308); services/home/mobile-limits e2e green.
- Next step: R4.6b (wizard removal + 301 /start-a-project → /contact; contact form reads `?package=`; remove StartProjectWizard,
  wizard e2e, `startProjectHref`), then R4.3 pricing (reuse PackageCompare per pricing tab; price-accuracy test per B.6), R4.4–R4.8.
  Legacy `PackageCard` is still used by pricing and industries (removed in R4.3/R4.5).

## 2026-11-12 20:20 UTC · R4.6b ✅ wizard removed
- Session session_01LWwAAW1KK55fFrFWf8a2ch (hand-off). Connectors Figma/Canva/Cloudflare present; R2 `images/incoming/` empty; no `design/inbox/`; skills present.
- Deleted `StartProjectWizard.tsx` and `tests/e2e/start-a-project.spec.ts`; `src/pages/start-a-project.astro` is now a 301 to `/contact`
  (forwards package/category/service). Search index + sitemap entries removed; industries CTA → "Get a quote" /contact; PackageCard
  "Request this package" → `packageQuoteHref`. Contact page/form read `?package=` (division + service preselected, package line, message prefill).
- verify green (unit 445, integration 308); contact/pricing/industries/services-public e2e green (new redirect + preselect test).
- Next step: R4.3 pricing rebuild in `src/ui/public/pricing/` (hero rate card, sticky category control, plan deck with phone
  selector + swipe track, PackageCompare on desktop, service-rates ledger for "Other services", add-ons ledger), price-accuracy e2e (B.6).

## 2026-11-12 20:45 UTC · R4.3 ✅ pricing
- New `src/ui/public/pricing/`: PricingHero (rate-card slip = page index, lowest real price per category), PlanDeck (phone/tablet selector +
  scroll-snap track, recommended first via CSS order; ≥1200 plates in a row with a lifted night plate), ServiceRates (grouped-by-division night
  ledger for "Other services"; flat title-left ledger for "Email & domains"). `src/ui/tokens/pricing.css`. Page rewritten; PackageCompare reused
  (≥1200). SegmentedControl gained optional phone `short` labels. Footer never routes to the current page. Legacy ComparisonTable deleted.
- B.6: `tests/e2e/pricing-accuracy.spec.ts` (independent SQL against local D1). DESIGN_AUDIT §3 updated.
- Board + reviewer PASS, 8 fixes applied. verify green; pricing/accuracy/contact/mobile-limits/public-layout/services/ui-kit/home e2e green.
- Tiers used (CLAUDE.md §2b): build + integration by the orchestrator; B.0d review subagent opus/medium.
- Next step: R4.4 Our Work / portfolio + case study (`src/pages/work/*`, empty state that looks designed, drawings from
  `src/ui/illustrations/`), then R4.5 (About, How we work, Industries — removes the last PackageCard user —, Technologies), R4.6 contact/consultation, R4.7.

## 2026-11-12 21:05 UTC · R4.4 ✅ Our Work
- New `src/ui/public/work/` (WorkEmpty, WorkGrid), `src/ui/illustrations/SceneArt.astro` (`case-files`), `src/ui/tokens/work.css`; `/work` and
  `/work/[slug]` rewritten; `getPortfolioGallery` (repo + service + integration test). Reviewer FAIL → 6 fixes applied (see QA_REPORT).
- verify green (unit 453, integration 308); work/public/mobile-limits/sweep/links e2e green.
- Tiers: orchestrator build; B.0d review opus/medium.
- Next step: R4.5 About, How we work, Industries (replace legacy PackageCard with PlanDeck/ServiceRates or a compact package ledger, then
  delete `src/components/public/pricing/PackageCard.astro`), Technologies. Then R4.6 contact + consultation (forms), R4.7, R4.8.

## 2026-11-12 21:30 UTC · R4.5 ✅ About, How we work, Industries (+ Technologies)
- Session session_01LWwAASfvBAwWzqqTKCD67U (hand-off). Connectors Figma/Canva/Cloudflare present; R2 `images/incoming/` empty; no `design/inbox/`; skills present.
- New `src/ui/public/about/` (AboutHero with the six-area route plate, Statements, ValuesLedger, ApproachLedger), `src/ui/public/how/`
  (HowHero scope-sheet composition, ProcessRoad, Models, Expect, Quality, Tools), `src/ui/public/industries/IndustryIndex.astro`;
  SceneArt `signpost` + `junction`; `src/ui/tokens/company.css`. Pages rewritten: `/about`, `/how-we-work`, `/industries`, `/industries/[slug]`
  (sector hero uses the lead area's DivisionArt; packages via PlanDeck). PlanDeck: scope note when a package has no stored facts/features.
- Legacy deleted: PackageCard, sections/{CtaBand,Features,ListSection,PhotoPair,Process,RichText,Statement,TechnologiesStrip,Values}.
  Remaining legacy public sections: Hero, SectionHeading (R4.7 pages).
- Boards: about, how_we_work, industries, industry_retail. Reviewer: How we work + Industries PASS; About + Retail FAIL → 10 fixes applied.
- verify green (unit 465, integration 308); about/industries/site-content/mobile-limits/pricing/pricing-accuracy/public-layout/links/ui-kit/motion/
  services-public/sweep/engagement/public e2e green.
- Tiers (CLAUDE.md §2b): build by the orchestrator; B.0d review impeccable-finish-reviewer opus/medium.
- Next step: R4.6 contact + consultation booking (`src/pages/contact.astro`, `consultation.astro`, `src/components/forms/ContactForm.tsx` →
  new markup in `src/ui/public/forms/`, keep the submit handlers/endpoints; `?category=`/`?service=`/`?package=` preselect stays), then R4.7, R4.8.

## 2026-11-12 21:50 UTC · R4.6 ✅ Contact + consultation
- New `src/ui/public/forms/` ContactForm (three numbered parts + always-on "You are sending" preview), ConsultationForm, `useEnquiry` hook,
  Channels (ledger + phone quick row), Turnstile moved here; `src/ui/tokens/contact.css`. `/contact` and `/consultation` rewritten
  ("After you send" road stops, night consultation band). Old ContactForm/ConsultationForm deleted.
- Board review FAIL → 6 fixes applied. verify green (unit 471, integration 308); contact/engagement/mobile-limits/about/industries/
  public-layout/sweep + security/portal-auth/checkout/full-journey/careers/products e2e green.
- Tiers: orchestrator build; review opus/medium.
- Next step: R4.7 Insights/blog, Careers (+ apply, InterestForm/ApplicationForm → new forms using useEnquiry-style hooks), FAQ, Products
  (in-development item modest), legal, search, 404/500; remove legacy `src/components/public/sections/{Hero,SectionHeading}` and other
  public legacy as their last users go. Then R4.8 public documents/checkout.

## 2026-11-12 22:40 UTC · R4.7 ✅ Insights, Careers, FAQ, Products, legal, search, 404/500
- Session session_01LWwAASupazd6tkRyoY9mQD (hand-off). Connectors Figma/Canva/Cloudflare present; R2 `images/incoming/` empty; no `design/inbox/`; skills present.
- New: `src/ui/public/insights/` (InsightsIndex, lib + unit test), `src/ui/illustrations/CoverArt.astro`, `src/ui/public/careers/*`,
  `src/ui/public/products/*`, forms `ApplicationForm`/`useApplication`/`FileField`/`InterestForm`, tokens `insights.css`, `careers.css`, `pages.css`.
  Pages rewritten: insights (index, category, tag, article), careers (index, role, apply), products, faq, legal, search, 404, 500.
- Legacy deleted: `src/components/public/` (insights, sections Hero/SectionHeading, Icon), `ResponsiveImage.astro`, forms ApplicationForm/InterestForm.
- Boards + reviewer: 8/8 PASS, 4 fixes applied (QA_REPORT). verify green (unit 492, integration 308); e2e green: insights, legal, site-content, public, careers, products, careers-admin, mobile-limits, sweep (404 entrance removed after an axe mid-fade contrast hit), links, public-layout, motion, security.
- Tiers (CLAUDE.md §2b): insights/FAQ/legal/search/404 by the orchestrator; careers+products subagent opus/medium (reviewed by screenshots);
  B.0d review opus/medium.
- Next step: R4.8 public documents + checkout (`/q/`, `/i/`, `/pay/…`): `src/components/documents/*`, `src/components/payments/*`,
  `src/components/forms/QuotationResponse.tsx`, `layouts/DocumentLayout.astro` → new `src/ui/public/documents/` + `src/ui/public/checkout/`
  (extract `useCheckout`), payment e2e (`checkout`, `public-documents`, `full-journey`) must stay green. Refs IMG_5013, 5014, 5016, 5018.

## 2026-11-13 05:20 UTC · R4.8 ✅ Public documents + checkout (R4 complete)
- New: `src/layouts/DocumentLayout.astro` (rewritten on Base), `src/ui/documents/` (DocumentSheet + Quotation/InvoiceSheet, DocAside,
  QuotationResponse + useQuotationResponse), `src/ui/public/checkout/` (useCheckout, useAttemptStatus, Checkout, parts, WalletCode, OtpBoxes,
  BankPanel, AttemptResult, CardReturn, CheckoutSummary), tokens `documents.css`, `checkout.css`; icon `bank`. Admin + portal document views use
  the new sheets. Deleted: `src/components/documents/*`, `src/components/payments/*`, `forms/QuotationResponse.tsx`.
- verify green (unit 510, integration 308); e2e 31/31 + 10/10 re-run (payments, documents, portal, sweep). Reviewer 2/2 PASS.
- Tiers: documents by the orchestrator; checkout subagent opus/high (payments); review opus/medium.
- Housekeeping: remote branches `wip/r4.7` and `wip/r4.8` are stale checkpoints (the proxy refused branch deletion); safe to delete.
- Next step: R5.1 workspace shell (`src/layouts/PortalLayout.astro` → new WorkspaceLayout in `src/ui/workspace/`; PANEL_DESIGN_SPEC.md; Linux-
  inspired: side dock, status bar, window/panel pattern, command palette, mobile bottom dock + sheet, light/dark). Then R5.2–R5.4.
  Portal still uses legacy `components/portal/*` (incl. AttemptStatus for `/portal/payments/attempts/[id]`).

## 2026-11-13 05:45 UTC · R5.1 ✅ Workspace shell
- PortalLayout rewritten (Base, night status bar + side dock, bone desk, phone bottom dock + More sheet, ⌘K palette, online indicator);
  `src/ui/workspace/{nav.ts,AccountMenu.tsx,MoreSheet.tsx,CommandPalette.tsx,Window.astro}`, `src/ui/primitives/menu.tsx`, `workspace.css`;
  unit test `workspace-nav.test.ts`. Legacy `PortalUserMenu` no longer used by the layout (PortalAccount.tsx still hosts ProfileForm etc.).
- Shots: /portal at 390, 768, 1440 + palette (signed in as the e2e client on a local `wrangler dev`; the astro dev server's API origin check
  blocks sign-in on :4400). verify green (unit 521, integration 308); e2e 22/22 (portal-auth, checkout, subscriptions, quotations, invoices,
  security, full-journey, sweep) after fixing an axe label/content mismatch on the "Jump to…" button.
- Next step: R5.2 Overview + projects: rebuild `src/pages/portal/index.astro`, `projects/index.astro`, `projects/[id].astro` bodies with
  Window (`src/ui/workspace/Window.astro`) in `.kz-wgrid` (PANEL_DESIGN_SPEC §2: Balance 8 / Waiting 4, Active projects 6 / Activity 6;
  projects list 4 + project 8, milestones as a road strip, updates feed, deliverables, message composer → extract ProjectMessageForm logic).
  Keep `data-testid="portal-unlinked"` and the e2e headings ("Hello, Kuda", etc.).

## 2026-11-13 06:30 UTC · R5.2 ✅ Workspace overview + projects
- Session session_01LWwAAW9DLLvVL6SY9oRFYR (hand-off). Connectors Figma/Canva/Cloudflare present; R2 `images/incoming/` empty; no `design/inbox/`; skills present.
- New: `src/ui/workspace/{PageHead.astro,Progress.astro}`, `src/ui/workspace/projects/{ProjectList.astro,MessageComposer.tsx,useProjectMessage.ts}`;
  R5.2 section in `src/ui/tokens/workspace.css`. Rewritten: `/portal` (Balance 8 / Waiting 4, Active projects 6 / Activity 6, phone sticky Pay bar),
  `/portal/projects` (list; from 1024 px list 4 + Schedule 8), `/portal/projects/[id]` (list 4 + Progress/Deliverables, milestone rail, updates log,
  thread + composer). Deleted `components/portal/ProjectMessageForm.tsx`. Test hooks unchanged.
- Boards portal, portal_projects, portal_project: first review Projects FAIL → master/detail etc.; second review 3/3 PASS.
- verify green (unit 526, integration 308); e2e portal-auth, full-journey, security, sweep 14/14.
- Tiers (CLAUDE.md §2b): build by the orchestrator; B.0d review impeccable-finish-reviewer opus/medium (2 rounds).
- Note: `.kz-*` class names are global; check `grep -rn "\.kz-<name>" src/ui/tokens` before adding one (four collisions found this task).
- Next step: R5.3 quotations, invoices, payments/receipts, saved cards, subscriptions/services: rebuild `src/pages/portal/{quotations,invoices,payments}/*`
  and `services.astro` with PageHead + Window + list/detail (reuse `.kz-wlist/.kz-wrow`, `.kz-pview` master/detail pattern); documents already use
  `src/ui/documents/*`; replace `components/portal/{StatusPill.astro,AttemptStatus.tsx,SavedCards.tsx}` (extract logic to hooks); keep testids
  `portal-how-to-pay`, `assets` and e2e labels (see tests/e2e/portal-auth.spec.ts, checkout, subscriptions, invoices, quotations specs).

## 2026-11-13 08:10 UTC · R5.3 ✅ Workspace quotations, invoices, payments, services
- New `src/ui/workspace/finance/` (DocSummary, FilterNav, SavedCards + useSavedCards, AutoCharge + useAutoCharge, tone.ts) and a "Workspace finance
  (R5.3)" CSS section. Rewritten: portal quotations (list, detail), invoices (list, detail, pay), payments (list, attempt), services; support pages
  switched to the new StatusPill. Deleted `components/portal/{StatusPill.astro,AttemptStatus.tsx,SavedCards.tsx}`. Paper-sheet figures now mono.
  Site-wide: U+00B7 from Overpass Mono (base.css).
- verify green (unit 533, integration 308); e2e green (see QA_REPORT). Boards 5/5 PASS (two review rounds).
- Tiers: build subagent opus/medium (two rounds); review impeccable-finish-reviewer opus/medium (two rounds); services fix + review by orchestrator.
- Tip: restart `wrangler dev` after `npm run verify` before running e2e (the rebuild swaps chunk hashes under the server).
- Next step: R5.4 support, profile, devices, auth screens + dark theme. Pages: `src/pages/portal/support/{index,new,[id]}.astro`,
  `account/{index,sessions}.astro`, `mfa/{index,setup}.astro`, `login`, `register`, `forgot-password`, `reset-password`, `accept-invite`,
  `verify-email`, `password`; legacy `components/portal/{PortalAccount.tsx,SupportForms.tsx}` and `components/auth/*` (check admin auth uses them:
  admin auth screens may share; PANEL_DESIGN_SPEC §4 split layout, IMG_5017). Dark theme: cookie-remembered `data-theme` rendered by the server in
  PortalLayout, toggle in the account menu/More sheet; night-900 desk, night-800 windows; check every workspace page for contrast in dark (axe).

## 2026-11-13 10:00 UTC · R5.4 ✅ Support, account, devices, auth screens, dark theme (R5 complete)
- New `src/layouts/AuthLayout.astro`, `src/ui/auth/*` (useAuthForms + forms, FormAlert, QrCode), `src/ui/workspace/account/*`, `src/ui/workspace/support/*`,
  `src/ui/workspace/theme.ts` (+ unit test), `src/ui/tokens/auth.css`. All portal + admin auth pages, support, account, sessions, MFA rebuilt; dark theme
  (cookie `kz_theme`). Deleted `components/auth/AuthForms.tsx`, `components/portal/{PortalAccount,SupportForms}.tsx` (`components/portal/` is now empty
  of UI). `components/admin/AccountActions.tsx` remains (admin, R6).
- verify green (unit 555, integration 308); e2e green (QA_REPORT). Boards: support list re-done after review; others PASS.
- Tiers: build subagent opus/medium (2 rounds); review impeccable-finish-reviewer opus/medium.
- Next step: R6.1 admin shell (`src/layouts/AdminLayout.astro` → rewrite from scratch on Base: night sidebar 248 px with grouped modules
  (Overview · Sales · Finance · Delivery · Website · Administration), collapsible to 64 px, bone top bar with search/⌘K (extract logic of
  `components/admin/CommandPalette.tsx` to a hook), NotificationsBell + UserMenu rebuilt in `src/ui/admin/`; phone: top bar + left sheet;
  PANEL_DESIGN_SPEC §3, compact density, light only). Keep every admin e2e hook (admin-shell spec, sweep). Then R6.2 module by module.

## 2026-11-13 11:50 UTC · R6.1 ✅ Admin shell
- `src/layouts/AdminLayout.astro` rewritten (same props); `src/ui/admin/{nav.ts,useAdminSearch.ts,useNotifications.ts,account.ts,AdminPalette.tsx,
  AdminNotifications.tsx,AdminUserMenu.tsx,Pane.astro}`, `src/ui/tokens/admin.css`, unit test `admin-nav.test.ts`. Deleted old admin CommandPalette,
  NotificationsBell, UserMenu, `layouts/AppLayout.astro`, `components/BaseHead.astro`. Menu primitive gained an optional `header`.
- Review round 1 FAIL on spec detail (top bar height/type, red badge, sidebar overflow, user trigger, notification weights) → fixed.
- verify green (unit 569, integration 308); e2e admin-shell, sweep, users-admin, security, settings, clients, invoices, reports, content-admin, leads green.
- Usage limit hit once mid-task (reset 11:30 UTC); the builder resumed. A snapshot of the in-progress fixes was pushed to `wip/r6.1-fixes` (stale; safe to delete).
- Next step: R6.2 admin modules, one group at a time with `src/ui/admin/Pane.astro` + list/table pattern (dense; mobile list rows; filters in a bottom
  sheet on phones; sticky save bar on forms). Order: dashboard (KPI strip as one grooved row of mono figures, charts in panes) → Sales (enquiries, leads,
  clients, quotations) → Finance (invoices, payments, subscriptions, managed services, expenses, reports) → Delivery (projects, time, support) →
  Website (pages, services, packages, content, media, careers) → Administration (users, settings, audit, notifications). Islands in
  `src/components/admin/*Admin.tsx` hold the logic: extract into hooks under `src/ui/admin/<module>/`, new markup, delete old. Keep every admin e2e hook.

## 2026-11-13 11:45 UTC · Image delivery (B.4): 6 owner photos from design/inbox
- Identified by content: about-hero, services-hero, home-band, how-we-work-editorial, how-we-work-band, careers-culture (all 1448×1086,
  quality OK: hands clean, no text artefacts; about-hero has a flag edge at far left, cropped off by the hero's object-position).
- `scripts/images/process.mjs` now reads owner prompts from `docs/redesign/IMAGE-REQUESTS.md` (B.4). Processed into `public/images/site/`
  + manifest; inbox emptied. About, Services and How-we-work band pick them up automatically (screens checked at 390/1440, no overflow).
- Still to place in R7.1: home-band (Home "Why Kuzikode"), how-we-work-editorial, careers-culture. Still requested: about-studio, careers-desk.
