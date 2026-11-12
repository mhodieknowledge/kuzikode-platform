# Responsive design spec (R1.2)

Mobile is designed first and on its own terms (BRIEF §8, B.1). Each page is specified phone → tablet → desktop, section by section,
in the manner of IMG_5062 (phone vs tablet parity documented per section). World and tokens: [DESIGN_DIRECTION.md](DESIGN_DIRECTION.md).

## 0. Breakpoints, viewports and global rules

| Name | Range | Columns / gutter / side margin | QA viewports |
|---|---|---|---|
| phone | < 640 | 4 / 16 / 16 | 360×740, 375×667, 390×844, 412×915, 430×932 |
| tablet | 640–1023 | 8 / 24 / 32 | 768×1024 |
| laptop | 1024–1279 | 12 / 24 / 40 | 1024×1366 |
| desktop | ≥ 1280 | 12 / 24 / auto (content 1240, wide 1440) | 1280×800, 1440×900, 1920×1080 |

Global rules:
- **No horizontal page overflow** at any width (programmatic check in the harness). Horizontal movement only inside designed rails.
- **Tap targets ≥ 44×44 px** (inline text links in paragraphs excepted). Primary actions 52 px tall on phones.
- **Inputs ≥ 16 px text**, 52 px tall on phones, correct `type` / `inputmode` / `autocomplete` / `enterkeyhint`.
- **Safe areas:** sticky header and bottom bars pad with `env(safe-area-inset-*)`; `viewport-fit=cover`.
- **Heights:** use `svh`/`dvh`, never `100vh`. No section is taller than its content needs; no "full-screen" hero on phones.
- **Hover is an enhancement:** every hover reveal has a tap / focus equivalent; `@media (hover:hover)` gates hover styles.
- **Content density:** phones show the same information as desktop; it changes form (rail, segmented control, accordion, sheet), it
  is never removed. Important actions remain visible.
- **Rails** (horizontal scroll-snap lists): next item peeks 24–40 px; buttons + position dots on tablet/desktop; keyboard arrows;
  `scroll-padding` equals the side margin; no scrollbar chrome on touch.
- **Inset sections on phones:** alternating felt / concrete sections become 16 px-radius insets with 8 px outer margin where a page
  needs rhythm (IMG_5057); full-bleed on tablet and up.
- **Sticky action:** on pages whose job is one action (division page, package detail state on pricing, start-a-project) a bottom
  action bar appears on phones after the hero's own CTA scrolls away, and hides near the footer.

## 1. Shell

**Header.** Phone: 60 px, wordmark left, "Start a project" compact pill (cobalt) + menu button right, felt over the felt hero then
concrete-glass (blur, 92% opacity) after 24 px of scroll. Menu opens a **full-height sheet** (from the top, 320 ms) that is itself a
directory: numbered service floors, then About / Pricing / Our Work / Insights / Careers / Contact as large rows, then the portal
link and contact channels (WhatsApp, phone, email) as icon tiles, with search at the top. Tablet: same as phone, menu sheet
two-column. Desktop: 72 px, wordmark · nav (About ▾, Services ▾, Pricing, Our Work, Insights, Careers when open, Contact) · search ·
Client workspace · Start a project. Services ▾ opens the **directory mega-panel** (felt): 6 numbered rows left, lit frame right
(division summary + sub-services + "from" price), plus Industries and How we work. About ▾ is a compact panel. Active section has a
2 px cobalt indicator that slides between items.

**Footer.** Phone: felt-950; a CTA card ("Have a project in mind?") with two stacked actions; contact channels as 56 px icon tiles;
two-column link lists (Services · Company) with collapsible groups; newsletter as a single inline field; legal as chips; oversized
condensed `KUZIKODE` wordmark cropped at the bottom edge (IMG_5054/5072). Tablet: three columns. Desktop: CTA band row, then
4 columns (blurb + channels · Services · Company · Newsletter), legal row, wordmark.

## 2. Pages

### Home (`/`)
1. **Hero (felt).** Phone: index line ("Kuzikode Technologies · Harare, Zimbabwe"), display headline (CMS hero title) in 3 lines max,
   one sentence, then the **"What do you need?" route list**: 4 tappable directory rows (Website · App or business system · AI, data
   or automation · Pay an invoice / client workspace) each with icon + label + arrow knob, which ARE the hero's action; "Start a
   project" stays in the header. Tablet: headline wider, routes in 2×2. Desktop: 7/5 split: headline + sentence + 2 CTAs left;
   **live directory board** right (the six divisions, the lit row cycling once on load, then following hover) with a lit frame of
   real product UI.
2. **Directory of services (concrete).** Phone: six numbered rows (`01`–`06`), each: condensed caps name, one-line summary, "from $X"
   (lowest active package price in that division, if any and if `pricing.show_prices`), arrow knob; tap expands sub-services as chips
   and "View division". Desktop: the same rows full width with a hover-lit image frame pinned to the right (cross-fade).
3. **The workspace (felt).** Real product UI (portal overview, an invoice, a project timeline, rendered from components with fictional
   data, labelled "Illustrative") as a bento on desktop; a swipe rail of 3 framed screens on phones. Copy: what clients get
   (milestones, documents, local payments). Links to the client workspace.
4. **Why Kuzikode (concrete).** Approach claims (no stats). Phone: rail of 4 statement cards (number + claim + sentence). Desktop: 4
   columns separated by grooves, icons inline beside titles.
5. **How we work (concrete, inset).** 5 steps. Phone: vertical line timeline with numbered nodes. Desktop: horizontal stepper with a
   connecting line; existing duotone photos as a strip only if space earns it.
6. **Selected work** (hidden when none, PRD). Rail on phones, 2-up on desktop.
7. **Products preview.** One modest row: Business Suite, "In development" badge, link. Never a hero.
8. **Technologies.** Single line marquee of names (pauses on hover/focus and under reduced motion; static wrap on reduced motion).
9. **CTA band** (felt, part of footer composition).

### Services index (`/services`) and division (`/services/[slug]`)
- Index: hero (concrete, short) + the full directory (same component as home, expanded by default on desktop) + Industries row + CTA.
- Division page (vetech anatomy): breadcrumb; hero with division name, promise, two CTAs (Request a quotation · WhatsApp); sub-service
  chips (phone: horizontal rail of chips; desktop: wrapped). **Sub-services**: phone → segmented tabs (IMG_5056) showing one at a
  time with its description; desktop → two-column list with grooves. **Packages** (if any): phone → swipe rail of package cards with
  a package selector above; desktop → 3–4 column cards, recommended inverted. "Included in every package" strip (features present in
  all of this division's packages). Delivery-time bars (from `delivery_time`). Benefits / deliverables as two lists. FAQ accordion.
  Sticky bottom action bar on phones: "Request a quotation".

### Pricing (`/pricing`)
- Hero (concrete, compact) + VAT / quotation note.
- **Floor selector**: sticky segmented control of categories (Websites · Care plans · Email & domains · Other services) with a solid
  sliding thumb; phones: horizontally scrollable segmented pill bar under the header; tapping scrolls to the category.
- **Phone, per category:** a package **selector** (pills with package names) above a **swipe rail** of package cards (one visible,
  next peeking); the selected pill and the rail stay in sync. Each card: name, tagline, price (mono), unit, period note, delivery /
  revisions / support as a 3-cell spec row, **included features only** with a "See all features" disclosure that reveals the full
  list including not-included rows; CTA. Then **"Compare"**: a two-package compare sheet (pick any two from the category) showing
  feature rows side by side. Nothing from the desktop table is lost.
- **Tablet:** 2-column cards + full compare table in a horizontal-scroll container with sticky first column.
- **Desktop:** cards in a row (3–4), recommended card inverted felt and lifted 8 px; comparison table below with grouped rows, sticky
  header row, the recommended column tinted, (i) explanations where the data has them.
- Add-ons: phone → compact list rows with mono prices; desktop → 2-column grid of rows. FAQ accordion. CTA.

### Our Work (`/work`, `/work/[slug]`)
- Empty state (ships empty): a designed felt panel: "Case studies are being prepared…" with a short list of what clients can see in
  their workspace instead, and the contact CTA. Not a sad box.
- With entries: phone → full-width cards in a vertical list with category filter as a scrollable chip bar; desktop → 2-column
  editorial grid with an image-swap on hover. Case study: hero image with caption, challenge / solution / technologies as a spec
  sheet, gallery as a rail.

### About, How we work, Industries, Technologies
- About: statement hero, story as editorial two-column on desktop (single column with pull-quote on phones), mission / vision as two
  felt panels, values as a numbered directory list (not cards), objectives, approach.
- How we work: the timeline (vertical on phones, horizontal on desktop) with each step expandable; "what you receive" per step.
- Industries index: directory rows with icons; industry page: problems → relevant services (directory rows) → packages if linked.

### Contact, Start a project, Consultation
- Contact: phone → channels first (WhatsApp, call, email as 56 px tiles), then the form; desktop → form left (7 cols), channels +
  location + hours right (5 cols, sticky). Inline validation, success state with the reference number in mono.
- Start-a-project wizard: phone → one question per screen with a top progress bar (IMG_5015), large choice tiles (44 px+), sticky
  Back / Next bar; desktop → stepper rail left, step content right, summary panel.
- Consultation: date / time slots as a segmented day picker + slot chips.

### Insights, Careers, FAQ, Products, legal, search, 404/500
- Insights index: category chip bar (scroll on phones); first post as a large feature, then a list (phone) / 3-column grid
  (desktop). Article: 68ch measure, 18 px body, sticky "on this page" on desktop only.
- Careers: open roles as directory rows (title, type, location); role page with sticky apply bar on phones.
- FAQ: category segmented control + accordions.
- Products: one product panel with the "In development" badge and the interest form.
- Legal: readable prose layout, table of contents as a disclosure on phones.
- Search: big field, grouped results with type icons.
- 404/500: felt panel, "this floor doesn't exist" wording kept plain, directory of main destinations.

### Public documents and checkout (`/q/`, `/i/`, `/pay/…`)
- Document pages: paper card on concrete, summary first on phones (amount due, status, due date, primary action), line items as
  stacked rows; desktop as a document with a right-hand action panel (IMG_5018).
- Checkout: phone → amount strip (IMG_5013) on top, method tiles (EcoCash, OneMoney, InnBucks, card) as 2×2 icon-over-label tiles,
  phone-number-first mobile-money step (IMG_5016) with the fee line, receipt-style summary (IMG_5014); desktop → form left, sticky
  summary right.

## 3. Client workspace and admin
Specified in [PANEL_DESIGN_SPEC.md](PANEL_DESIGN_SPEC.md) §5 (mobile shell: bottom dock + sheet; tables → list rows).
