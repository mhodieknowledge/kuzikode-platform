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
| Home height at 390 px | 10 251 px | ≤ 7 000 px with the same content |
| Pricing height at 390 px | 15 721 px | ≤ 6 500 px, all packages and features reachable |
| impeccable detect anti-patterns (home) | 4 | 0 |
| Tap targets < 44 px (public pages) | 6–21 per page | 0 outside inline prose links |
| Form inputs < 16 px text | all | 0 |
| Lighthouse mobile perf / a11y | n/a | ≥ 90 / ≥ 95 on home, pricing, a division, contact |
| e2e + unit + integration | green | green |

## Phases (mirrors ROADMAP R2–R8)
1. **Foundation (R2):** tokens replaced (old Tailwind theme names aliased to the new values so untouched admin/portal code reskins at
   once), fonts swapped, base styles, icon wrapper, primitives (button, input, segmented control, tabs, accordion, rail, sheet, dialog,
   toast, badge, list row), dev gallery at `/dev/ui`.
2. **Shell (R3):** header + mobile sheet + mega-panel, footer, reveal / scroll-spy module.
3. **Public pages (R4):** home → services → pricing → work → about group → contact group → the rest → documents and checkout.
4. **Workspace (R5)** then **Admin (R6)**.
5. **Imagery and motion polish (R7)**, then **QA and docs (R8)**.

## Content and data rules during the rebuild
- All visible copy stays CMS-driven where it is today; new micro-copy (labels, empty states) follows the PRD copy rules.
- "From $X" on directory rows is computed from active packages through the existing catalogue service; hidden when prices are hidden.
- Product UI imagery on the home page is rendered from real components with fictional data and labelled "Illustrative".
- No new claims: no stats, logos, testimonials, years, client names.

## Risks and handling
| Risk | Handling |
|---|---|
| e2e tests pin old labels / structure | Keep `data-*` hooks and accessible names; update tests in the same commit with reasons |
| CSP blocks new inline scripts | Use Astro-bundled `<script>` (hashed) only; no inline handlers |
| Font weight on mobile data | One variable family (latin subset ~90 KB, `font-display: swap`, preloaded) + mono loaded only where figures appear above the fold |
| Admin modules are large React files | Reskin through tokens + primitives first; touch module markup only where layout must change (tables → list rows) |
| Owner images arrive late | Every section designed without them first (B.4) |
