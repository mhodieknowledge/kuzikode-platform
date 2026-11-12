# Motion and interaction spec (R1.2)

Principle: **a well-made lift.** Motion confirms a change of state and shows where something came from; it is quick, mechanical and
never bouncy. Skills: emil-design-eng, animate, choreograph, animation-performance, gestures, mobile-native, apple-design.

## 1. Tokens

| Token | Value | Use |
|---|---|---|
| `--dur-press` | 120 ms | Button / row press, colour cuts (two-state inversions) |
| `--dur-state` | 180 ms | Hover, focus, toggles, tab indicator |
| `--dur-enter` | 240 ms | Menus, popovers, reveals, toasts |
| `--dur-move` | 320 ms | Sheets, drawers, image swap, carousel slide |
| `--ease-out` | `cubic-bezier(.2,.7,.2,1)` | Entering, revealing |
| `--ease-in-out` | `cubic-bezier(.6,0,.2,1)` | Moving between positions (indicator thumb, carousel) |
| `--ease-in` | `cubic-bezier(.5,0,.75,0)` | Leaving (exits run at 70% of the enter duration) |
| `--stagger` | 50 ms | Group entrance, max 4 staggered items, then simultaneous |

Only `transform`, `opacity` and (for two-state cuts) `color`/`background-color` animate. No layout properties, no `filter: blur`
on large areas, `will-change` only during an active gesture.

## 2. Catalogue

| Element | Behaviour |
|---|---|
| Buttons | Press: scale .97 at 120 ms, release ease-out. Hover (hover devices): background shift 180 ms. Primary pill's arrow knob slides 2 px right on hover. Loading: label stays, spinner replaces the knob icon. |
| Directory row | Hover/focus (desktop) or tap (phone): row background cuts to felt-800 (light context) or cobalt-tinted felt (felt context) in 120 ms; arrow knob fills cobalt and rotates −45°; on desktop the lit frame cross-fades (opacity 0→1, 8 px rise, 240 ms; previous fades out at 160 ms). Phone expand: height via `grid-template-rows: 0fr→1fr` (240 ms) with content fade. |
| Nav indicator | 2 px bar under the active / hovered item; moves with `transform: translateX + scaleX`, 180 ms ease-in-out. |
| Mega-panel | Opens 240 ms: opacity + 8 px down; panel content staggers 3 groups at 50 ms. Hover intent delay 80 ms open / 160 ms close. Escape and outside click close. |
| Mobile menu sheet | Slides from top, 320 ms ease-out, backdrop fades 240 ms; rows stagger 4 × 40 ms; body scroll locked; focus trapped; closes on Escape, backdrop tap, or swipe up ≥ 64 px / velocity > 0.5. |
| Segmented control / tabs / floor selector | Solid thumb slides between options (`transform`, 180 ms ease-in-out); content cross-fades 180 ms with 6 px slide in the direction of travel. Arrow keys move selection (roving tabindex). |
| Carousels / rails | Native scroll-snap for swipes (finger 1:1). Button/dot navigation uses smooth scroll. Items entering the centre fade from .55 to 1 and the peeking items stay at .55 opacity on phones (opacity driven by IntersectionObserver ratio, not scroll handlers). Category change: outgoing items fade 160 ms, incoming fade + 8 px slide 240 ms (no hard swap). |
| Accordions | Height via grid rows 0fr→1fr, 240 ms; +/− icon rotates 90°→0. |
| Section reveal | Once per element, when 15% visible: opacity 0→1 + translateY 12→0, 240 ms ease-out; groups stagger ≤ 4 × 50 ms. Never on above-the-fold content after first paint. Content is visible without JS (reveal class added by JS only). |
| Hero entrance | Index line → headline (lines mask-rise 100%→0, 60 ms apart) → sentence → routes (stagger 4 × 50 ms). Total ≤ 600 ms. Desktop board: the lit row cycles 01→06 once (180 ms per row) then rests on 01. |
| Image swap (work, division frames) | Cross-fade 240 ms with 1.02→1 scale on the incoming image. |
| Toasts | Enter from bottom (phones) / top-right (desktop) 240 ms; auto-dismiss 5 s, pause on hover/focus; swipe to dismiss on touch. |
| Dialogs | Backdrop 180 ms; panel opacity + scale .98→1, 240 ms. Bottom sheet on phones (slide up 320 ms, drag handle, swipe down to dismiss). |
| Form validation | Error text fades in 180 ms under the field; field border cuts to danger; no shake. Success state: check icon draws (stroke-dashoffset 320 ms). |
| Floor indicator scroll-spy | Thumb follows the current section (IntersectionObserver), 180 ms. |
| Page transitions | Astro view transitions are **not** used for the public site (SSR pages with islands; keep navigation instant). The header and footer stay static; only the reveal system runs. |
| Workspace | Window panels: open 240 ms (opacity + scale .98); command palette 180 ms; status bar items update with a 120 ms colour cut; sidebar collapse 240 ms (width via transform on an inner wrapper). |

## 3. Reduced motion

`@media (prefers-reduced-motion: reduce)`: every transform-based movement is removed; state changes keep a ≤ 120 ms opacity/colour
change; reveal shows content immediately; marquees stop and wrap; rails keep scroll-snap but smooth scrolling becomes instant; hero
board does not cycle. Tested in the harness (`SHOOT_REDUCED=1`) and in e2e.

## 4. Implementation notes
- One small vanilla module (`src/scripts/motion.ts`) for reveal + scroll-spy, loaded once in PublicLayout (CSP-safe bundled script).
- Interactive components (directory, segmented control, rail, sheet) are **Astro components with a co-located `<script>`** (bundled by
  Astro, hashed for CSP) where no React state is needed; React islands only where existing forms and panels already are React.
- No animation library is added. CSS transitions + WAAPI where a sequence needs it.
