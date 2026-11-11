# Progress Log

The agent appends a new entry at the top after every task, and always before a session ends.
The **Next step** line must be specific enough that a fresh session can continue without guessing.

## Current status
- Phases 1–5 complete except **P3.18 site imagery** (Workers AI daily quota; retry later). Phase 6 (payments & email) in progress.
- Last completed task: **P7.1 Full E2E journey** (2026-11-11). Phase 6 done except P6.5 `[!]` (owner's Faked Success). P6.5 is `[!]` (Faked Success needs the owner, staging re-run in P8.2). Saved cards wait on Paynow approving tokenization (BLOCKERS).
- **Next step:** **P7.2 Security suite** (roadmap + docs/08 §4 "security.spec.ts": client B can't open client A's invoice/project/file
  URLs (404), Content Manager can't reach invoices, logged-out access redirects to login, `/admin` never indexed), then run the
  `/security-review` skill (or a manual OWASP pass over auth, portal scoping, uploads, payments) and fix findings. Also check
  user-facing Zod messages: a few schemas still have `.regex()` without a message (mostly hidden ID/select fields; see P7.1 entry).
- **For P8.2 (staging):** send a test email from staging (Admin → Settings → email test) and confirm `delivered` arrives through the
  Resend webhook once the owner has configured it (BLOCKERS); re-run `LIVE_RESULT_URL=https://<staging>/api/payments/callbacks/paynow/<accountId> npm run test:payments:live`
  so Paynow's result URL is reachable, and record it.
- Staging URL: — (workers.dev subdomain `mhodieknowledge`) · Figma file: https://www.figma.com/design/xB9rBVFa7BKitPiUqcYdhh · CI: green on main
- New entries are appended at the **bottom** of this file.

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
