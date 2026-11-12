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
office manager compares packages on a laptop. Daylight on phones forces **light reading surfaces** (bone); night (near-black) carries
the services band, the footer and the workspace window, high contrast, never glowing. (R1.5 had sign green here; replaced at R2.5b.)

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

**Signature devices** (as refined at R2.5b, BRIEF B.0b+/B.0e/B.1a, after the second board review):
- **The workspace window** (hero): the real client workspace drawn as the hero object: a night window with a side dock, the project's
  milestone strip, an approved quotation and the latest update, with a paper invoice card (local payment methods) layered over its
  edge. Depth from layering, hairlines and a soft shadow ladder; it rises once on load. No stock photograph under it. Phones: the
  window is in the first screen under a short headline, one value line, one primary action and the starting price.
- **The route index**: the six divisions as numbered routes, each numeral in its division hue, with the published "from" price.
  Phones: a swipe track (next plate peeking, dots). Desktop: a typographic index (3 × 2, rules between rows), never six equal boxes.
- **Route tabs** (division switcher on the night band, pricing groups): a small hue square + numeral + name; content cross-fades.
- **Comparison table** (pricing): the recommended column lifted on paper with an emerald top rule and "Recommended" set as part of the
  column header (no badge); phones show one column at a time with a package selector (IMG_5071).
- **Road strip** (process, project milestones): four to five segments, done / now (gold) / next.
- **Buttons**: solid, 7 px corners, emerald for the one primary action; outlined secondary; no pills, no knobs, no inset rings.
- Dropped at R2.5b: shield badges (read as gamification), coloured top stripes on cards, traffic-light window dots, mono outside figures.

**Raises kept from the declined catalog challengers** (the roll's six challengers were weighed against the build; all declined):
- Magazine identity program → *found landmark:* the division numeral in its hue is the wayfinding mark, never ornament.
- Depot destination blind → *whole-step motion:* state changes move in whole steps (tab thumb, table column swap), never drift.
- Darkroom safelight → *preview before commit:* the quote summary shows what will be sent before the form is submitted.
- Menhera pastel, brine calendar, multiplane cel → declined outright; *one-plane discipline* kept: no parallax, text always on the
  nearest plane.

Reviewer fixes applied before promotion: signs rebuilt as real plates (route shields, double border) without repeated arrows; the
third green band (workspace) moved to verge; the footer wordmark removed; the copied dot timeline replaced by the road strip;
"Most chosen" renamed **"Recommended"** (from the package's `most_popular` flag; no usage data is claimed).

## 4. Palette: "Zimbabwe earth" (multi-accent, BRIEF B.0b+, chosen at R2.5b)

The single-green "sign" palette from R1.5 was replaced by the owner's multi-accent rule. Three multi-accent palettes were rendered on
the same Route page (hero, services, pricing; 390 + 1440): **P1 Zimbabwe earth** (near-black + bone; emerald action; saffron, clay,
teal, moss), **P2 Creatix** (black + bone; lime action; coral, cyan, amber, mint), **P3 Dusk** (graphite + chalk; apricot action;
jade, butter, lagoon, rosewood). Board: `docs/screenshots/redesign/concepts/palettes-b2-board.webp`. A fresh reviewer and the author
agree on **P1**: emerald reads as money and trust and nods to the national colours without being literal; P2's lime-on-bone is the
young creative-agency look and fails as text; P3's apricot action competes with its own warm accents. Reviewer fixes applied:
six distinct division hues (no repeats), teal pulled greener, no shields or stripes, solid buttons, a crafted hero object.

**Strategy:** neutrals (night + bone) carry 80–90% of every screen; emerald appears only on the primary action; division hues appear
only as small marks (numerals, a hover rule, a 8 px swatch, chart series, tier rules); gold is the lit state on night.

| Token | Hex | Job |
|---|---|---|
| night-900 / 950 | #141412 / #0E0D0C | Dark surfaces: services band, footer, workspace chrome, admin sidebar |
| night-800 / 700 | #1F1E1B / #2C2A26 | Raised panels and hairlines on night |
| on-night / -2 / -3 | #F2EEE6 / #BDB6A9 / #9B9486 | Text on night (≥ 6:1) |
| bone-50 / 100 / 200 / 300 | #F2EEE6 / #E8E2D7 / #D9D1C3 / #C4BAA8 | Page ground, inset sections, hairlines |
| paper | #FBF9F5 | Cards, inputs, lifted table column |
| ink-900 / 700 / 500 | #141412 / #4E4A43 / #6B655B | Text on light (tertiary ≥ 4.9:1 on bone) |
| **emerald-500** (action) | #1E7A52 (hover #17643F) | **Reserved for the primary action**; links #17643F |
| gold-400 (lit) | #E3B04B | Active / current on night, focus ring on night, "now" in the road strip |
| saffron | #C98A17 (text #8A5C08) | Division 01 Websites; tier and chart series 1 |
| clay | #B84F35 (text #9A3F28) | Division 02 Apps; series 2; also the base for danger states |
| umber | #7C5A3A | Division 03 Business software (the brown of granite in shade); replaced teal here because teal read too close to the emerald action |
| teal | #1F8478 (text #16695F) | Data series 3 and workspace charts only (not a division colour) |
| moss | #6F8A2A (text #536A1C) | Division 04 AI & data; series 4 |
| msasa | #8E3B52 | Division 05 Automation & payments (the spring wine-red of msasa leaves); series 5 |
| granite | #7A7468 (text #5A554C) | Division 06 Cloud & IT; series 6 |
| status | ok #1E7A52 · warn #9C5B0A · danger #C9372C · info = ink | Always with an icon and words |

OKLCH: accents sit at L ≈ .47–.68, C ≈ .08–.14 (one family); every text use has an AA "-ink" variant; tested in
`tests/unit/ui-tokens.test.ts` (no blue/indigo/violet anywhere, AA pairs).

## 5. Type

- **Overpass** (variable, wght 100–900, self-hosted via `@fontsource-variable/overpass`): the open-source descendant of Highway
  Gothic, the lettering of road signs. Display and headings weight 700, tracking −0.025 to −0.03em, leading 1.05–1.1; UI labels
  600–700; body 400, leading 1.55.
- **Overpass Mono** (variable) for figures only: prices, amounts, references, dates in tables, route numerals. Tabular numerals.
- **Phone hard limits (BRIEF B.1a, 360–430 px, enforced by `tests/e2e/mobile-limits.spec.ts`):** H1 32 px (28–34), max 3 lines, a
  short mobile headline (≤ 7 words) when the desktop one is longer; H2 24 px (22–26); H3 18 px (17–20); body 16 px (15–16), leading
  1.55; meta 13 px; buttons 15–16 px on one line, ≥ 44 px tall; side padding 16 px; section spacing 56 px.
- Tablet / desktop: H1 clamp(40 → 62 px), H2 clamp(30 → 48 px), H3 20–24 px, body 17–18 px. No eyebrow labels above headings.
- Archivo and JetBrains Mono are removed with the old direction.

## 6. Grid, spacing, shape, elevation

- 4 px base. Section rhythm 72 px phones, 96 px tablet, 112 px desktop. 4 / 8 / 12 columns; 16 px side margins on phones, 32 px from
  768, 1320 px content max. Equal edges: every section shares the left edge.
- Radius: 4 px (inputs, small chips), **7 px** (buttons, tabs, plates), 10 px (cards), 14 px (the workspace window, sheets). No pills.
- Flat by default; a shadow ladder only for layered objects (the hero window and the card over it, menus, sheets, dialogs):
  `0 30px 60px -28px rgb(0 0 0 / .55), 0 10px 20px -12px rgb(0 0 0 / .3)` plus a 1 px hairline.

## 7. Icons

**Lucide** as the single family (`lucide-react` + the Astro `Icon` wrapper), stroke 2 at 20 px (sign weight), `currentColor`, sizes
16/20/24/32. Icons sit beside words; arrows only where an action leads somewhere new, never repeated on every row. Division numerals
are type, not icons.

## 8. Imagery art direction

- The hero object is the crafted workspace window (real product UI with fictional demo data, layered with depth), never a stock photo.
- Existing owner photos are reused in a **warm neutral duotone** (#151412 shadows → #F4F1EA highlights) for the division panels and
  editorial sections, never as the hero and never as "our team". New owner images (IMAGE-REQUESTS batch 2) follow the same grade:
  identifiably local places and hands at work in Harare daylight; they may later sit beside the workspace window, never under it.
- No gradients, glows, blobs, glass or 3D.

## 9. Motion principles (full spec: MOTION_AND_INTERACTION_SPEC.md)

Mechanical and certain: 120 ms press, 180 ms state, 240 ms enter, 320 ms panel swap; ease-out `cubic-bezier(.16,1,.3,1)` for
entering, no bounce. The hero window rises once and the invoice card follows 250 ms later; route plates rise 2 px on hover and gain
their division rule; tabs and table columns move in whole steps; division content cross-fades with an 8 px rise. Reduced motion: none.

## 10. Registers across the platform

- **Public (Persuade):** workspace-window hero, route index, route tabs, comparison table, road strip, solid buttons.
- **Client workspace (Operate):** the hero window made real: Linux-desktop clarity, a status bar, a dock of workspaces, window panes
  with title bars, a command palette; light (bone) by default, dark theme on night. Milestones use the road strip; division and data
  series use the earth hues.
- **Admin (Operate, utilitarian):** same tokens, denser, bone content, a night sidebar; no hero surfaces.

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
