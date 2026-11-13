# Owner refinements (2026-11-13), the R9 tasks

The owner reviewed staging: *"The website is looking good overall… there are just a few remaining areas that need attention."*
**Scope guard (owner):** *"The other sections of the website are generally fine… do not touch them. Only work on the sections and
changes explicitly identified above. Preserve existing functionality, backend integrations, working forms and routing."* This document
has top authority for the items below (it overrides older brief rules where they conflict, e.g. B.1a type sizes and B.6 pricing data).
Everything else stays as built. Follow CLAUDE.md §2c (token diet).

---

## 1. Service catalogue: exactly these, nothing else

Remove every other service, sub-service, package, product and the Business Suite, plus care plans, hosting, email and domain packages,
from **all public surfaces** (pages, nav, search, sitemap, home, footer, structured data). **301-redirect** removed URLs to the closest
remaining page (`/products*` → `/services`, removed divisions → `/services`). Data: in a **new migration**, set removed services/packages to
`inactive` (never delete rows that quotations/invoices/subscriptions reference) and insert the catalogue below. Update `seeds/base.sql`
to match for fresh installs. Admin keeps working (old records stay readable). Update the pricing-accuracy test to this catalogue.

| # | Division (slug) | Services / packages | Price (USD) |
|---|---|---|---|
| 01 | **Websites & Web Applications** (`websites`) | Starter Website | **$150** once-off |
| | | Business Website ★ most popular | **$320** once-off |
| | | E-commerce Website | **from $650** |
| | | Custom Web Applications | **from $1,200** |
| 02 | **Business Software & Systems** (`business-software`) | POS & Inventory Systems | **from $800** |
| | | Custom ERP & Business Management Systems | **from $2,500** |
| | | Business Dashboards & Reporting Systems | **from $600** |
| 03 | **Cross-Platform Application Development** (`cross-platform-apps`) | Cross-Platform Application Development (one codebase, supported platforms: **Android, iOS, Windows, macOS, Linux**) | **from $1,200** |
| 04 | **AI, Data & Intelligence** (`ai-data`) | AI Integration & Intelligent Assistants | **from $500** |
| | | Data Intelligence & Analytics | **from $600** |
| | | Intelligent Document Processing | **from $800** |
| 05 | **Automation & Integration** (`automation-integration`) | Business Process Automation | **from $400** per workflow |
| | | Payment Gateway Integration | **$50 per local method** (EcoCash, OneMoney, InnBucks, O'mari) · **$100 card payments** |
| | | API Development | **from $400** |
| | | Systems Integration | **from $500** |
| 06 | **Add-ons** (`add-ons`) | Additional Website Pages | **$15 / page** |
| | | Logo Design | **$50** |
| | | Copywriting | **$15 / page** |
| | | Additional Languages | **$60 / language** |
| | | Product Catalogue Upload | **$25 per 50 products** |

**Website package inclusions** (use these; keep them honest and deliverable):
- **Starter ($150):** up to 5 pages, mobile-first design, contact form + WhatsApp button, on-page SEO basics, SSL, Google Business Profile
  setup, 1 revision round, 2 weeks support, delivery 5–7 working days. No CMS.
- **Business ($320):** up to 12 pages, editable content (CMS), blog/news, on-page SEO + Search Console + sitemap, analytics, speed
  optimisation, 3 revision rounds, 1 month support, 1-hour training, delivery 2–3 weeks.
- **E-commerce (from $650):** up to 100 products, cart and checkout, EcoCash/OneMoney/InnBucks/card payments via Paynow, order emails,
  stock basics, 3 revision rounds, 2 months support, delivery 4–6 weeks.
- **Custom Web Applications (from $1,200):** logins, dashboards, database and business logic, scoped in a written quotation; delivery quoted.

**Pricing rationale (market research, 2026-11-13):** WebZim (budget, template sites): websites $60 (3 pages) / $100 (5) / $250 (15) /
$500 (30). Vetech (premium agency): landing page $125, full website $250, web apps from $1,000 / $2,000 / $3,500, multi-platform apps from
$1,000 / $1,500 / $2,500, AI chatbots $550, payment integration $50 per local method and $100 for cards, systems integration custom-quoted.
Kuzikode sits **above budget template shops and level with or slightly above Vetech on custom work**, reflecting custom design, a CMS, a
client workspace and local payments. Record this in DECISIONS.md. Prices are editable in Admin → Packages.

Domains, hosting and business email are no longer sold as packages. Remove those from public pages. Keep the backend features
(subscriptions, managed-services register) untouched in admin.

## 2. Pricing pages: carousel first, comparison below, nothing else
- Each division page shows **only its own packages**. The websites page shows only the 4 website packages.
- **Remove the switching tabs/segmented controls.** The **package carousel is the primary view** on all sizes: swipe on phones (next card
  peeking, scroll-snap, dots + arrows, coordinated fade), and a full row or arrow carousel on desktop.
- Directly below: a **comparison table with every package as a column** (all 4 website plans side by side), sticky first column, and on phones
  horizontal scroll with the feature column pinned.
- Then one CTA ("Get a quote" → contact with the package preselected). **Remove duplicated or unnecessary sections** (repeated FAQs,
  repeated process strips, filler copy). Divisions with a single priced service show one strong offer card + what's included + CTA.

## 3. Images never "just sit there"
Every photo must be integrated: as a **background** with an overlay and content on top, with **cards/widgets layered over it** (e.g. a price
chip, a status widget, a stat-free feature chip), or inside a **layered composition**. No bare rectangular photo between text blocks, on any
breakpoint. Audit every page touched in R9 and fix.

## 4. No tech stack
Remove the technologies/tech-stack page, sections, strips and any mention of frameworks, languages or hosting vendors on public pages.
301 `/technologies*` → `/services`. (Admin and docs are fine.)

## 5. Side drawer navigation: floating menu
Fix the bugs and redesign the mobile/side menu as a **floating panel** (it doesn't cover the whole screen: inset from the edges, rounded,
soft shadow, dimmed backdrop, tap-outside and Esc to close, focus trap, body scroll lock, smooth open/close, reduced-motion safe). Each
item has **an icon + label** (one icon family). **No prices, no divider lines.** Group by spacing and subtle headings only. Primary CTA
"Get a quote" and WhatsApp at the bottom. Test open/close and navigation on 360/390/430 with Playwright (including the back button).

## 6. Footer: complete redesign
Calm, uncluttered, especially on phones (a compact stacked composition, not 5 link columns). Contact details exactly:
- **Email:** info@kuzikode.com (`mailto:`)
- **Tel:** **+263 88 294 6290** (`tel:+263882946290`)
- **WhatsApp & calls:** **+263 77 882 5898** (`https://wa.me/263778825898` and `tel:+263778825898`)
Store these in Settings (contact) so they're editable, and use them everywhere (contact page, WhatsApp button, footer, structured data).
Company name in the footer: **Kuzikode Intelligent Technologies**.

## 7. Home page: complete redesign (sell, be easy to navigate, be beautiful)
- **Hero (item 8):** a proper background image with overlay, plus **overlay widgets** (e.g. a floating project-status card, a payment-method
  chip row, a small workspace window), a clear headline about what Kuzikode does, one primary CTA ("Get a quote") and one secondary
  ("See pricing"). Visual-led on phones too.
- **Mid-page heroes:** 1–2 full-bleed image bands with overlaid content and widgets that break the page rhythm.
- **Service categories as designed widgets, not ordinary cards:** each of the 5 divisions (Add-ons excluded) with its SVG illustration, accent
  colour, a one-line value statement and **only its starting price** ("from $150", "from $1,200"…). No full price lists on the home page.
- Easy navigation: anchor to each division, a clear "how we work" strip only if short, and a closing CTA band with contact options.
- No tech stack, no products, no fabricated stats or clients.
- **Images:** write a home-page image batch (hero background, 1–2 mid-page bands, any widget imagery) in `IMAGE-REQUESTS.md` (desktop and
  mobile crops, matching the Zimbabwe-earth palette, no text or logos) and **notify the owner**. Use strong interim treatments until delivered.

## 8. Typography: use webdev.co.zw's type (owner: "they fit perfectly on mobile")
Font: **Poppins** (self-host via `@fontsource/poppins`, weights 400/500/600/700; keep a mono font only for small technical labels if
already used). Measured on webdev.co.zw:

| | Mobile (360–430) | Desktop (≥ 1024) |
|---|---|---|
| H1 | 38px / 1.08, w700, letter-spacing −0.015em | 60px / 1.08, w700, −0.015em |
| H2 | 30px / 1.18, w700, −0.015em | 36px / 1.18, w700 |
| H3 | 22px / 1.25, w700 | 26px / 1.25, w700 |
| Body | 16–17px / 1.6, w400 | 17px / 1.6 |
| Eyebrow/label | 13px, w700, +0.1em tracking, uppercase | 14px |
| Buttons, nav | 16px, w500 | 16px |

Tablet sizes interpolate fluidly (clamp). Keep H1 to ≤ 4 short lines on mobile (write a shorter mobile headline if needed). **Update the
B.1a guard** to these values (H1 ≤ 38px on phones, H2 ≤ 30px). Apply site-wide through the tokens (this is a token change, not a page redesign).

## 9. Brand identity: Kuzikode Intelligent Technologies
- Official name and lockup text: **Kuzikode Intelligent Technologies** (wordmark "kuzikode" + "INTELLIGENT TECHNOLOGIES" tracked caps), the
  same pattern as reference 2. Update the name everywhere: settings, meta/OG, structured data, emails, PDFs, legal pages, footer. Never
  claim registration (rule unchanged).
- References: `design/brand/references/owner-logo-ref-1-brace-k.jpg` (a code brace `{` merged with a K) and
  `owner-logo-ref-2-k-chevrons-wordmark.jpg` (a K built from emerald and gold chevrons, with the wordmark). **Craft something distinctive
  that's ours**, e.g. a K whose stem is a code brace with chevron arms, in the Zimbabwe-earth emerald + saffron (which the references
  already echo). No copying either reference outright.
- Deliver SVGs: full horizontal lockup, stacked lockup, mark only, one-colour (light and dark), favicon set (svg/ico/apple-touch/maskable),
  OG/social image template, email header. Make 3 mark explorations first (rendered board, 390 + 1440 header context), pick one, record why.
- Redesign the **header** with the new lockup (mark + wordmark on desktop; mark + short wordmark on phones), keeping the existing nav
  behaviour and the new floating menu (item 5).

## Order and checks
R9.1 catalogue + pricing data → R9.2 pricing pages → R9.3 brand + header + typography → R9.4 floating menu → R9.5 footer →
R9.6 home + hero (+ image batch) → R9.7 image integration audit + tech-stack removal. Visual loop at 360/390/430/768/1440 for every changed
page. Keep all functional e2e tests green, and update the tests that assert removed services or old prices.
