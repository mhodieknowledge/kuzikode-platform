# Redesign roadmap: UI/UX reconstruction

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked by the owner (see docs/BLOCKERS.md; finish everything else first).
A task is done only when its AC is met, the Playwright visual loop (BRIEF B.2) is clean, `npm run verify` and the e2e suite are green,
and the change is pushed to `main`. The previous build roadmap (`docs/10-ROADMAP.md`) is complete and kept for history only.

## R0: Audit and research
- [x] **R0.1 Skills check.** Confirm every skill in BRIEF B.3 loads. Run `impeccable` setup for this project (its init/context step, no hooks). AC: list in DESIGN_DIRECTION.md; any failure reported honestly.
- [x] **R0.2 Frontend audit.** Every public page, client portal screen and admin screen screenshotted at 390 and 1440 (`docs/screenshots/redesign/before/`). Run `impeccable detect` across the site. AC: `DESIGN_AUDIT.md` lists weaknesses per page/component, the pricing source of truth (B.6), and the image inventory (which current images fit or don't).
- [x] **R0.3 Inspiration images (all 29).** Inspect every file in `/inspiration-images` individually (subagents in batches are fine). AC: `REFERENCE_IMAGE_ANALYSIS.md` (ideas per image: composition, type, colour, navigation, interaction, responsive) + `IMAGE_TRACEABILITY.md` (table: every file → ≥1 idea → target page/section/component → status adopted/adapted/rejected with reason). The count in the table equals the file count.
- [x] **R0.4 Reference sites.** Playwright at 390×844 and 1440×900 on webdev.co.zw (mobile UX focus) and vetech.co.zw (pricing/services focus), plus 3–5 sites from the research list. AC: findings and screenshots summarised in `REFERENCE_IMAGE_ANALYSIS.md` (sites section). Nothing copied.

## R1: Direction and plan
- [x] **R1.1 Design direction.** (REDONE via R1.5: Route, sign green) Compare candidate palettes (from the references) and pick ONE. Choose type pairing, grid, spacing scale, radius, elevation, icon family (one, consistent stroke), image art direction, motion principles. AC: `DESIGN_DIRECTION.md` with rationale and the skills used.
- [x] **R1.2 Specs.** `RESPONSIVE_DESIGN_SPEC.md` (per page: mobile composition first, then tablet and desktop; carousels, segmented controls and sticky CTAs where they help), `MOTION_AND_INTERACTION_SPEC.md` (durations, easings, choreography, reduced motion), `PANEL_DESIGN_SPEC.md` (Linux-inspired client workspace + admin, distinct but related), `UI_UX_RECONSTRUCTION_PLAN.md` + `IMPLEMENTATION_PLAN.md` (order, component inventory, what's reused vs rebuilt). AC: files exist and agree with each other.
- [x] **R1.3 First image batch.** Write batch 1 of image prompts for the new direction in `IMAGE-REQUESTS.md` and notify the owner (B.4). AC: committed; notification sent or failure logged.

## R1.4: Clean-slate correction (inserted 2026-11-12 by the owner)
- [x] **R1.4 Rewrite the plan for a clean slate (BRIEF B.0).** Revise `IMPLEMENTATION_PLAN.md` and `UI_UX_RECONSTRUCTION_PLAN.md`: every
  "Restyle"/"reuse presentation" entry becomes **Rebuild (new component in `src/ui/…`)**, with only logic reuse listed. Add the
  "legacy presentation removed" checklist (every old component and layout file, with the task that deletes it). AC: grep of both plans
  finds no "restyle"/"reskin" strategy entries. Logged in DECISIONS.md.

## R1.5: Visual concept gate (inserted 2026-11-12 by the owner; see BRIEF B.0d)
- [x] **R1.5 Three home-page concepts + comparison boards.** Re-read `REFERENCE_IMAGE_ANALYSIS.md`/`IMAGE_TRACEABILITY.md`, then **open the
  image files themselves**. Pick a non-blue palette per concept (BRIEF B.0b). Build concepts A/B/C as static prototypes (desktop + mobile)
  in `design/concepts/`, make the boards, critique them (impeccable + taste checker + the anti-generic list), choose one, and update
  `DESIGN_DIRECTION.md` (palette, type, composition system, signature interactions, which images drive what). Notify the owner (FYI).
  AC: 3 boards + the chosen-concept rationale committed; the chosen concept passes the anti-generic list.

## R2: Foundation
- [x] **R2.1 Design tokens + base styles** (REDONE from concept B Route; the first version was generic navy/blue pills) (colour, type scale with fluid mobile→desktop sizing, spacing, radius, shadows, z-index, motion tokens, dark/light surfaces for panels). Replace the old token set.
- [x] **R2.2 Icon system** (single family, wrapper component, sizes, stroke, a11y labels) and an audit list of every place that needs an icon.
- [x] **R2.3 Core primitives rebuilt:** buttons, links, inputs/forms (mobile-friendly: 16 px+ inputs, correct keyboards, inline validation), segmented control, tabs, accordion, carousel/swipe track (scroll-snap + buttons + dots, fade/slide choreography, keyboard + reduced motion), sheet/drawer, dialog, toast, badge/status, table → mobile list pattern.
- [x] **R2.4 Dev UI gallery** page (dev-only) showing every primitive at 390 and 1440. AC: visual loop clean.

- [x] **R2.5 Palette correction (owner rule BRIEF B.0b, inserted 2026-11-12).** Replace the navy + cobalt palette with ONE non-blue
  direction from the owner's references (lime/black, green/emerald, monochrome + warm accent, or teal). Update `DESIGN_DIRECTION.md` §4,
  `src/ui/tokens/*`, every primitive and the /dev/ui gallery. Rewrite image **batch 1** prompts in `IMAGE-REQUESTS.md` for the new
  palette (mark the old prompts "superseded: palette change, don't generate") and notify the owner. AC: no blue/indigo/violet hue
  (≈200°–290°) left in tokens or components (grep + a token test); /dev/ui visual loop clean in light and dark; contrast checks pass.

- [x] **R2.5b Multi-accent palette + premium hero (BRIEF B.0b+ / B.0e).** Compare ≥ 3 multi-accent palettes on the chosen concept (boards at 390
  and 1440), choose one, apply it to tokens with accent roles (division colours, tier coding, primary action, status/data viz), and rebuild the
  hero to the premium definition (visual-led on phones). Notify the owner with the boards (FYI). AC: boards + rationale committed; reviewer passes
  "premium, not generic".
- [x] **R2.6 Mobile hard-limits guard (BRIEF B.1a).** Apply the mobile type scale in tokens, rework the chosen concept's mobile hero
  (new structure, with a visual in the first screen, short mobile headline) and convert long stacks to swipe tracks. Add the automated
  Playwright guard spec to CI. AC: guard green on all built pages; first-screen boards (360/390/430) committed in
  `docs/screenshots/redesign/boards/` next to the old home and webdev.co.zw.

## R3: Public site shell
- [x] **R3.1 Header + mobile navigation** (REDO on the new foundation) (designed mobile menu/sheet, animated indicators, sticky behaviour, primary CTA always reachable).
- [x] **R3.2 Footer** (distinct mobile composition, contact channels with icons, legal).
- [x] **R3.3 Page transitions / section reveal** framework per the motion spec.

## R4: Public pages (mobile first, each with its own mobile composition)
- [x] **R2.5c Illustration system + new image batch (BRIEF B.4a, inserted 2026-11-12 by the owner; do before R4.1).** Define and build the
  custom SVG illustration system (style, stroke, accent-per-division from the Zimbabwe-earth palette, subtle motion), draw the service-division set
  first and show it on /dev/ui. Mark per-service/division photo requests `superseded: SVG instead (B.4a)` and write a new 6–10 image batch only for
  heroes, mid-page bands and editorial sections. AC: division illustrations at 390 + 1440 pass the reviewer ("custom, consistent, premium");
  IMAGE-REQUESTS.md updated; owner notified.
- [x] **R4.1 Home.** (2026-11-12; its services band now uses the R2.5c division drawings.)
- [x] **R4.2 Services index + division pages + service detail.** (Services are listed within their division page; there is no separate service-detail route.)
- [x] **R4.3 Pricing / packages** (presentation only; desktop comparison + mobile swipe/selector; price-accuracy test from B.6).
- [x] **R4.4 Our Work / portfolio + case study** (image transitions, empty state that still looks designed).
- [x] **R4.5 About, How we work, Industries, Technologies.** (2026-11-12; technologies live on How we work.)
- [x] **R4.6 Contact + consultation booking** (2026-11-12) (forms: mobile usability first). Contact form reads `?service=` / `?package=` to preselect.
- [x] **R4.6b Remove the Start-a-project wizard (owner rule BRIEF B.0c).** Delete the page, component, nav and CTA links, search and sitemap
  entries; 301 `/start-a-project` → `/contact`; CTAs become "Get a quote" / "Request this package" → contact with preselection. AC: grep finds
  no "start-a-project"/"Start a project" in `src/` except the redirect; e2e covers the redirect and the package → contact preselect; tests green.
- [x] **R4.7 Insights/blog, Careers, FAQ, Products (in-development item kept modest), legal, search, 404/500.**
- [x] **R4.8 Public document & checkout pages** (`/q/`, `/i/`, `/pay/…`, the custom checkout) in the new language. Payment flows still pass their e2e tests.

## R5: Client workspace (Linux-inspired)
- [x] **R5.1 Workspace shell:** side navigation, top status bar, window/panel pattern, command palette, mobile shell (bottom bar or sheet nav), light/dark surfaces.
  - Dark surfaces: the theme toggle ships with R5.4 (legacy page bodies are unreadable on night until R5.2–R5.4 rebuild them).
- [x] **R5.2 Overview, projects (milestones, updates, deliverables, messages).** (2026-11-13: master/detail projects, milestone rail, boards PASS)
- [x] **R5.3 Quotations, invoices, payments and receipts, saved cards, subscriptions/services.** (2026-11-13: boards 5/5 PASS after fixes)
- [x] **R5.4 Support, profile, devices, auth screens** (sign-in, reset, invite, verify). Also: enable the workspace dark theme toggle (night desk, night-800 windows; remembered per device via cookie so the server renders `data-theme`).

## R6: Admin interface
- [x] **R6.1 Admin shell** in the related but more utilitarian panel language (keep it distinct from the client workspace).
- [x] **R6.2 Restyle every admin module** (dashboard, clients, leads, services, packages, quotations, invoices, payments, projects, expenses, CMS, careers, notifications, settings, reports, audit) with functionality untouched. Dense data views get a mobile list/card pattern.

## R9: Owner refinements (2026-11-13), DO THESE NEXT, before R7.2 and R8. Spec: `docs/redesign/REFINEMENTS.md`
Scope guard: only these items; don't touch other sections.
- [x] **R9.1 Service catalogue + pricing data** (REFINEMENTS §1): migration (deactivate old, insert new), seeds, 301s, remove products/Business Suite/care/hosting/email/domains from public pages, update the pricing-accuracy test.
- [x] **R9.2 Pricing pages** (§2): carousel primary, tabs removed, all-plans comparison table below, one CTA, no duplicate sections; each division page only its own offers.
- [x] **R9.3 Brand + header + typography** (§8, §9): 3 mark explorations → chosen SVG set; "Kuzikode Intelligent Technologies" everywhere; header redesign; Poppins + webdev type scale in tokens; B.1a guard updated.
- [x] **R9.4 Floating side menu** (§5): bug fixes, floating panel, icons, no prices/dividers, Playwright open/close/nav tests.
- [x] **R9.5 Footer redesign** (§6) with the exact contact details (settings-backed).
- [x] **R9.6 Home page + hero redesign** (§7): background-image hero with overlay widgets, mid-page bands, division widgets with starting prices only, home image batch written + owner notified.
- [x] **R9.7 Image integration audit + tech-stack removal** (§3, §4) on all public pages; 301 `/technologies*`.

## R10: HOME PAGE FROM SCRATCH (owner, 2026-11-14), DO NEXT, before finishing R7.2 and R8
The owner: *"The home page is still not the UI I'm looking for… remove all those SVGs it created for the services we offer, they are ugly on
the home screen, maybe section icons would be best. Tear down the home screen and start afresh. Refer to the images I sent one by one
and get ideas of a UI component from each image… start the home screen afresh with all the information necessary. It's not redesigning
the home screen but starting it afresh, just the home screen."* **Scope: only `/` (home). Don't touch any other page.**
- [ ] **R10.1 Home component map from all 29 images.** Open (Read) **every** image in `/inspiration-images` one at a time and, for each, write the
  single most useful **home-page UI component** it suggests (hero composition, floating widget, service section layout, price chip, carousel,
  CTA band, navigation band, image-overlay card, proof-free trust element, etc.), with how it would carry Kuzikode content.
  Output `docs/redesign/HOME_COMPONENT_MAP.md`: 29 rows (image → component → home section → adopt/adapt/skip + reason). Use fresh `sonnet`
  subagents in batches of ~6 images (each subagent Reads its images and replies with ≤ 6 lines per image); you merge.
- [ ] **R10.2 Home content inventory + composition.** List the information the home page must carry (positioning; the 5 divisions with a
  one-line value + **starting price only**; why Kuzikode; a short how-we-work; pricing entry point; contact/WhatsApp/quote CTA) and compose
  the new page section by section **from the component map** (name the source image per section). Mobile composition first (390), then 1440.
- [ ] **R10.3 Tear down + rebuild `/`.** Delete the current home sections and their home-only components (including the division SVG
  illustrations **on the home page**; the drawings may stay on the service pages). Build the new home **from zero** in `src/ui/public/home2/`
  (or replace the folder). **Services use section icons** (the site's single icon family, one accent colour per division), **never the SVG
  illustrations**. Photos only as hero background / mid-page bands / overlay cards (REFINEMENTS §3). Keep the hero premium, with a background
  image and overlay widgets. Respect the Poppins type scale and the B.1a guard. Visual loop at 360/390/430/768/1440, a side-by-side board
  (new vs old home vs source images), one `opus`/`low` reviewer pass. Update the home image requests in `IMAGE-REQUESTS.md` if the new
  composition needs different photos, and notify the owner. Home e2e/a11y tests green.

## R7: Imagery and motion polish
- [x] **R7.1 Process delivered owner images** (B.4) and replace interim treatments. Further prompt batches as needed.
- [x] **R7.2 Motion pass (trimmed 2026-11-13 to save usage).** One pass on the public pages only: `review-animations` + `animation-performance` on the home, services, pricing and checkout flows; fix what they flag; `remove-animations` where motion is excessive. Skip `find-animation-opportunities` and `improve-animations`. Run as a fresh `sonnet`/`medium` subagent; you review.

## R8: QA and finish
- [ ] **R8.1 Visual QA, lean version (owner approved trimming, 2026-11-13).** (1) A `sonnet`/`low` subagent runs the automated sweep over every page, the
  workspace and admin at all 10 viewports: horizontal overflow, B.1a type limits, tap targets (≥44 px), broken or missing images, console errors,
  `prefers-reduced-motion`. (2) Read screenshots only for flagged pages plus the key pages (home, pricing, contact, checkout, workspace overview,
  admin dashboard) at 390 first, then 1440. (3) One `impeccable` audit and one `web-design-guidelines` pass over the whole site. (4) Fix what's found.
  Skip further per-page deep reviews. AC: `QA_REPORT.md` with the sweep results and fixes; no overflow/limit violations remain.
- [ ] **R8.2 Functional regression:** full unit, integration and e2e suites green. Payments, auth, portal isolation and pricing accuracy verified. Lighthouse mobile ≥ 90 perf / ≥ 95 a11y on key pages.
- [ ] **R8.3 Docs:** update README/ADMIN-GUIDE screenshots and remove any remaining outdated design text. `REDESIGN-REPORT.md` (what changed, before/after, skills used, image traceability summary, known limitations). Deploy to **staging** and smoke test.
