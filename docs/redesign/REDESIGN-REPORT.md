# Redesign report (R0-R10)

Date: 2026-11-14. Mission: the complete UI/UX reconstruction in `BRIEF.md`, rebuilt from scratch in `src/ui/*`, never restyled. Only
business logic, schemas and routes were reused.

## What changed
- **R0-R1 research and direction.** Audit of every screen (`DESIGN_AUDIT.md`), all 29 inspiration images analysed
  (`REFERENCE_IMAGE_ANALYSIS.md`), two reference sites studied, three concept boards compared, concept B ("Route", sign green on felt)
  chosen. Specs: responsive, motion, panel, implementation plan.
- **R2 foundation.** Tokens (`src/ui/tokens/*.css`), Poppins type scale, one icon family (`src/ui/icons`), primitives (`src/ui/primitives`),
  a dev-only gallery, a mobile hard-limits guard (BRIEF B.1a), a multi-accent palette and an illustration system.
- **R3 shell.** New header, floating side menu, mega-panel, calm stacked footer with Settings-backed contact details, page transitions.
- **R4 public pages.** Home, division and service pages, carousel-first pricing with an all-plans comparison table, work, about, how we
  work, industries, contact and consultation, insights, careers, FAQ, legal, search, error pages, quote/invoice/pay documents and checkout.
  The Start-a-project wizard and the technologies section were removed.
- **R5 client workspace.** Linux-inspired shell (side navigation, status bar, command palette, mobile sheet), projects, billing,
  support, profile, auth screens, dark theme toggle.
- **R6 admin.** A more utilitarian shell, all modules rebuilt on shared patterns (`src/ui/admin/*`).
- **R9 owner refinements.** New service catalogue and prices (migration, seeds, 301s), brand "Kuzikode Intelligent Technologies" with a
  new brace-K mark set, Poppins, header, side menu, footer, image audit.
- **R10 home from scratch.** Component map from all 29 images (`HOME_COMPONENT_MAP.md`), composition doc, new `src/ui/public/home2/*`
  (photo hero with glass widgets, marquee, services track, why, how, pricing entry, closing band).
- **R7.** Owner images placed; one motion pass on public pages (composite-only properties, reduced motion safe; infinite shadow pulse removed).

## Before and after
| | Before | After |
|---|---|---|
| UI tree | `src/components` kit, generic navy/cobalt look | `src/ui/*`, tokens, Poppins, green-on-felt direction |
| Brand | Kuzikode Technologies | Kuzikode Intelligent Technologies, new SVG mark set |
| Home | template sections | `home2` rebuilt from the 29-image component map |
| Sweep tap targets < 44 px | 3381 | 19 |
| Sweep overflow (130 routes x 10 viewports) | 18 | 0 |
| Button-label wraps on phones | 689 | 0 |
| Body text < 16 px on phones | 725 | 580 (by decision, see below) |

## Skills and tooling used
`impeccable` (direction, critique, detect), `design-taste-frontend` (finish gate), `emil-design-eng`, `animate`/`review-animations`/
`animation-performance` (R7.2), `gestures` and `mobile-native` (carousels, sheets), `web-design-guidelines` (audit), the Vercel React
skills (component structure), `.claude/agents/impeccable-*` (reviewers, producers). Playwright drove the 10-viewport visual loop and
`scripts/qa-sweep.mjs`. Models: Sonnet for everything; Opus only at low effort for reviews.

## Image traceability
`IMAGE_TRACEABILITY.md` maps all 29 files to extracted ideas, targets and a status: **7 adopted, 13 adapted, 9 rejected** (rejections
are template looks, fake stats, stock skylines; a secondary idea is kept where noted). Every row lists where it was built.

## QA results (`QA_REPORT.md`)
- Full sweep: 130 routes (36 public, 15 portal, 79 admin), 6 skipped for lack of a seeded record, 10 viewports. Overflow 0, button
  wraps 0, broken images 0, tap targets 19 (was 397 after the first pass), axe serious/critical: sweep spec green.
- Lighthouse mobile on the local wrangler server: perf 99-100, accessibility 97-100, best practices 96-100 on `/`, `/pricing`,
  `/services/websites`, `/contact`, `/how-we-work`, `/insights`. Targets (90 / 95) met.
- Functional suites (unit, integration, e2e) were green at the last CI run on main; R8.2 is still unticked in the roadmap pending its own sign-off.

## Staging smoke test (2026-11-14)
`Deploy staging` run 99 succeeded for main SHA `1b7b2de` (CI green first). Against
`https://kuzikode-staging.mhodieknowledge.workers.dev`:
`/` 200, `/pricing` 200, `/contact` 200, `/services/websites` 200, `/api/health` 200, `/admin/login` 200,
`/admin` 303 to `/admin/login?next=/admin`, `/portal` 303 to `/portal/login`. Home title: "Kuzikode Intelligent Technologies".
Docs-only commits after this one are skipped by the workflow or redeploy the same code. Production was not touched.

## Known limitations
- **580 body-text hits under 16 px on phones** are captions, hints and footnotes, kept small by decision (DECISIONS.md).
- **19 tap targets under 44 px** remain: the desktop "On this page" summary at 1024 px (3), the portal stretched-link row title (7),
  and singular cases; accepted.
- **Contrast:** the recommended-plan badge (`.kz-plan__rec`) scores 97 on accessibility at `/pricing` and `/services/websites`;
  token tweak pending.
- **SEO 66-69 in Lighthouse** is only `is-crawlable`: non-production hosts send noindex on purpose. Re-measure on the production domain.
- **Saved cards** wait on Paynow approving card tokenization (BLOCKERS.md).
- **Paynow "Faked Success" test (P6.5)** needs the owner to complete it on the Paynow page (BLOCKERS.md).
- **Images:** the owner's pending requests are in `IMAGE-REQUESTS.md` (home batch requested 2026-11-14); the home reuses existing
  photographs until those arrive. Work and Voices sections stay hidden until real entries exist (no fabricated clients).
- Admin and portal screenshots in `docs/screenshots/` predate the redesign; only three 390 px public shots were refreshed.
- `docs/01-PRD.md` and `docs/12-COMMERCIAL-FEATURES.md` still say "Kuzikode Technologies" (proposed legal name); the product brand is now
  "Kuzikode Intelligent Technologies". Left as written (owner decision on legal name).
