# QA report

Running log of browser QA (BRIEF B.2, §17). Each entry: what was exercised, at which viewports, what was found and fixed.
Harness: `playwright.visual.config.ts` (`SHOOT=… SHOOT_SET=all|core|quick SHOOT_REDUCED=1`), helpers in `.shots/` (ignored).

## 2026-11-12 · R2.3–R2.4 primitives gallery (`/dev/ui`)
- Viewports: 375, 390, 430, 768, 1440 (+ 360 overflow check), reduced motion on.
- Found and fixed:
  - 16 px horizontal page overflow at 375/390: a non-scrolling segmented control with three long options was wider than the
    column and its min-content width inflated every parent grid. Fix: every `.kz-seg` scrolls inside its own width; scrolling
    primitives (`.kz-seg--scroll`, `.kz-tabs`, `.kz-rail__track`) use `contain: inline-size`; new `stack` utility (one
    `minmax(0,1fr)` column) for vertical stacks.
  - axe colour contrast (serious) on the felt segmented control: the felt option colour outranked the selected white. Fixed by
    selector specificity; 0 violations at 390 and 1280.
  - Segmented controls stretched to full width inside grids: now `justify-self: start` unless `block`/`scroll`.
- Interactions exercised (e2e `tests/e2e/ui-kit.spec.ts`, 8 tests green): tabs-mode segmented (click + arrow keys + panels),
  rail next button scrolls and the page has no sideways scroll at 375, bottom sheet open/Escape/`aria-expanded`, typed destructive
  confirm + toast, money input minor units + decimal error, data table → list rows under 768 px + empty state.
- Tap targets: only the deliberate `sm` button (40 px, dense desktop/admin use) and the consent checkbox input (its label row is
  44 px tall) are under 44 px.
- Note: `npm run build` alone does not refresh a running `wrangler dev`; always restart (`.shots/restart.sh`) before shooting.

## 2026-11-12 · R3.1–R3.2 public shell
- Viewports: 390, 768 (menu sheet open, scrolled to end), 1440 (mega-panel open with row 04 lit; About panel), footer at 390/1440.
- Found and fixed: header CTA, icon buttons and the logo link were 40/26 px tall → 44 px; footer links 40 px → 44 px with padding;
  directory "from $25"/"from $20" hid hourly/yearly units → non-one-off prices show their unit; lit-frame chips invisible on felt
  → bordered; decorative footer wordmark failed axe contrast even when aria-hidden → generated content (`::before`).
- e2e: public-layout (mega-menu, Escape returns focus, menu dialog at 1024/768/375, skip link, footer legal, no blank contacts),
  site-content (header search + mobile search), careers (nav shows Careers while a role is open): 9 green.

## 2026-11-12 · R4.1 home body
- Viewports: 360, 375, 390, 412, 430, 768, 1024, 1280, 1440, 1920: no horizontal overflow, no sub-44 px controls in main.
- Found and fixed: page overflow of 743 px at 390 from `sr-only` stop labels escaping the road-strip scroll track (absolute
  descendants whose containing block is outside a scroll container are not clipped) → `.kz-track { position: relative }`;
  approach grid min-content overflow → `minmax(0, 1fr)`; custom-quote packages showed no price → "Quoted"; values link stretched
  away from its heading → `align-content: start`; tools line divider started a wrapped line → plain wrapped list.
- Interactions: route tabs (click, ArrowLeft/Right, panel hidden/visible, cross-fade), quote links preselect `?category=`; reveal
  groups on the road strip and values; reduced motion shows everything (motion.spec).
- Distinctiveness board `docs/screenshots/redesign/boards/home-board.webp` (before 390/1440, new 390/1440, IMG_5056/5066/5055).
  Fresh impeccable-finish-reviewer: first cut FAIL (stock photo + icon grid in Why, three sparse splits, old section order) →
  fixes → PASS.

## 2026-11-12 · R2.5c Route drawings
- /dev/ui gallery (bone + night) at 390 and 1440; home services band at 360–1440: no overflow; drawings scale with their column.
- Board `docs/screenshots/redesign/boards/division-drawings-board.webp`. Fresh reviewer: FAIL (Cloud & IT grey and three stock icons;
  web mountain/sun placeholder and gold lit collision; muddy night tints; generic sync glyph) → fixes (lagoon accent for division 06,
  cabinet → mailbox + backup cards, product grid, 58% night tints, packet on an arc) → PASS.
- Reduced motion: `.i-move` animations are inside `prefers-reduced-motion: no-preference` only.

## 2026-11-12 · R4.2 services index + division pages
- Viewports 360, 390, 430, 768, 1024, 1440 on /services and all six division pages: no overflow, no sub-44 px controls.
- Found and fixed: a broad desktop `.kz-track` rule stacked the packages full width; offer track lost its side padding; tablet header
  drawing pushed the action below the fold (capped at 440 px); price units missing in the index ("from $25" → "per hour");
  mono comma at display size ("$1, 500") → Overpass 800 tabular; phone table action clipped in the narrow column → separate full-width row.
- Boards `docs/screenshots/redesign/boards/services-board.webp`, `services_web_development-board.webp`. Reviewer: both FAIL (six-tile
  hero, BEFORE-shaped atlas rows, stock service-page order with card plates) → recomposed → index PASS; division PASS after the phone
  action fix.
- e2e: `services-public.spec.ts` (photo hero, atlas rows with drawings + units, phone accordion, comparison table, recommended column,
  package preselect links, phone package selector).

## R4.3 Pricing (2026-11-12)
- References opened: IMG_5060 (light left header, tinted plates, one filled featured plan), IMG_5070 (plans → compare table → FAQ),
  IMG_5071 (comparison table, lifted recommended column), IMG_5058 (inverted recommended plan, ruled feature rows), IMG_5057 (selector above plans on phones).
- Viewports shot: 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920 (+ 390 reduced motion). No horizontal overflow; no main tap target < 44 px.
- Interactions exercised: plan selector ↔ swipe track sync both ways (tap chip scrolls, swipe updates chip), "All features" disclosure,
  sticky category control (scroll-spy; returns to "Websites" at the top; short labels on phones), ledger rows as whole-row links.
- Found and fixed: track opened mid-scroll on phones (now the recommended plate is first via CSS order, no load-time scrolling); 4-up
  plates + table too tight at 1024 (plates/table side by side from 1200 only); compare buttons overflowed at 1024–1279 (row-label column 26 %);
  axe contrast on division numerals on night (numerals removed, hue kept in the rule); footer linked the page to itself.
- Board `docs/screenshots/redesign/boards/pricing-board.webp`. Reviewer (impeccable-finish-reviewer, opus/medium): **PASS** on both
  questions with 8 fixes (track start, hidden 4th category on phones, phone section gaps, clashing numbering, framed arrow buttons,
  flat hero slip, three identical bands, accent doing two jobs) → all applied (email & domains is now a title-left flat ledger; slip has an
  offset sheet and a ruled foot).
- e2e: `pricing.spec.ts` (updated: `li[data-package]`, "Recommended", request links), new `pricing-accuracy.spec.ts` (B.6, 390 + 1440).

## R4.4 Our Work (2026-11-12)
- Reference opened: IMG_5066 (pinned, tilted step cards with a dashed thread; portfolio rail). Viewports: 375, 390, 768, 1440 (empty), 390/1440 grid
  and case study with throwaway local QA rows (inserted and deleted again in the local D1 only). No overflow; no main tap target < 44 px.
- Board `docs/screenshots/redesign/boards/work-board.webp`. Reviewer (opus/medium): FAIL (grid: repeated names on plates, vertical stack of slabs,
  dead space in the lead row; case study without a visual; drawing too small an echo of IMG_5066; five CTAs on the empty page) → all six fixes
  applied and re-shot (monogram plates, phone rail from 3, step labels in the drawing, single action on the empty page, lead row aligned to the
  plate foot, cover/monogram plate + technologies in the spec sheet + "More case studies"). Not re-reviewed (usage economy); verified by screenshots.
- e2e: `work.spec.ts` (+ designed empty-state test); integration: gallery read (cms-admin).

## R4.5 About, How we work, Industries, Technologies (2026-11-12)
- References opened: IMG_5048 (cards over the hero edge → About route plate), IMG_5055 (numbered full-width rows → values, objectives,
  sector directory), IMG_5056 (text-first heroes, directory rhythm), IMG_5066 + IMG_5067 (numbered route / stepper → vertical process road),
  IMG_5018 (document + summary composition → scope sheet), IMG_5052 (label tile leading a grid), IMG_5060 + IMG_5057 (sector packages deck).
- Viewports shot: 375, 390, 430, 768, 1024, 1440, 1920 (About, How we work, Industries, Retail, Education). No horizontal overflow (fixed one:
  implicit grid column sized to the phone swipe track); axe contrast fixed on mono numerals over inset bone (ink-500 → ink-700) and the note footer.
- Interactions: values / engagement models / sector services swipe tracks with dots (desktop ledgers), package selector ↔ track, area chips → division pages.
- Boards `docs/screenshots/redesign/boards/{about,how_we_work,industries,industry_retail}-board.webp`. Reviewer (opus/medium): How we work PASS,
  Industries PASS; About FAIL (duplicate hero photo, all-text lower half, long phone hero) and Retail FAIL (no visual, empty package plates) → 10 fixes;
  re-review: Retail PASS, About FAIL on the interim group photo → hero now a people-free desk still life (close crop), Retail chips 2-up and plates
  unstretched. Not re-reviewed after that last About fix (usage economy); verified by screenshots.
- Interim photos stay until batch 3 (`about-hero`, `about-studio`, `how-we-work-band`) is delivered.
- e2e: `about.spec.ts`, `industries.spec.ts` (+ areas-of-work links), `site-content.spec.ts` (Tools we build with, 5 road stops, 5 scope milestones).

## R4.6 Contact + consultation (2026-11-12)
- References opened: IMG_5018 (two-column form + summary), IMG_5017 (split brand panel + form), IMG_5015 (step progress → numbered parts).
- Viewports: 360, 390, 768, 1440 (+ package preselect at 390/1440). No overflow; inputs 16 px; targets ≥ 44 px; one column and a full-width action on phones.
- Interactions: category → service select, package preselect + message prefill, "You are sending" preview (always shown), server field errors,
  consultation times (client-side "at least one time" check), success panels with the reference.
- Boards `contact-board.webp`, `consultation-board.webp`. Reviewer (opus/medium): both FAIL (desktop voids, plain preview only on package
  links, H1 breaking "30-/minute", time slots, eyebrow-like meta line, "Service" label pattern) → all fixed: "After you send" road stops on both
  pages, preview on every visit, no-wrap "30-minute", slots full width with "(optional)" labels, meta line removed, Service "(optional)".
  Not re-reviewed (usage economy); verified by screenshots.
- e2e: `contact.spec.ts` (+ preview line), `engagement.spec.ts` consultation flow unchanged and green.

## R4.7 Insights, Careers, FAQ, Products, legal, search, 404/500 (2026-11-12)
- References opened: IMG_5055 (numbered full-width rows → insights ledger, roles index, FAQ index, 404 routes), IMG_5067 (title-left / link-right
  headers), IMG_5056 (text-first heads), IMG_5057 (FAQ accordion +/−), IMG_5018 (application sheet + summary; interest form beside the product),
  IMG_5015 (numbered form parts, "How applying works" stops).
- Viewports: 360, 390, 430, 768, 1440 for insights index, careers, role page, products; 390 + 1440 for article, FAQ, legal, search (results and
  none), 404. No horizontal overflow (fixed one: FAQ side column min-content widening the grid on phones); phone H1 32 px, H2 22–24 px; tap
  targets ≥ 44 px (fixed: FAQ side plate button, 404 search button).
- Interactions: category road (aria-current), article "On this page" (open + section marking on desktop, disclosure on phones), related swipe
  track, FAQ live filter + deep links + category marking, legal contents, grouped search, careers filters, sticky phone apply bar (hidden once the
  form is in view), application parts + summary, interest form.
- Boards `{insights,insights_article,faq,legal,notfound,careers,careers_role,products}-board.webp`. Reviewer (impeccable-finish-reviewer,
  opus/medium): all eight PASS (FAQ, article and role page "weak"). Fixes applied: 404 route numerals in division hues, products form flattened
  to paper + hairline (no float shadow), status tag as a gold plate in words (not a mono code tag), room under the phone apply bar. Deferred to
  R7.2/R8.1: varying the footer "Where next" band per page, a pinned FAQ category road on phones, a "next article" close on articles.
- Note: the sample role in careers screenshots is test data from `careers.spec.ts` (local D1 only).

## R4.8 Public documents + checkout (2026-11-13)
- References opened: IMG_5013 (bill strip above method choice), IMG_5014 (receipt ticket, perforated edge), IMG_5016 (phone number first, fee on
  its own line), IMG_5018 (document/form left, sticky summary right; icon-over-label method tiles).
- Viewports: documents 360/390/768/1440 (fixture invoice INV-E2E-P002; fixture quotation through a temporary local-only token, restored);
  checkout 360/390/430/768/1440 in every state (choose, mobile money, waiting, wallet code, OTP, saved card, paid, failed, bank, return, nothing
  to pay). No overflow; targets ≥ 44 px (consent checkbox row 44 px); phone H1 24–28 px.
- Boards `documents-board.webp`, `checkout-board.webp`. Reviewer (opus/medium): both PASS. Applied: invoice number in the phone summary, stale
  "Amount due now / Due now" swapped for a paid note after a successful payment (CSS `:has([data-co-paid])`, no reload), waiting-line copy.
  Deferred to R8.1: distinct wallet marks on the method tiles, perforation placement on phones, status-plate contrast, part-paid notice wording.
- e2e green (31 + 10 re-run): checkout, full-journey, public-documents, payment-gateways, reconciliation, quotations, invoices, subscriptions,
  portal-auth, security, mobile-limits, sweep, links. No payment spec edited.
