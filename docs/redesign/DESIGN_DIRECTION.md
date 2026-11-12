# Design direction (R1.1)

Status: **committed 2026-11-12.** Top authority remains `BRIEF.md`; this file records the visual decisions that implement it.
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
office manager compares packages on a laptop. Daylight on phones forces **light reading surfaces**; the brand moments (hero, directory,
recommended package, CTA, footer) sit on a **deep felt-navy** field that also reads well outdoors because it is high-contrast, not glowing.

## 3. The world: "Directory"

**Thesis.** Kuzikode presents itself like the tenant directory in the lobby of a well-run modernist office building: a deep felt
board with crisp white letters in grooved rows, numbered by floor, a lit indicator showing where you are. It says "established,
organised, everything has its place and its number" without claiming history it doesn't have. It refuses the category default (dark
hero + stock team photo + a grid of identical icon cards).

**Grounded candidates, ordered by resonance** (audience: SMB owners and managers in Zimbabwe; cultural home: Harare's working city):
1. Engineering drawing set (cyanotype blueprint, title block, revision table): print/paper.
2. A Swiss-style corporate identity manual (strict grid, one colour, numbered pages): graphic tradition.
3. Mobile-money receipt / thermal till slip (mono numerals, perforation): commerce paper.
4. City wayfinding (green road signs, street-name plates, numbered exits): signage.
5. A phone's app screen and app-store listing: interface (tool family, rut-limited).
6. Great Zimbabwe dry-stone coursing (granite courses, chevron bands): stone / architecture.
7. **The lobby of a Harare modernist office tower: felt tenant directory with white snap-in letters, the lift's lit floor
   indicator, concrete brise-soleil fins: architecture + signage.** ← assigned by the roll, built.

**Challengers, fused and weighed** (audience identification · product clarity) → verdict → discipline kept as a raise:
- ASCII live scene → declined (both axes lose). *Raise, glyph-grid discipline:* every figure (price, reference, date, count) is set in
  one tabular mono on a strict baseline; numbers never sit in the display face.
- VU-meter bridge → declined. *Raise, identical-unit discipline:* repeated units (packages, directory rows, steps) share exactly the
  same anatomy so the row itself becomes the ruler you read across.
- Luminescent understory → declined. *Raise, reserved-brightness discipline:* cobalt is spent only on the active / focused / lit thing
  (current section, selected package, primary action); nothing decorative is cobalt.
- Ikebana / ma → declined. *Raise, charged emptiness:* asymmetric compositions with deliberate empty felt; no filler imagery to
  close gaps.
- Weimar cabaret bill → declined. *Raise, two-state discipline:* active states invert fully (row turns to felt with white letters,
  segmented thumb is solid); no wishy tints for state.
- eBoy pixorama → declined. *Raise, integer-step discipline:* spacing and sizes move in whole steps of a 4 px base; zoom-like
  transitions (mobile sheet, image swap) move in whole steps, never arbitrary values.

**Signature interaction: the directory.** Services (home + /services + mega-menu + mobile menu) are a numbered directory: `01 Web
development · 02 Mobile & desktop apps · …`, each row a groove line with condensed caps, a "from $X" price pulled from real package
data, and a round arrow knob. Hover (desktop) or tap (phone) lights the row: the row inverts, the knob fills cobalt, and on desktop a
fixed "lit frame" beside the board cross-fades to that division's image and sub-services. On phones the row expands in place to show
sub-services as chips and the CTA.

**Floor indicator.** Long pages (pricing, division pages, how we work) get a slim sticky indicator: a segmented control of numbered
"floors" (pricing categories, page sections) whose solid thumb slides to the current one (scroll-spy + tap to jump).

## 4. Palette (one direction chosen)

Candidates compared (from `/inspiration-images`): A periwinkle SaaS (#3557E0, 5013/5017/5070) · **B navy → electric cobalt (#070B14,
#1E4FB0, #1F6BFF; 5063/5067/5072)** · C neutral indigo (#5146E5; 5018/5060) · D black + lime (#0A0A0A, #A6F04A; 5054/5055/5065) ·
E deep green + mint (5056) · F monochrome + one accent (5066). **Chosen: B, held to F's restraint.** Blue is the most consistent
signal across the references and reads as "established technology"; lime and green read as fintech/startup; periwinkle and indigo are
the SaaS template default. Strategy: **Committed** (felt navy owns whole regions: hero, directory, recommended package, CTA, footer;
concrete-light grounds carry reading; cobalt is the single lit accent).

| Token | Hex | Use |
|---|---|---|
| felt-950 | #060B16 | Deepest felt, footer base |
| felt-900 | #0B1428 | The board: hero, directory, recommended card, panels' dark surface |
| felt-800 | #12203D | Raised felt (rows, cards on felt) |
| felt-700 | #1B2C52 | Groove lines and borders on felt |
| concrete-50 | #F3F5F8 | Page ground (light) |
| concrete-100 | #E8ECF2 | Secondary ground, inset sections |
| concrete-300 | #CBD3DF | Hairlines on light |
| paper | #FFFFFF | Cards, inputs |
| ink-900 | #0B1428 | Text on light (same as felt) |
| ink-600 | #4A5670 | Secondary text on light (≥ 7:1 on white) |
| ink-500 | #5E6A82 | Tertiary text (≥ 5:1 on white) |
| cobalt-600 | #1F44E0 | Primary action on light, links (≥ 6:1 on white) |
| cobalt-500 | #2F57FF | Lit state on felt (fills), focus ring |
| cobalt-300 | #93A8FF | Cobalt text on felt (≥ 7:1 on felt-900) |
| cobalt-50 | #EDF1FF | Selected tint on light (only with an inverted indicator) |
| status: ok #12875A · warn #9C5B0A · danger #C9372C · info = cobalt-600 | | Status only, with icons and text |

Existing tokens in `src/styles/tokens.css` (brand #2747e8, accent amber, Manrope/Inter) are **replaced**.

## 5. Type

- **Archivo** (variable, `wdth` 62–125 and `wght` 100–900, self-hosted via `@fontsource-variable/archivo`, latin subset ~90 KB) is the
  one family. Display: width 108, weight 640, tracking −0.025em, tight leading 0.98–1.05. Directory caps and eyebrows: width 72
  (condensed), weight 620, uppercase, tracking +0.06em. Body: width 100, weight 400, 17 px on phones / 18 px desktop, leading 1.55.
  UI labels: width 96, weight 560.
- **JetBrains Mono** (variable) for every figure (prices, references, dates in tables, counts), code-ish labels, the workspace status
  bar and terminal-flavoured details in panels. Tabular numerals everywhere.
- Fluid scale (mobile → 1440): display-xl clamp(2.6rem → 5.6rem), display clamp(2.1rem → 3.8rem), h2 clamp(1.7rem → 2.6rem), h3
  1.25 → 1.5rem, body 1.0625 → 1.125rem, small 0.9375rem, micro 0.8125rem (caps only).
- Manrope and Inter are removed.

## 6. Grid, spacing, shape, elevation

- 4 px base; spacing tokens 1,2,3,4,5,6,8,10,12,16,20,24,32 (× 4 px). Section rhythm: 64 px phones, 96 px tablet, 128 px desktop.
- Grid: 4 columns phones (16 px gutters, **16 px side margins**), 8 columns tablet (24 px), 12 columns desktop (24 px, 1240 px content max,
  wide 1440). Equal edges: every section shares the same left edge.
- Radius: 4 px (inputs, chips' inner), 10 px (cards), 16 px (inset sections on phones, sheets), 999 px (pills, knobs). No mixed radii
  inside one component.
- Elevation: flat by default; one shadow for floating layers (menus, sheets, dialogs): `0 12px 32px -8px rgb(6 11 22 / .28)`. Grooves
  (1 px felt-700 lines) replace card borders on felt.

## 7. Icons

**Lucide** (already a dependency, `lucide-react` + the Astro `Icon` wrapper) as the single family: 1.75 stroke at 20 px, 1.5 at 24 px,
`currentColor`, sizes 16/20/24/32. Icons sit beside text (never alone in a tile above a heading), every icon-only control has an
accessible name. R2.2 lists every place that needs one (nav, divisions, contact channels, actions, statuses, panel nav).

## 8. Imagery art direction

- Real product UI is the primary image: portal and document screens rendered from the real components with fictional demo data,
  labelled "illustrative" where a visitor could mistake it for a client.
- Existing photos are reused only in a **duotone** treatment (felt-900 shadows → concrete highlights, cobalt as the one colour accent),
  tight crops, never as the hero (IMG_5065 unification trick).
- New owner images (batch 1) are architectural and material: concrete fins in Harare light, a felt directory board detail, hands on a
  phone at a counter, a laptop on a desk in daylight. No AI people presented as staff or clients.
- Never decorative gradients, glows, grids or 3D blobs.

## 9. Motion principles (full spec: MOTION_AND_INTERACTION_SPEC.md)
Fast and mechanical, like a well-made lift: 120 ms (press), 180 ms (hover/state), 240 ms (enter), 320 ms (sheets / image swap);
ease-out `cubic-bezier(.2,.7,.2,1)` for entering, ease-in-out for moving, no bounce. Rows invert with a hard 120 ms colour cut;
the floor-indicator thumb slides; carousels cross-fade + 8 px slide; sections reveal once (8 px rise + fade, 60 ms stagger, max 4 items).
`prefers-reduced-motion`: all movement → opacity only or none.

## 10. Registers across the platform
- **Public (Persuade):** the Directory world at full commitment.
- **Client workspace (Operate):** same felt + concrete + cobalt, Linux-desktop clarity: a top status bar (mono), a side dock of
  workspaces, window-like panels with title bars, a command palette. Light by default with a dark (felt) theme.
- **Admin (Operate, utilitarian):** same tokens, denser, concrete-only (no felt hero surfaces), a sidebar in felt; distinct from the
  workspace by layout and density, related by type, colour and iconography.

## 11. Skills that shaped decisions
| Skill | Decision |
|---|---|
| impeccable (context, init, new-work, concept-seed, craft-floor, detect) | PRODUCT.md, the Directory world via the roll, raises, the audit findings |
| design-taste-frontend | One-system rule, real product UI as imagery, no shader effects, finish gate |
| emil-design-eng / animate / choreograph | Motion durations, curves, stagger limits, interruptible transitions |
| mobile-native / gestures / apple-design | Mobile sheet nav, swipe rails, safe areas, 44 px targets, 16 px inputs, no hover-dependence |
| web-design-guidelines | Audit checklist (focus, labels, contrast, forms) |
| vercel-composition-patterns / react-best-practices | Primitive APIs (compound Tabs / Segmented / Sheet), island boundaries |
| pick-ui-library | No new UI library: primitives are hand-built (Astro + small React islands) to keep bundles small |
