# Progress Log

The agent appends a new entry at the top after every task, and always before a session ends.
The **Next step** line must be specific enough that a fresh session can continue without guessing.

## Current status
- Phase 1, 2 and 3 complete except **P3.18 site imagery** (Workers AI daily quota; retry later). Phase 4 (administration) in progress.
- Last completed task: **P4.8 PDF engine** (P4.1–P4.8 done).
- **Next step:** P4.9 Invoices — module `server/modules/invoices` (draft editor reusing `LineItemEditor`, issue with snapshot + gap-free
  number + public token via `lib/public-links.ts` `documentToken(ctx, 'invoice', id)` (the PDF already prints `/i/<token>`), queue
  `pdf.generate` {kind:'invoice'} in the issue batch, send/resend email, manual payments + allocations (receipt PDF via kind 'receipt'),
  overpayment → client credit, apply credit, void rules, status history, overdue cron, reminder schedule with dedupe), admin pages
  `/admin/invoices*` with "Download PDF" → `/api/v1/admin/documents/invoices/:id/pdf`, public `/i/[token]` + a public invoice PDF route
  in `modules/documents/routes.ts`. Then P4.10 credit notes (PDF kind 'credit_note' is ready).
- Staging URL: — (workers.dev subdomain `mhodieknowledge`) · Figma file: https://www.figma.com/design/xB9rBVFa7BKitPiUqcYdhh · CI: green on main

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

