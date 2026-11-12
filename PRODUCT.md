# Product

<!-- impeccable:product-schema 1 -->

> Written 2026-11-12 for the UI/UX reconstruction (`docs/redesign/BRIEF.md`). The owner's standing instruction is "don't ask me
> questions", so the impeccable init interview was not run: every fact below comes from `docs/01-PRD.md`,
> `docs/12-COMMERCIAL-FEATURES.md`, the brief and the shipped code. Lines marked *(inferred)* are the agent's reading, not owner-confirmed.

## Platform

web

## Users
- **Prospective clients** (primary, public site): owners and managers of small and medium businesses, NGOs and organisations in
  Zimbabwe first, then Africa and abroad, deciding whether Kuzikode can build their website, app, business system, AI or automation
  work, and what it costs. More than 75% arrive on phones (owner's analytics), often on mobile data and mid-range Android devices.
- **Clients** (client workspace, `/portal`): people whose website, software or digital solution Kuzikode is building or running.
  They follow projects and milestones, approve quotations, pay invoices (Paynow: EcoCash, OneMoney, InnBucks, cards), manage saved
  cards and subscriptions, and raise support requests.
- **Kuzikode staff** (admin, `/admin`): run sales, finance, delivery, website content, careers and settings. Desktop most of the day;
  must stay usable on a phone.
- **Job seekers** (careers pages) and **readers** (insights).

## Product Purpose
Kuzikode Technologies designs, builds and runs digital solutions for businesses: websites, mobile and desktop apps, business
software, AI and data work, automation and integrations, and cloud and IT services. One platform carries the public website, the
client workspace and the internal admin. Success for the public site: a visitor understands what Kuzikode does, trusts it as a
serious technology partner, finds the right service or priced package, and requests a quote (with the package preselected) or books a consultation.

## Positioning
"Building intelligent digital solutions." A technology partner, not a freelance web shop: published package prices confirmed in a
written quotation, local payment rails (Paynow, EcoCash, OneMoney, InnBucks, cards) built in, low-bandwidth performance, and a
client workspace where projects, documents and payments live together. *(inferred: the combination of transparent pricing with a
real client workspace is the claim neighbouring Zimbabwean studios don't make.)*

## Operating Context
Quotation → invoice → payment → receipt, milestones and weekly updates, care plans and subscriptions, support requests, consultation
booking and the contact/enquiry form (the start-a-project wizard is being removed, BRIEF B.0c). Prices are integer minor units with ISO currency (USD and ZWG). Stack: Astro (SSR) + React
islands + Tailwind 4 on Cloudflare Workers, D1, R2, KV, Queues.

## Capabilities and Constraints
- Six service divisions with sub-services (`services` table), priced packages, features and add-ons (`service_packages`,
  `package_features`, `package_addons`), all admin-managed. **Presentation only: never change prices, packages, inclusions or conditions.**
- Products page: Kuzikode Business Suite is **In Development** only. No pricing, signup or availability claims.
- Out of scope, never shown as services: Kuzikode Hosting, Business Suite (as a service), Kuzikode Connect, developer infrastructure,
  domain or business-management platforms.
- Security: strict CSP (hashed scripts, `font-src 'self'`), Turnstile on public forms, RBAC in admin.
- Accessibility: WCAG 2.1 AA, keyboard navigation, `prefers-reduced-motion` honoured.

## Brand Commitments
- Name "Kuzikode Technologies", wordmark "kuzikode" with the K mark (`public/brand/`). Never state or imply the company is registered.
- Copy rules (PRD §1): plain, specific, confident. Banned words: unlock, elevate, seamless, cutting-edge, revolutionize, "in today's
  fast-paced world", leverage synergies, empower your journey; no emoji in headings, no exclamation marks in headlines.
- Personality: modern, credible, innovative without gimmicks, intelligent, confident, approachable, internationally credible.
- Client workspace and admin: Linux-desktop-inspired panel language (brief §11), not an OS clone or hacker theme.

## Evidence on Hand
- Real: service catalogue, package prices and features, FAQs, insights posts, industries, technologies list, legal pages
  (`seeds/base.sql`, CMS-managed).
- Imagery: 20 owner-generated illustrative photos in `public/images/site` (AI-generated people, illustrative only, never staff or clients).
- **Absent, never fabricate:** clients, testimonials, portfolio projects (Our Work ships empty), team members, statistics, awards,
  partner or "trusted by" logos, years in business.

## Product Principles
1. Show the real thing: real prices, real process, real product UI. No invented proof.
2. Mobile is the primary experience, not a compressed desktop.
3. Honest scope: say what is available now; label anything in development as such.
4. One platform, three registers: persuade (public), work (client workspace), operate (admin), clearly related, never confused.

## Accessibility & Inclusion
WCAG 2.1 AA; 44 px touch targets; 16 px+ form inputs; works on slow mobile connections and mid-range Android phones; reduced motion respected.
