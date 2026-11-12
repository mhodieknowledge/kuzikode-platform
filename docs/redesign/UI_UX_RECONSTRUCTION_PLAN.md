# UI/UX reconstruction plan (R1.2)

What changes, for whom, in which order, and how we know it worked. Detailed engineering order: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Goals (from BRIEF §18)
1. One coherent, distinctive identity across public site, workspace and admin: the **Directory** world.
2. Mobile as its own designed experience (rails, segmented controls, sheets, sticky actions), desktop equally finished.
3. Pricing presentation that a phone user can compare without scrolling 15 000 px, with every price unchanged.
4. Purposeful icons and motion; reduced motion respected.
5. Every backend behaviour, test hook and route preserved.

## Measures of success
| Measure | Before (audit) | Target |
|---|---|---|
| Legacy presentation files remaining | 98 | 0 by end of R6 |
| Home height at 390 px | 10 251 px | ≤ 7 000 px with the same content |
| Pricing height at 390 px | 15 721 px | ≤ 6 500 px, all packages and features reachable |
| impeccable detect anti-patterns (home) | 4 | 0 |
| Tap targets < 44 px (public pages) | 6–21 per page | 0 outside inline prose links |
| Form inputs < 16 px text | all | 0 |
| Lighthouse mobile perf / a11y | n/a | ≥ 90 / ≥ 95 on home, pricing, a division, contact |
| e2e + unit + integration | green | green |

## Phases (mirrors ROADMAP R2–R8)
**Clean slate (BRIEF B.0):** every visible part is rebuilt as new components in `src/ui/` and new layouts; old presentation code is
deleted as its replacement lands (checklist in IMPLEMENTATION_PLAN.md §8). Only logic is reused.
1. **Foundation (R2):** new token layer (done), icon system, new primitives (button, fields, segmented control, tabs, accordion, rail,
   sheet, dialog, toast, badge, list row, data table), new dev gallery replacing `/dev/ui`'s old kitchen sink.
2. **Shell (R3):** new PublicLayout, header + mobile sheet + mega-panel, footer, motion module.
3. **Public pages (R4):** each page's markup rewritten from the new specs (home → services → pricing → work → about group → contact
   group → the rest → documents and checkout); its old sections deleted when unused.
4. **Workspace (R5)** then **Admin (R6):** new layouts and screens; island logic extracted to hooks, new markup around it.
5. **Imagery and motion polish (R7)**, then **QA and docs (R8)**.

## Content and data rules during the rebuild
- All visible copy stays CMS-driven where it is today; new micro-copy (labels, empty states) follows the PRD copy rules.
- "From $X" on directory rows is computed from active packages through the existing catalogue service; hidden when prices are hidden.
- Product UI imagery on the home page is rendered from real components with fictional data and labelled "Illustrative".
- No new claims: no stats, logos, testimonials, years, client names.

## Risks and handling
| Risk | Handling |
|---|---|
| e2e tests pin old labels / structure | New components carry the same `data-*` hooks and accessible names; update tests in the same commit with reasons |
| CSP blocks new inline scripts | Use Astro-bundled `<script>` (hashed) only; no inline handlers |
| Font weight on mobile data | One variable family (latin subset ~90 KB, `font-display: swap`, preloaded) + mono loaded only where figures appear above the fold |
| Admin modules are large React files (≈ 15 000 lines) | Split each into a logic hook (unchanged API calls) + new markup, one module per commit, its e2e spec green each time |
| Owner images arrive late | Every section designed without them first (B.4) |
