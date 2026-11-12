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
