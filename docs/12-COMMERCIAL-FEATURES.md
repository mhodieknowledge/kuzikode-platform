# 12 — Commercial & Company Features (pricing plans, careers, extended website)

Normative addition to `01-PRD.md` (same authority as the PRD). Everything here is **in scope**.
It covers: priced packages, recurring care plans and subscriptions, managed client services, careers/recruitment,
and the extra website and admin features a professional technology company site is expected to have.

---

## A. Pricing, packages and plans

### A.1 Concept
A **service** (docs/01 §3.3) can have zero or more **packages**, which are fixed, priced bundles with a clear list of what's included.
Packages appear on the service's division page and on a dedicated **`/pricing`** page. A package can be:
- `one_off` (e.g. a website build) or `recurring` (`monthly` / `annual`, e.g. a care plan or business email), and
- `fixed` price, `starting_from` price, or `custom_quote` (shows "Custom quote" plus the included scope).

Each package has: name, slug, tagline, price minor + currency (USD default, optional manual ZWG price), billing type and interval,
**feature list** (ordered, each with `included` / `not_included` / a value like "10" or "Up to 12 pages", plus an optional tooltip),
delivery time ("2–3 weeks"), revision rounds, support period, "Most popular" flag, optional add-ons, status
(`active` / `coming_soon` / `inactive`), sort order, and CTA behaviour:
**"Get started"** opens the Start-a-Project wizard (§C.2) with the package preselected. No online card checkout for packages:
the sales process is enquiry → quotation → invoice, so scope is always confirmed first. That's deliberate: custom work needs a
confirmed brief. Invoices are paid online.

**Add-ons** (per package or global): extra page, extra mailbox, logo design, copywriting per page, additional language,
extra product-catalogue upload, priority delivery. Each has a price and unit.

**Comparison table** on `/pricing` (rows = features, columns = packages, ✓/✕/value), responsive: it becomes stacked cards on mobile.
Plus a pricing FAQ (from FAQ module, category "Pricing") and a note: *"Prices exclude VAT where applicable. Final scope and price are
confirmed in a written quotation."*

**Public price display switch:** setting `pricing.show_prices` (default **on** in dev/staging, **off** in production until the owner
confirms prices; BLOCKERS.md). When off, packages show their features with "Request a quote" instead of the price.

**Quotation integration:** in the quotation editor, "Add package" inserts the package as line items (base + selected add-ons + first
period of included recurring items, e.g. "Business email, 10 mailboxes, 12 months"). Prices are copied at that moment, so later
changes to the catalogue don't alter sent quotations.

### A.2 Seed catalogue: suggested launch prices (USD)
These are **market-informed suggestions for the Zimbabwe SME market**, written into `seeds/base.sql` with
`price_review_required = 1`. The owner must confirm them (BLOCKERS.md). Inclusions with third-party costs (domains, mailboxes) carry
an internal `cost_note` so margins stay visible. Business email assumes **Zoho Mail Lite (~$1/user/month)** as the cost basis.
Google Workspace (~$7/user/month) is offered as an upgrade add-on.

**Web Development: website plans (one-off)**
| | **Starter Website** | **Business Website** ★ Most popular | **E-commerce Store** | **Custom Web App** |
|---|---|---|---|---|
| Price | $350 | $750 | from $1,500 | Custom quote |
| Pages | Up to 5 | Up to 12 | Up to 15 + shop | Scoped |
| Mobile-responsive design | ✓ | ✓ | ✓ | ✓ |
| Content editing (CMS) | ✕ | ✓ | ✓ | ✓ |
| Domain (.com or .co.zw), year 1 | ✓ | ✓ | ✓ | Optional |
| Hosting + SSL, year 1 | ✓ | ✓ | ✓ | Scoped |
| Business email mailboxes, year 1 | 2 | **10** | 10 | Optional |
| Contact form + WhatsApp chat button | ✓ | ✓ | ✓ | ✓ |
| Blog / news section | ✕ | ✓ | ✓ | Optional |
| On-page SEO + Google Search Console | Basic | ✓ | ✓ | ✓ |
| Google Business Profile setup | ✓ | ✓ | ✓ | n/a |
| Analytics dashboard | ✕ | ✓ | ✓ | ✓ |
| Online payments (EcoCash, OneMoney, cards via Paynow) | ✕ | ✕ | ✓ | Optional |
| Products / catalogue | ✕ | ✕ | Up to 100 | Scoped |
| Revision rounds | 1 | 3 | 3 | Agreed |
| Post-launch support | 2 weeks | 1 month | 3 months | Agreed |
| Training session | ✕ | 1 hour | 2 hours | ✓ |
| Typical delivery | 1–2 weeks | 3–4 weeks | 5–8 weeks | Scoped |

**Website Care plans (recurring, after year 1 or for existing sites)**
| | **Essential Care** | **Business Care** ★ | **Growth Care** |
|---|---|---|---|
| Monthly | $25 | $60 | $150 |
| Annual (2 months free) | $250 | $600 | $1,500 |
| Hosting, SSL, daily backups, uptime monitoring | ✓ | ✓ | ✓ |
| Security & software updates | ✓ | ✓ | ✓ |
| Content edits included | 1 hr/month | 3 hrs/month | 8 hrs/month |
| Monthly performance report | ✕ | ✓ | ✓ |
| SEO monitoring & quarterly improvements | ✕ | ✕ | ✓ |
| Support response target | 2 business days | 1 business day | Same business day |

**Cloud & IT: Business email & domains (recurring)**
| Package | Price | Includes |
|---|---|---|
| Business Email | $3 / mailbox / month (min 3) or $30 / mailbox / year | Professional address @yourdomain, 10 GB mailbox, webmail + phone apps, spam/virus filtering, setup + DNS (SPF/DKIM/DMARC) |
| Business Email Pro (Google Workspace) | $10 / user / month | Gmail interface, 30 GB, Meet, Drive. Kuzikode handles setup & admin |
| Email setup & migration | $50 one-off + $10 / mailbox migrated | Moving existing mail, DNS records, device setup guide |
| Domain registration | .com from $20/yr · .co.zw from $25/yr (owner confirms) | Registration, DNS on Cloudflare, renewal reminders |

**Other divisions (starting prices; full scope by quotation)**
| Division | Package | From |
|---|---|---|
| Mobile & Desktop | MVP mobile app (Android + iOS, cross-platform) | $2,500 |
| Mobile & Desktop | Business app with admin dashboard | $6,000 |
| Business Software | POS / inventory system for a single branch | $1,500 |
| Business Software | Custom ERP / business platform | Custom quote |
| AI, Data & Intelligence | BI dashboard starter (up to 3 data sources) | $600 |
| AI, Data & Intelligence | AI assistant / chatbot integration | $900 |
| AI, Data & Intelligence | Intelligent document processing pilot | $1,200 |
| Automation & Integration | Payment gateway integration (Paynow, PesePay, EcoCash, cards) | $400 |
| Automation & Integration | Workflow automation (per workflow) | $500 |
| Automation & Integration | API development | $25 / hour |
| Cloud & IT | Cloud deployment & setup | $200 |
| Cloud & IT | IT support retainer (5 hrs/month) | $100 / month |
| Cloud & IT | Ad-hoc technical support | $20 / hour |
Default hourly rate setting: **$25/hour** (used by time tracking, §E.3).

### A.3 Subscriptions & recurring billing
Recurring packages create **subscriptions** when accepted (from a quotation line marked recurring, or created manually):
client, package/description, quantity (e.g. 10 mailboxes), unit price, currency, interval (monthly/annual), start date,
next billing date, auto-issue (yes = issue + email invoice automatically; no = create draft for review), status
(`active` / `paused` / `cancelled` / `ended`), cancellation date/reason.
- Daily cron: for each subscription with `next_billing_date <= today + lead_days` (setting, default 7), create the invoice for the
  next period (idempotent: unique `(subscription_id, period_start)`), then advance `next_billing_date`. Never generate twice.
- Invoice lines show the period ("Business Email, 10 mailboxes, 1–30 Dec 2026").
- Unpaid subscription invoices follow normal reminder rules. After N days overdue (setting, default 30) the subscription is flagged
  `at_risk` and admin is notified. No automatic suspension of client services (people decide that).
- Portal: client sees active subscriptions, next billing date, and can request cancellation (creates a support request).

### A.4 Managed services register (domains, hosting, mailboxes)
`client_assets`: type (`domain`, `hosting`, `email_tenant`, `ssl`, `app_store_account`, `other`), name (e.g. `example.co.zw`),
provider/registrar, linked subscription, renewal date, auto-renew flag, cost note (internal), credentials reference
(**never store passwords**; only a note like "in owner's password manager"), status. Cron reminders to staff at 30/14/7 days
before renewal, and to the client if the asset is billable to them. Shown on the client detail page and in the portal ("Your services").

---

## B. Careers & recruitment

### B.1 Public
- `/careers`: intro ("Why work with Kuzikode", from CMS; honest, no invented perks), list of **open** roles with filters
  (department, type, location/remote). Empty state: *"We're not hiring right now."* If setting `careers.general_applications` is on,
  show "Send us your CV" (general application).
- `/careers/[slug]`: title, department, location, employment type (`full_time` / `part_time` / `contract` / `internship` / `attachment`,
  the last for student industrial attachment, common in Zimbabwe), workplace (`onsite` / `hybrid` / `remote`), salary range (optional,
  shown only if `show_salary`), summary, responsibilities, requirements, nice-to-haves, what we offer, how to apply, closing date,
  share links, and the application form.
- **Application form:** full name, email, phone, location, LinkedIn URL, portfolio/GitHub URL, CV upload (PDF/DOCX ≤ 5 MB,
  magic-byte checked), cover letter (text or file), up to 5 custom questions defined per posting (short text / long text / yes-no /
  select), availability/notice period, salary expectation (optional), privacy consent. Turnstile + honeypot + rate limit.
  On submit: acknowledgement email to the applicant, notification to hiring staff, reference number shown.
- **SEO:** `JobPosting` JSON-LD (title, description, datePosted, validThrough, employmentType, hiringOrganization,
  jobLocation / `jobLocationType: TELECOMMUTE`, baseSalary when shown) so roles can appear in Google's job search.
  Closed postings: return 200 with a "This position is closed" state and no JSON-LD (or 410 after 90 days).
- Footer link "Careers", and a link from About. Add it to the header nav only while at least one role is open (setting `careers.show_in_nav_when_open`).

### B.2 Admin (Careers module)
- Postings CRUD with draft → open → closed → archived, scheduled open date, closing date (auto-close cron), duplicate posting,
  custom questions editor, preview.
- Applicants pipeline per posting: list + **kanban** (`new` → `screening` → `interview` → `offer` → `hired` | `rejected` | `withdrawn`),
  rating (1–5), tags, assigned reviewer, internal notes, activity history, CV viewer/download (authorised route), email the applicant from
  templates (received, interview invitation, regret, offer, all editable), bulk reject with regret email.
- Permissions: `careers.view`, `careers.manage`. Add a **Hiring Manager** role (careers.* + dashboard), and grant careers.* to Administrator.
- **Applicant data protection:** applications are personal data, not financial records. Retention setting (default **12 months after the
  posting closes**). The nightly cron deletes CV files and anonymises applications past retention (keeps counts for reporting).
  Applicants can request deletion via email. Admin action "Erase applicant" is audited. Mention this in the privacy policy.

---

## C. Extended public website (added after reviewing what professional technology-company sites provide)

| # | Feature | Spec |
|---|---|---|
| C.1 | **Pricing page** `/pricing` | §A.1. Tabs: Websites · Care plans · Email & domains · Other services. Comparison table + FAQ + CTA. |
| C.2 | **Start a Project wizard** `/start-a-project` | 5 steps: what you need (division/service) → package or custom → features/add-ons checklist → budget range + timeline + existing website URL + optional attachment (brief, ≤ 10 MB) → contact details. Shows an **indicative** price range from package + add-ons ("Indicative only, confirmed in a quotation"). Creates an enquiry with a structured `brief` JSON, viewable nicely in admin and one-click "Create quotation from brief". Progress saved in `sessionStorage` (wrapped in try/catch). |
| C.3 | **Industries** `/industries` + `/industries/[slug]` | Seed 8: Retail & Wholesale, Financial Services & Microfinance, Education, Healthcare, NGOs & Development, Hospitality & Tourism, Agriculture, Logistics & Transport. Each: challenges we solve, relevant services (linked), relevant packages, CTA. Honest copy: "solutions for", never "clients include". |
| C.4 | **Insights (blog)** `/insights` | Posts with cover image, category, tags, author (staff user with public profile name), reading time, publish date, scheduled publishing, related posts, share links, RSS `/insights/rss.xml`, `Article` JSON-LD. **The agent writes 4 genuine launch articles** (e.g. "Accepting EcoCash and card payments on your website", "What a business website should include in 2026", "Business email on your own domain: why and how", "Choosing between a website and a web app"), useful, accurate, no fabricated statistics. |
| C.5 | **How we work** `/how-we-work` | Process (Discover → Design → Build → Launch → Support), engagement models (fixed-price package, fixed-scope project, time & materials, retainer), what clients can expect (weekly updates in the portal, milestone-based payments, code/content ownership on full payment), quality & security practices. |
| C.6 | **FAQ** `/faq` | CMS FAQ items with categories (General, Pricing & payments, Projects, Support, Careers), search filter, `FAQPage` JSON-LD. Also embedded per service/pricing page by category. |
| C.7 | **Testimonials** | Only real ones: must link to a client record, have `consent_obtained = 1` + date, and optionally a project. Section/blocks are **hidden when none are published**. Never seeded in production. |
| C.8 | **Consultation booking** | "Book a free 30-minute consultation": if setting `booking.cal_url` (free Cal.com account) is set, embed/link it. Otherwise a request form with 3 preferred time slots → enquiry category `consultation` + admin notification. |
| C.9 | **WhatsApp chat button** | Floating button (bottom-right, respects safe areas, hidden on admin/portal) using `contact.whatsapp_number` + prefilled message per page ("Hi Kuzikode, I'm interested in the Business Website plan"). Hidden if not configured. |
| C.10 | **Newsletter** | Footer signup with **double opt-in** (confirmation email), `newsletter_subscribers` table, unsubscribe link, admin list + CSV export. Sending campaigns is out of scope for now (export to a mailing tool). Note it in the privacy policy. |
| C.11 | **"Technologies we work with"** strip | Logos of technologies (Cloudflare, React, Flutter, Python, PostgreSQL, etc.), clearly labelled as technologies, never "clients" or "partners". Simple monochrome SVGs, editable in CMS. |
| C.12 | **"Payments we support"** | On pricing/footer: "Pay invoices online with EcoCash, OneMoney, InnBucks and cards" (methods come from the routed live payment account; shown only once a live account is routed). |
| C.13 | **Service terms page** | `/legal/service-terms`: payment terms, milestones, revisions, ownership, support, cancellation. CMS-editable, flagged for legal review. Also an **Accessibility statement** page. |
| C.14 | **Team page** (optional) | `/about#team` only when the owner adds real team members with real photos (never AI faces). |
| C.15 | **Site search** | Header search over services, packages, industries, insights, FAQ, portfolio (D1 `LIKE` / FTS5 virtual table if supported by D1. Verify and record). |

---

## D. Admin additions
| Module | Spec |
|---|---|
| **Packages & pricing** | CRUD packages per service, feature rows, add-ons, comparison ordering, show-prices switch, price-review flag (dashboard warning while any active package has `price_review_required`). Changes audited. |
| **Subscriptions** | List/filter (status, client, next billing), create/edit/pause/cancel, preview of next invoice, history of generated invoices, MRR/ARR tile per currency on the dashboard. |
| **Managed services register** | `client_assets` CRUD + renewals calendar + reminders. |
| **Careers** | §B.2. |
| **Insights, industries, FAQ, testimonials, technologies, newsletter** | CMS editors with draft/publish, SEO fields, media picker. |
| **Time tracking** | Per project/task time entries (date, minutes, description, billable flag, rate default from settings), a timer in the project view, a weekly timesheet per user, and "Bill unbilled time" → adds lines to a draft invoice (entries are marked billed with the invoice ID, idempotently). |
| **Two-factor authentication (TOTP)** | Staff can enable an authenticator app (RFC 6238, implement with WebCrypto HMAC-SHA1), with 10 single-use backup codes (hashed). **Mandatory** for Super Administrator and Finance Manager (enforced at login: they enrol before they can continue). Portal users: optional. Secrets encrypted at rest with `DATA_ENCRYPTION_KEY` (AES-GCM). |
| **Dashboard additions** | MRR per currency, upcoming renewals (30 days), open roles + new applicants, wizard briefs this week, prices-awaiting-review warning. |

## E. Seeds & content the agent must write
- All packages, features and add-ons from §A.2 (`price_review_required = 1`).
- Industries (8) with real, specific copy. FAQ (≥ 20 items across categories). 4 Insights articles. How-we-work copy.
  Service terms + accessibility statement drafts. Careers intro copy. **No job postings** in production seed (one fictional posting in dev seed only).
- All copy follows the PRD copy rules: specific, honest, no invented numbers.
