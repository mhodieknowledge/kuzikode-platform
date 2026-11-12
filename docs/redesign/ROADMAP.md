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
- [x] **R1.1 Design direction.** Compare candidate palettes (from the references) and pick ONE. Choose type pairing, grid, spacing scale, radius, elevation, icon family (one, consistent stroke), image art direction, motion principles. AC: `DESIGN_DIRECTION.md` with rationale and the skills used.
- [x] **R1.2 Specs.** `RESPONSIVE_DESIGN_SPEC.md` (per page: mobile composition first, then tablet and desktop; carousels, segmented controls and sticky CTAs where they help), `MOTION_AND_INTERACTION_SPEC.md` (durations, easings, choreography, reduced motion), `PANEL_DESIGN_SPEC.md` (Linux-inspired client workspace + admin, distinct but related), `UI_UX_RECONSTRUCTION_PLAN.md` + `IMPLEMENTATION_PLAN.md` (order, component inventory, what's reused vs rebuilt). AC: files exist and agree with each other.
- [x] **R1.3 First image batch.** Write batch 1 of image prompts for the new direction in `IMAGE-REQUESTS.md` and notify the owner (B.4). AC: committed; notification sent or failure logged.

## R1.4: Clean-slate correction (inserted 2026-11-12 by the owner)
- [x] **R1.4 Rewrite the plan for a clean slate (BRIEF B.0).** Revise `IMPLEMENTATION_PLAN.md` and `UI_UX_RECONSTRUCTION_PLAN.md`: every
  "Restyle"/"reuse presentation" entry becomes **Rebuild (new component in `src/ui/…`)**, with only logic reuse listed. Add the
  "legacy presentation removed" checklist (every old component and layout file, with the task that deletes it). AC: grep of both plans
  finds no "restyle"/"reskin" strategy entries. Logged in DECISIONS.md.

## R2: Foundation
- [x] **R2.1 Design tokens + base styles** (colour, type scale with fluid mobile→desktop sizing, spacing, radius, shadows, z-index, motion tokens, dark/light surfaces for panels). Replace the old token set.
- [x] **R2.2 Icon system** (single family, wrapper component, sizes, stroke, a11y labels) and an audit list of every place that needs an icon.
- [ ] **R2.3 Core primitives rebuilt:** buttons, links, inputs/forms (mobile-friendly: 16 px+ inputs, correct keyboards, inline validation), segmented control, tabs, accordion, carousel/swipe track (scroll-snap + buttons + dots, fade/slide choreography, keyboard + reduced motion), sheet/drawer, dialog, toast, badge/status, table → mobile list pattern.
- [ ] **R2.4 Dev UI gallery** page (dev-only) showing every primitive at 390 and 1440. AC: visual loop clean.

## R3: Public site shell
- [ ] **R3.1 Header + mobile navigation** (designed mobile menu/sheet, animated indicators, sticky behaviour, primary CTA always reachable).
- [ ] **R3.2 Footer** (distinct mobile composition, contact channels with icons, legal).
- [ ] **R3.3 Page transitions / section reveal** framework per the motion spec.

## R4: Public pages (mobile first, each with its own mobile composition)
- [ ] **R4.1 Home.**
- [ ] **R4.2 Services index + division pages + service detail.**
- [ ] **R4.3 Pricing / packages** (presentation only; desktop comparison + mobile swipe/selector; price-accuracy test from B.6).
- [ ] **R4.4 Our Work / portfolio + case study** (image transitions, empty state that still looks designed).
- [ ] **R4.5 About, How we work, Industries, Technologies.**
- [ ] **R4.6 Contact, Start-a-project wizard, consultation booking** (forms: mobile usability first).
- [ ] **R4.7 Insights/blog, Careers, FAQ, Products (in-development item kept modest), legal, search, 404/500.**
- [ ] **R4.8 Public document & checkout pages** (`/q/`, `/i/`, `/pay/…`, the custom checkout) in the new language. Payment flows still pass their e2e tests.

## R5: Client workspace (Linux-inspired)
- [ ] **R5.1 Workspace shell:** side navigation, top status bar, window/panel pattern, command palette, mobile shell (bottom bar or sheet nav), light/dark surfaces.
- [ ] **R5.2 Overview, projects (milestones, updates, deliverables, messages).**
- [ ] **R5.3 Quotations, invoices, payments and receipts, saved cards, subscriptions/services.**
- [ ] **R5.4 Support, profile, devices, auth screens** (sign-in, reset, invite, verify).

## R6: Admin interface
- [ ] **R6.1 Admin shell** in the related but more utilitarian panel language (keep it distinct from the client workspace).
- [ ] **R6.2 Restyle every admin module** (dashboard, clients, leads, services, packages, quotations, invoices, payments, projects, expenses, CMS, careers, notifications, settings, reports, audit) with functionality untouched. Dense data views get a mobile list/card pattern.

## R7: Imagery and motion polish
- [ ] **R7.1 Process delivered owner images** (B.4) and replace interim treatments. Further prompt batches as needed.
- [ ] **R7.2 Motion pass** with `find-animation-opportunities`, `improve-animations`, `review-animations` and `animation-performance`, then `remove-animations` for excess.

## R8: QA and finish
- [ ] **R8.1 Full visual QA** at all 10 viewports for every page, the workspace and admin. `break-ui` on key components. `web-design-guidelines` + `impeccable` audit + `design-taste-frontend` finish gate. Fix everything found. AC: `QA_REPORT.md` with results.
- [ ] **R8.2 Functional regression:** full unit, integration and e2e suites green. Payments, auth, portal isolation and pricing accuracy verified. Lighthouse mobile ≥ 90 perf / ≥ 95 a11y on key pages.
- [ ] **R8.3 Docs:** update README/ADMIN-GUIDE screenshots and remove any remaining outdated design text. `REDESIGN-REPORT.md` (what changed, before/after, skills used, image traceability summary, known limitations). Deploy to **staging** and smoke test.
