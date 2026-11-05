# 01 — Product Requirements Document: Kuzikode Technologies Platform

Status: **Approved by owner. Build all of it.** This is the scope source of truth.
How to work: `CLAUDE.md`. Stack: `02-TECH-DECISIONS.md`.

---

## 1. Company

- **Name:** Kuzikode Technologies. Proposed legal name: *Kuzikode Technologies (Private) Limited*.
  Never state or imply that the company is registered. The footer says "Kuzikode Technologies" only,
  until the owner enters a registration number in Settings. If one is set, show it.
- **Intended domain:** `kuzikode.com`. Not assumed registered. All URLs come from the `PUBLIC_SITE_URL`
  environment variable. Must work on `*.workers.dev` first.
- **Location:** Zimbabwe. **Market:** Zimbabwe → Africa → international.
- **What it is:** a technology company that designs, builds and runs digital solutions for businesses,
  organisations and individuals. It presents as a capable technology partner, not a freelance web shop.
- **Positioning line:** "Building intelligent digital solutions."
- **Brand personality:** modern, credible, innovative without gimmicks, intelligent, confident,
  approachable, internationally credible.
- **Copy rules:** plain, specific, confident sentences. Banned: "unlock", "elevate", "seamless",
  "cutting-edge", "revolutionize", "in today's fast-paced world", "leverage synergies", "empower your
  journey", emoji in headings, exclamation marks in headlines. Say what Kuzikode does, for whom, and how.

## 2. Scope

**In scope (one integrated platform):**
1. Public company website · 2. Admin portal (`/admin`) · 3. Client portal (`/portal`) ·
4. Clients & leads · 5. Service catalogue · 6. Quotations & proposals · 7. Invoicing ·
8. Payments with reusable provider abstraction (PesePay first) · 9. Projects & milestones ·
10. Expenses · 11. Website CMS · 12. Notifications & email · 13. Reports & analytics ·
14. **Priced packages, care plans & subscriptions** · 15. **Careers & recruitment** · 16. **Extended website** (pricing page,
start-a-project wizard, industries, insights/blog, how we work, FAQ, consultation booking, WhatsApp chat, newsletter) ·
17. **Time tracking, 2FA, managed-services register** · 18. **Site imagery generated once during development** (not a platform feature).
Items 14–17 are specified in **`docs/12-COMMERCIAL-FEATURES.md`** and item 18 in **`docs/13-IMAGERY.md`**. Both carry the same authority as this PRD.

**Out of scope:** Kuzikode Business Suite (POS, ERP, Finance, HR, Payroll, CRM modules). It appears
only as a product card on the Products page, labelled **"In Development"**. No pricing, no signup,
no "buy", no waitlist that implies availability. An optional "Register interest" form is allowed. It
creates an enquiry with category `product_interest`.

## 3. Public website

Navigation: **Home · About · Services ▾ · Pricing · Our Work · Insights · Contact · Client Portal** (portal is a
button-style link at the right). A primary **"Start a project"** button sits beside it. "Services ▾" is a mega-menu: the six
divisions plus Industries and How we work. "Products" and "Careers" sit under an "About ▾" group (About, How we work, Products,
Careers, FAQ). Careers is promoted to the top level while roles are open (docs/12 §B). Footer: company blurb, service links, company
links (About, Careers, Insights, FAQ, Pricing), contact details from Settings, social links from Settings, newsletter signup, legal
links (Privacy Policy, Terms of Use, Service Terms, Cookie notice, Accessibility), © year.

### 3.1 Home
Hero (positioning, one-sentence intro, primary CTA "Start a project" → contact with category preset,
secondary CTA "Explore services"). Services overview (6 divisions). "Why Kuzikode" (approach-based
claims only: e.g. "Built for the African market: local payment rails, low-bandwidth performance";
no stats). Selected work (featured portfolio entries; **the section is hidden if there are none**).
Values & approach. Products preview (Business Suite: In Development). Enquiry CTA band. Footer.
Every section is a CMS-managed `website_section` (title, body, order, visibility).

### 3.2 About
Overview, Our story, Mission, Vision, Core values, Objectives, Approach to technology & problem-solving.
All CMS-editable. Seed defaults:
- **Mission:** "To empower businesses and organisations through accessible, intelligent and dependable
  technology solutions that solve real-world problems."
- **Vision:** "To become a leading African technology company, creating impactful digital solutions
  that contribute to business growth and technological advancement."
- **Values:** Excellence · Innovation · Integrity · Customer commitment · Continuous growth (each with
  a one-to-two-sentence description written by you).
- No team section unless the owner adds team members via the CMS (optional `team_members` content type).

### 3.3 Services: six divisions
Index page `/services` + one page per division `/services/[slug]`. Each page has: description,
sub-services (each with a short description), benefits, typical deliverables, engagement/pricing model
display (from the service's pricing model), FAQ (optional), CTA "Request a quotation" → contact form
with division + sub-service preselected.

| Slug | Division | Sub-services |
|---|---|---|
| `web-development` | Web Development & Digital Solutions | Corporate & business websites; E-commerce platforms; Web applications; Customer & employee portals; Custom dashboards; Website redesign & optimisation |
| `mobile-desktop-apps` | Mobile & Desktop Application Development | Android; iOS; Windows; macOS; Cross-platform; Custom enterprise applications |
| `business-software` | Business Software & Enterprise Systems | Custom ERP; POS systems; Inventory & warehouse; HR & payroll; CRM; Business management platforms |
| `ai-data` | AI, Data & Intelligence | AI-powered applications; Data analytics; Business intelligence; Predictive analytics; Data processing; Intelligent document processing |
| `automation-integration` | Automation & Systems Integration | Business process automation; API development; Third-party integrations; Payment gateway integration; Workflow automation; System modernisation |
| `cloud-it` | Cloud, Infrastructure & IT Solutions | Cloud deployment; Domain management; Business email; Database design & management; Server configuration; Backups & maintenance; Technical support |

Division pages also show that division's **priced packages** (docs/12 §A), e.g. Starter / Business / E-commerce website plans,
care plans, and business email & domains.

Each service and sub-service has a status: `active` | `coming_soon` | `inactive`. Inactive = not
rendered. Coming soon = rendered with a neutral "Coming soon" badge and **no** quotation CTA.
Everything is editable in Admin → Services.

### 3.4 Our Work
Portfolio grid with category filter + case-study pages `/work/[slug]`. Fields: name, client name
(optional, plus a "client name may be shown" flag), summary, description, challenge, solution,
technologies (tags), images/screenshots (R2, alt text required), category, completion date, external
URL, featured flag, status (`draft` | `published`). **Ships with zero entries.** Empty state copy:
"Case studies are being prepared. Talk to us about what we can build for you." + contact CTA.
Never seed fake projects into production.

### 3.5 Products
Product cards from CMS `products` (name, tagline, description, status: `in_development` | `beta` |
`available`, optional interest form). Seed: **Kuzikode Business Suite: In Development** with an
honest description of the direction (integrated business management for African SMEs). No dates promised.

### 3.6 Contact
Form: name, email, phone (optional), organisation (optional), enquiry category (General, Project
quotation, one per service division, Support, Partnership, Product interest), service (optional,
dependent dropdown), budget range (optional), message, consent checkbox (privacy policy).
Protected by Turnstile + honeypot field + server-side Zod validation + per-IP rate limit.
On submit: stored in `enquiries`, outbox job emails the admin notification + acknowledgement to the
sender, admin in-app notification created. Show a success state with a reference number.
Also show: business email, phone, WhatsApp link (optional), location, social links, all from Settings.
Fields left blank in Settings are hidden, never shown as placeholders.

### 3.7 Legal pages
Privacy Policy (covers what the forms collect, retention, contact for data requests, and Zimbabwe's
Cyber and Data Protection Act [Chapter 12:07] as context), Terms of Use, Cookie notice (strictly necessary
cookies only). All CMS-editable. Mark them for the owner to have reviewed by a lawyer (BLOCKERS.md).

## 4. Admin portal (`/admin`)

Login at `/admin/login`. No public admin registration. Layout: collapsible sidebar (grouped:
Overview · Sales · Finance · Delivery · Website · System), top bar (global search, notifications bell
with unread count, user menu), content area. Every list: server-side search, filters, sort, pagination
(25/page default), empty/loading/error states, row actions with confirmation dialogs for destructive
operations, toasts for results. Keyboard accessible. Responsive down to tablet. Usable on phone.

### 4.1 Dashboard (all real data, permission-filtered)
KPI tiles: Total revenue received (all time, per currency), Revenue this month, Outstanding (sum of
open balances), Overdue (count + amount), Pending quotations, Active projects, Completed projects,
New enquiries (last 7 days). Charts: monthly revenue received (12 months, per currency, no FX
conversion; currencies are never summed together), invoices issued vs paid. Lists: recent payments,
recent activity (audit feed), upcoming due invoices, upcoming milestones.

### 4.2 Modules
**A. Clients.** Individual or business. Fields: display name, legal name, type, email, phone, website,
tax number (e.g. ZIMRA BP/VAT number, optional), billing address, physical address, default currency,
payment terms (days), notes, tags, status (`active` | `archived`). Contacts (many per client; one
primary, one billing). Tabs on the detail page: Overview, Contacts, Quotations, Invoices, Payments, Projects,
Files, Notes, Activity, Portal access. Archive instead of delete. Hard delete only allowed for
clients with no financial records.

**B. Leads & enquiries.** Website enquiries land in `enquiries`. Staff can triage an enquiry into a
lead (or create leads manually). Lead fields: source, status (`new` → `contacted` → `qualified` →
`proposal_sent` → `won` | `lost`), assigned user, requested services, estimated value + currency,
next follow-up date, notes, follow-up log. **Convert lead → client** (creates client + primary contact,
links lead, optional draft quotation). Follow-up reminders show in notifications.

**C. Services.** CRUD divisions (categories) and services/sub-services: slug, name, summary,
description (rich text), benefits, deliverables, FAQ, icon, pricing model (`fixed` | `hourly` |
`starting_from` | `custom_quote`), price minor + currency (when applicable), status, featured,
sort order (drag-to-reorder), SEO fields. These items also feed the quotation line-item picker.

**D. Quotations & proposals.** Number (configurable format, default `QUO-{YYYY}-{SEQ:4}`), client,
contact, title, intro/proposal body (rich text, optional, for "proposal" style), line items (service
link optional, description, quantity as decimal string with up to 3 dp, unit price minor, per-line
discount % or amount, tax rate), document-level discount, tax configuration, currency, issue date,
valid-until date, payment terms, notes, T&Cs, attachments. Statuses: `draft` → `sent` → `viewed` →
`accepted` | `rejected` | `expired`; `void`. Actions: duplicate, send (email with public link), PDF,
revise (creates new version, previous version kept read-only), mark accepted/rejected on behalf of client
(audited). Public link `/q/[token]`: view, download PDF, accept (typed name + checkbox, records IP/UA/time),
reject (optional reason). Accepted quotation → **Convert to invoice** (idempotent: a unique constraint on
`invoices.source_quotation_id` + returning the existing invoice on repeat) and/or **Create project**.

**E. Invoicing.** See §8 for financial rules. Number format default `INV-{YYYY}-{SEQ:5}`, gap-free per
sequence, generated atomically. Draft (fully editable, no number until issued, or number on issue:
choose **number on issue**) → Issued (immutable lines, snapshot of client + business details, PDF
generated, public link `/i/[token]`, email sent) → Partially paid / Paid / Overdue (derived) →
Void (requires reason, audited, only allowed if no payments are applied; otherwise issue a credit note).
Features: multiple line items, discounts, configurable taxes (inclusive/exclusive), subtotal/tax/total,
currency, due date from payment terms, notes, T&Cs, payment history, outstanding balance, record
manual payment (bank transfer, cash, EcoCash manual, etc.), partial payments, overpayment → client
credit balance (never silently discarded), credit notes (full/partial, numbered `CN-{YYYY}-{SEQ:4}`,
PDF), automatic overdue detection (cron), payment reminders (configurable schedule: e.g. 3 days before
due, on due date, 7 and 14 days after), resend email, download PDF.

**F. Projects.** Reference `PRJ-{YYYY}-{SEQ:4}`, client, name, description, start date, target date,
status (`planning` | `active` | `on_hold` | `completed` | `cancelled`), budget (optional, minor +
currency), members (staff users with project role), milestones (title, due date, status, client-visible
flag, linked invoice optional), tasks (title, assignee, status, due date, milestone), progress % (derived
from milestones/tasks, overridable), internal notes, client-visible updates (post → client notified),
files/deliverables (R2, client-visible flag), activity history. Create from accepted quotation (copies
line items into milestones/tasks scaffold).

**G. Expenses.** Date, category (CRUD), vendor, description, amount minor + currency, payment method,
reference, receipt attachment (R2), optional project/client link, notes, status (`recorded` | `void`).
Reports: by category/month/currency, CSV export. Label in UI: "Expense records. This is not a
statutory accounting system."

**H. Payments.** All payment transactions across providers + manual. Filters: status, provider,
method, currency, date range, client, invoice. Detail: attempts, provider reference, events timeline
(redacted raw payloads), failure reason, linked invoice(s). **Reconcile** button (re-check status
with provider). Refunds: record manual refunds and use provider refund API where supported (PesePay
has none documented, so record manually and adjust via credit note). Unmatched/uncertain queue.

**I. Website CMS.** Homepage sections, About content, mission/vision/values/objectives, services,
portfolio, products, announcements (site-wide banner with start/end dates), contact details, social
links, legal pages, per-page SEO title/description/OG image. Draft/publish with preview. Publishing
bumps `content_version` (cache bust). Media library (R2, image validation, alt text required).

**J. Notifications.** In-app (bell + `/admin/notifications`) and email, per-user preferences per
type: new enquiry, quotation viewed/accepted/rejected, invoice issued, payment received, payment
failed, invoice overdue, milestone updated, client registered, support request created/replied,
security (new login, password changed, password reset).

**K. Settings.** Company info (name, legal name, registration no., tax no.), logo + invoice branding
(logo, accent colour, footer text), addresses, business email, phone, website URL, document numbering
formats + next sequence (raising it is allowed, lowering it is not), default currency, supported currencies
(seed USD + ZWG), tax rates (seed: "VAT 15.5%" **inactive by default**; the owner must confirm the
current ZIMRA rate and registration status before enabling it), payment providers (enable/disable,
sandbox/production mode, display name, non-secret options; secrets are only via Worker secrets, and the
UI shows "configured / not configured"), email provider status + test-send button, notification preferences,
users (invite staff, deactivate, reset 2FA/password), roles & permissions matrix, audit log viewer
(filter by actor, entity, action, date; export CSV), data export (CSV/JSON per module).

**L. Reports.** Revenue by month/client/service/currency, outstanding & ageing (0–30/31–60/61–90/90+),
quotation conversion rate, expenses by category, profit indicator (revenue received − expenses, per
currency, labelled "indicative"). CSV export. Date-range filters.

**M. Support inbox.** Support requests from the portal: threaded messages, status (`open` |
`awaiting_client` | `resolved` | `closed`), priority, assignee, attachments.

## 5. Client portal (`/portal`)

Distinct, calmer design from admin (see design doc). Features: invitation acceptance (set password),
login, logout, password reset, email verification, profile (name, phone, password change, active
sessions with revoke), company/contact info view (edit requests go to admin as a support request, or
editable contact phone only), quotations (list, view, PDF, accept/reject), invoices (list with
status, view, PDF, **Pay now**), payment history + receipts (PDF), credit notes, projects (status,
milestones, client-visible updates, progress), deliverables download, support requests (create, reply,
attachments), message thread per project ("Communicate with Kuzikode").

**Access rules:** a portal user is linked to one or more clients via `client_user_access` (role
`owner` | `member` | `billing`). Every query is scoped by the linked client IDs **on the server**.
Accounts are created only by admin invitation. Optional self-registration (off by default, setting)
creates an *unlinked* account that sees nothing until an admin approves the link. Matching emails
never auto-link.

## 6. Payments
See `06-PAYMENTS.md` (normative). Hosted redirect checkout via PesePay first, behind a provider
interface, plus a mock provider that only works in development/test and is visibly labelled
"TEST PAYMENT" everywhere.

## 7. Email & documents
Email provider interface with a Resend adapter + a dev "log" adapter (writes to `email_logs` and to
the console, plus a dev-only `/admin/dev/mailbox` viewer). Templates (HTML + plain text, branded,
light-mode-safe, tested in Gmail/Outlook widths): staff invitation, client invitation/welcome, email
verification, password reset, security alert, new enquiry (admin), enquiry acknowledgement, quotation
sent, quotation accepted (admin), invoice issued, payment receipt/confirmation, payment failed,
payment reminder (before/on/after due), project update, support request acknowledgement + reply.
Delivery status via Resend webhooks (verified signatures) → `email_logs.status`.
PDFs (pdf-lib): quotation/proposal, invoice, receipt, credit note. Kuzikode branding, A4, embedded
logo, clear totals table, payment instructions, page numbers, "TEST" watermark in non-production.

## 8. Financial rules (normative)
- Money = integer minor units + ISO 4217-style currency code (`USD`, `ZWG`) on every monetary row.
  Currency minor digits come from the `currencies` table (USD 2, ZWG 2).
- Quantities are stored as integer thousandths (`quantity_milli`) to allow 1.5 hours etc.
- Line total = round_half_even(quantity_milli × unit_price_minor / 1000) − line discount; tax per line
  computed on the discounted amount, rounded per line (document the rule). Totals = sums of rounded
  lines. Implement in one module (`money.ts` + `pricing.ts`) used by quotations, invoices, credit notes and PDFs.
- Never mix currencies in one document. Never sum across currencies in reports.
- Issued invoices, credit notes, payments and receipts are append-only. Corrections are adjustments.
- Invoice `amount_paid` and `balance` are derived from allocations. They may be cached on the invoice,
  but only if recomputed in the same batch as the allocation.
- Overpayment creates a client credit entry (same currency) that can be applied to a future invoice
  or refunded (recorded).
- Number sequences are atomic (`UPDATE sequences SET next = next + 1 WHERE key=? RETURNING next - 1`
  inside the same batch as the insert) and unique-constrained.
- Financial records are never auto-deleted. Retention policies apply only to logs and sessions.

## 9. Security
See `07-SECURITY.md` (normative). Roles: Super Administrator, Administrator, Finance Manager, Project
Manager, Content Manager, Support Staff, plus portal roles. Granular permissions. One-time CLI bootstrap
for the first super admin.

## 10. SEO & performance
Titles, meta descriptions, canonical (from `PUBLIC_SITE_URL`), Open Graph + Twitter cards (OG images
from Canva or generated), `sitemap.xml` (dynamic from published content), `robots.txt` (disallow
`/admin`, `/portal`, `/api`, `/q/`, `/i/`), JSON-LD (`Organization`, `WebSite`, `Service`,
`BreadcrumbList`, `CreativeWork` for case studies), `noindex` + `Cache-Control: private, no-store`
on all admin/portal/API/public-document responses, responsive images (`<picture>`, width/height,
`loading="lazy"` below the fold, AVIF/WebP where possible), self-hosted fonts with `font-display: swap`,
Lighthouse targets on public pages: Performance ≥ 90 (mobile), Accessibility ≥ 95, Best Practices ≥ 95, SEO = 100.

## 11. Reliability & data protection
Atomic batches, idempotency keys on all mutating payment/job endpoints, consistent state machines,
audit logs, private R2 access via signed short-lived routes, outbox + retries + dead-letter handling,
documented and **tested** backup/restore (D1 export → R2 backup bucket + D1 Time Travel), CSV/JSON
export, retention: sessions 30 days after expiry, rate-limit rows 7 days, email logs 1 year,
audit/financial forever.

## 12. Testing
See `08-TESTING.md`. Unit + integration + E2E (the 16-step flow) + security-boundary tests. CI blocks
merges on failures.

## 13. Deployment
See `09-DEPLOYMENT.md`. Envs: local, staging, production. workers.dev first. Custom domain config
prepared for kuzikode.com.

## 19. Definition of done & final report
Done when: public site fully functional with all six divisions; About/mission/vision editable;
portfolio & products work; enquiries work; admin auth & permissions; clients; quotations; invoices
+ PDFs; secure public invoice links; client portal; projects; expenses; payment abstraction; PesePay
sandbox tested **if credentials exist** (otherwise fully built + mock-tested + documented as blocked);
callbacks secure & idempotent; email integrated (tested with Resend if a key exists); audit logs;
all tests pass; production build succeeds; Cloudflare config complete; docs complete; no critical
security issues; no unfinished core features.

Write `docs/FINAL-REPORT.md` with: 1) what was built, 2) architecture & tech decisions, 3) database
structure, 4) features, 5) tests run + results (real numbers), 6) security measures, 7) Cloudflare
resources required, 8) external credentials still required, 9) exact deployment instructions,
10) remaining limitations. Do not claim the platform is live unless it was deployed and verified.
