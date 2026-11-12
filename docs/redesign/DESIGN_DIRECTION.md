# Design direction (R1.1, redone through the R1.5 concept gate)

Status: **committed 2026-11-12, replaced the same day.** The first direction ("Directory": felt navy + cobalt) was rejected by the
owner as generic (BRIEF B.0b, B.0d) and is kept only as an anti-reference. This version comes from the R1.5 concept gate. Top authority remains `BRIEF.md`; this file records the visual decisions that implement it.
Durable tokens are recorded in `DESIGN.md` at the end of the build (impeccable documenter), from the shipped code.

## 1. Skills check (R0.1)

All skills listed in BRIEF B.3 are present in `.claude/skills/` and load (each has a `SKILL.md` with a matching `name:`): impeccable,
design-taste-frontend, emil-design-eng, animate, choreograph, improve-animations, review-animations, find-animation-opportunities,
remove-animations, animation-performance, animation-vocabulary, gestures, mobile-native, apple-design, break-ui, pick-ui-library,
web-design-guidelines, vercel-react-best-practices, vercel-composition-patterns, vercel-react-view-transitions, writing-guidelines,
pen-design (22). The four impeccable helper agents are in `.claude/agents/`. `skills-lock.json` records their sources and hashes.

- `impeccable context` ran (target `src/pages/index.astro`): no PRODUCT.md / DESIGN.md, existing visual implementation → redesign
  route (init → new-work). **Init interview substituted:** the owner's standing instruction is "don't ask me questions", so
  `PRODUCT.md` was written from the PRD, docs/12 and the brief, with inferred lines marked. No hooks installed (as instructed);
  the detector is run manually (`impeccable detect`).
- `impeccable concept-seed --scope direction --mode persuade` ran (seed reference `seed:658d80b5dbf5df50`): assigned index 7 of the
  grounded list below, six catalog challengers. **Decision page substituted:** the session is unattended by the owner's instruction,
  so the assigned direction is built and the assumptions are stated here. Build path: **code-led** (no comp round); image generation
  for comps was not used because shipped imagery comes from the owner (BRIEF B.4).
- design-taste-frontend house rules applied: one system, one section per screen, equal edges, real product UI as imagery, a hero
  entrance plus one or two dealt moments per page, quiet micro-interactions, no shader effects (this is a services company, not a
  game or AI-model site), finish gate in the browser (R8.1).
- Failures: none. `landing.love` (403), `siteinspire` (429) and `awwwards` (connection reset) refused automated capture during R0.4;
  hoverstat.es and curated.design were captured instead.

## 2. Physical scene → light or dark

A shop owner in Harare checks Kuzikode on a mid-range Android phone in bright daylight between customers, on mobile data; later the
office manager compares packages on a laptop. Daylight on phones forces **light reading surfaces** (verge); the sign green owns the
first viewport and the footer, where it reads like a road sign in sun: flat, high contrast, never glowing.

## 3. The concept gate (R1.5) and the world: "Route"

**Gate.** Three full home-page prototypes (static HTML, desktop + phone) in `design/concepts/a|b|c/`, each composed from named
reference images and a non-blue palette, rendered at 390 and 1440 and boarded next to their references
(`docs/screenshots/redesign/concepts/concept-*-board.webp`).

| Concept | World | Palette | References driving it | Fresh reviewer (impeccable-finish-reviewer, board only) |
|---|---|---|---|---|
| A · Coursing | Great Zimbabwe dry-stone courses (the roll's assigned candidate 5) | granite greys + lichen ochre | 5066, 5065, 5055, 5054, 5060 | generic: yes. Distinct 4 · anti-generic 5 · mobile 4 · credible 7 · offer 8 |
| **B · Route** | **road wayfinding: green gantry signs, route shields, a road strip with stops** | **sign green + verge + mint** | **5056, 5071, 5067, 5057, 5055** | **generic: mostly no. Distinct 7 · anti-generic 7 · mobile 8 · credible 7 · offer 8 → winner** |
| C · Till | shop counter: till slip, highlighter | near-black + lime | 5054, 5055, 5065, 5014, 5051 | generic: yes (near-black + neon template). Distinct 6 · anti-generic 4 · mobile 6 · credible 5 · offer 7 |

Taste checker (`design-taste-frontend/scripts/consistency.mjs`, 1440 + 390, `--page service`) on A: contrast of tertiary greys,
heading scale, focus-visible on header links and "text-only" sections; on B: section height at 1440 (sections taller or shorter than
one or two screens), focus-visible on header links, heading scale, the hero action below the fold at 390 (the sign plates are the
action there); on C: section height and one-section. These rules are carried into the tokens below (tertiary ink
≥ 4.5:1, one heading scale, visible focus everywhere). **Chosen: B.** Its central device does a job: choosing a road is how a visitor
chooses a service, each sign carries the real starting price, and the phone layout is its own composition (sign stack, scrolling
route tabs, one-column-at-a-time comparison). The impeccable roll (`concept-seed --scope direction --mode persuade`,
seed:fc069276a80d2a45) assigned grounded candidate 5 (coursing); it was built as concept A and lost on both axes, so the brief's
gate (B.0d: choose the strongest of three) decides, not the roll.

**Grounded candidates, ordered by resonance** (audience: SMB owners and managers in Zimbabwe; cultural home: Harare's working city):
1. Mobile-money receipt / till slip (EcoCash SMS, thermal slips) → concept C. 2. **Road wayfinding: green highway signs, numbered
routes, exits, route maps → concept B.** 3. Swiss identity manual. 4. Engineering drawing set on drafting film. 5. Great Zimbabwe
dry-stone coursing → concept A (assigned by the roll). 6. Kombi rank route boards. 7. Office-tower lobby directory (spent: the
rejected first direction).

**Thesis.** Kuzikode is the road sign at the junction: plain words, a number for every route, the distance (here: the starting
price) on every plate, one green you trust because it never changes. It refuses the category default (dark hero + bright CTA +
stock team photo + identical icon cards) and the AI near-black-plus-neon look.

**Signature devices.**
- **The gantry** (hero): six sign plates, white inset border on sign green, a route shield with the division number, the division
  name in Overpass bold, the published "from" price in mono. Each plate is the way into that division. Phone: a stack of plates
  (the first viewport is the choice, not a picture).
- **Route tabs** (division switcher, pricing groups): numbered tabs that scroll sideways on phones; content cross-fades + 8 px rise.
- **Comparison table** (pricing): lifted recommended column on desktop; on phones a package selector shows one column at a time
  against the row labels (IMG_5071).
- **Road strip** (process, project milestones): a dark road with a dashed centre line and stop plates S1–S5; vertical on phones.
- **Plate buttons**: rectangular, 7 px corners, an inset ring (white on green, green on white) like a sign's border. No pills, no
  round arrow knobs.

**Raises kept from the declined catalog challengers** (the roll's six challengers were weighed against the build; all declined):
- Magazine identity program → *found landmark:* the route shield appears once per view as the wayfinding mark, never as ornament.
- Depot destination blind → *whole-step motion:* state changes move in whole steps (tab thumb, table column swap), never drift.
- Darkroom safelight → *preview before commit:* the quote summary shows what will be sent before the form is submitted.
- Menhera pastel, brine calendar, multiplane cel → declined outright; *one-plane discipline* kept: no parallax, text always on the
  nearest plane.

Reviewer fixes applied before promotion: signs rebuilt as real plates (route shields, double border) without repeated arrows; the
third green band (workspace) moved to verge; the footer wordmark removed; the copied dot timeline replaced by the road strip;
"Most chosen" renamed **"Recommended"** (from the package's `most_popular` flag; no usage data is claimed).

## 4. Palette (one direction: sign green)

Candidates compared (from `/inspiration-images`, BRIEF B.0b): black + lime (5054/5055/5065, concept C), **deep green + mint (5056,
concept B)**, monochrome + warm accent (5066, concept A, lichen ochre), teal (5015). Blue, cobalt, indigo and violet are excluded by the
owner. **Chosen: sign green.** Strategy: **Committed** (sign green owns the first viewport, recommended package, CTA and footer;
verge carries reading; mint is spent only on lit/active things on green).

| Token | Hex | Use |
|---|---|---|
| sign-950 | #06301C | Deepest green: workspace dark surfaces, footer base |
| sign-900 | #0B4A2D | The sign: hero, recommended column, primary buttons, footer |
| sign-800 | #0F5B38 | Raised plate on sign; links on light |
| sign-700 | #1B6E47 | Hover plate, lines on sign |
| mint-400 | #7FE3A8 | Lit state on sign (prices, active shield, focus ring on green) |
| mint-200 | #B9F2CF | Secondary text on sign |
| mint-50 | #E3F6EA | Selected tint on light (always with an inverted indicator) |
| verge-50 | #F1F4F0 | Page ground |
| verge-100 | #E2E8E2 | Inset sections, secondary ground |
| verge-200 | #CDD6CE | Hairlines on light |
| paper | #FFFFFF | Cards, inputs, tables |
| ink-900 | #0D1A12 | Text on light |
| ink-700 | #3C4A41 | Secondary text (≥ 8:1 on verge) |
| ink-500 | #56655B | Tertiary text (≥ 5:1 on verge) |
| status | ok #1E7D46 · warn #9C5B0A · danger #C9372C · info = ink-700 | Always with an icon and words |

Contrast: white on sign-900 13:1; mint-400 on sign-900 8:1; sign-900 on verge-50 12:1; ink-500 on verge-50 5.3:1.

## 5. Type

- **Overpass** (variable, wght 100–900, self-hosted via `@fontsource-variable/overpass`): the open-source descendant of Highway
  Gothic, the lettering of road signs. Display weight 800, tracking −0.03em, leading 0.98–1.04; headings 800; UI labels 600–700;
  body 400 at 17 px phones / 18 px desktop, leading 1.5.
- **Overpass Mono** (variable) for every figure: prices, route numbers, references, dates and amounts in tables, the workspace status
  bar. Tabular numerals.
- Fluid scale (phone → 1440): display-xl clamp(2.5rem → 5.4rem), display clamp(2rem → 3.4rem), h2 clamp(1.75rem → 2.6rem),
  h3 1.25 → 1.5rem, body 1.0625 → 1.125rem, small 0.9375rem, micro 0.8125rem. No eyebrow labels above headings.
- Archivo and JetBrains Mono are removed with the old direction.

## 6. Grid, spacing, shape, elevation

- 4 px base. Section rhythm 72 px phones, 96 px tablet, 112 px desktop. 4 / 8 / 12 columns; 16 px side margins on phones, 32 px from
  768, 1320 px content max. Equal edges: every section shares the left edge.
- Radius: 4 px (inputs, small chips), **7 px** (plates, buttons, tabs: a road sign's corner), 12 px (large panels, sheets). No pills.
- Plates carry an inset double ring instead of a drop shadow; one floating shadow for menus, sheets, dialogs:
  `0 16px 40px -12px rgb(6 48 28 / .32)`.

## 7. Icons

**Lucide** as the single family (`lucide-react` + the Astro `Icon` wrapper), stroke 2 at 20 px (sign weight), `currentColor`, sizes
16/20/24/32. Icons sit beside words; arrows only where the plate leads somewhere new, never repeated on every row. Route shields and
stop plates are drawn shapes, not icons.

## 8. Imagery art direction

- Real product UI (workspace panes: milestones, quotation, invoice with local payment methods) is the primary image.
- Existing owner photos are reused in a **green duotone** (#062616 shadows → #E8F2EA highlights), never as the hero, never as "our
  team". New owner images (IMAGE-REQUESTS batch 2) follow the same grade: places and hands at work in Harare daylight.
- No gradients, glows, blobs, glass or 3D.

## 9. Motion principles (full spec: MOTION_AND_INTERACTION_SPEC.md)

Mechanical and certain, like a sign flip: 120 ms press, 180 ms state, 240 ms enter, 320 ms panel swap; ease-out
`cubic-bezier(.16,1,.3,1)` for entering, no bounce. Plates rise 2 px on hover and their shield lights mint; tab thumbs and table
columns move in whole steps; division content cross-fades with an 8 px rise; the hero enters once. Reduced motion: opacity only.

## 10. Registers across the platform

- **Public (Persuade):** the Route world at full commitment: gantry, route tabs, comparison table, road strip, plate buttons.
- **Client workspace (Operate):** Linux-desktop clarity in the same language: a mono status bar, a dock of workspaces, window panes
  with title bars, a command palette; light (verge) by default, dark theme on sign-950. Project milestones use the road strip.
- **Admin (Operate, utilitarian):** same tokens, denser, verge-only content, a sign-950 sidebar; no hero surfaces.

## 11. Skills that shaped decisions
| Skill | Decision |
|---|---|
| impeccable (context, init, new-work, concept-seed, craft-floor, finish-reviewer agent, detect) | PRODUCT.md, the concept gate (roll, grounded list, raises), the board critique that chose Route |
| design-taste-frontend | Consistency checker on the concepts (contrast, heading scale, focus), one-system rule, real product UI as imagery, finish gate |
| emil-design-eng / animate / choreograph | Motion durations, curves, stagger limits, interruptible transitions |
| mobile-native / gestures / apple-design | Mobile sheet nav, swipe rails, safe areas, 44 px targets, 16 px inputs, no hover-dependence |
| web-design-guidelines | Audit checklist (focus, labels, contrast, forms) |
| vercel-composition-patterns / react-best-practices | Primitive APIs (compound Tabs / Segmented / Sheet), island boundaries |
| pick-ui-library | No new UI library: primitives are hand-built (Astro + small React islands) to keep bundles small |
