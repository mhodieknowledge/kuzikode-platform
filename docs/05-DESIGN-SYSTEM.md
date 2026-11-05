# 05 — Design System & UI Direction

Goal: the site of a credible, international-grade technology company. It must not look like a theme,
a template or a generic AI dashboard. Restraint, precision, strong typography and real content carry it.

## 1. Brand foundations

**Name treatment:** wordmark "kuzikode" in lowercase, set in the display face at semibold, with a
custom mark: a geometric monogram "K" built from two offset strokes that suggest a cursor/bracket
(`⟨` + `|`). Deliver as SVG (`public/brand/logo.svg`, `logo-mark.svg`, `logo-white.svg`) plus favicon
set (`favicon.svg`, 32px PNG, 180px apple-touch, 512px maskable). If Canva MCP is available, explore
3 directions there first and pick the one that holds up at 16 px. Otherwise draw the SVG by hand. Record
the choice in DECISIONS.md. The owner can replace the logo later through Settings.

**Tone:** precise, calm, confident. Short sentences. Concrete nouns. No hype.

## 2. Tokens (implement in `src/styles/tokens.css` as CSS variables + Tailwind v4 `@theme`)

### Colour
| Token | Light | Dark (public hero/footer, optional dark mode) | Use |
|---|---|---|---|
| `--ink-950` | `#0A0F1C` | | Primary text, dark sections |
| `--ink-800` | `#1C2333` | | Headings on light |
| `--ink-600` | `#475066` | | Secondary text |
| `--ink-400` | `#8A93A6` | | Muted text, placeholders (not for body copy, contrast) |
| `--line` | `#E4E7EE` | `#232B3D` | Borders, dividers |
| `--surface` | `#FFFFFF` | `#0E1424` | Cards, panels |
| `--canvas` | `#F7F8FA` | `#0A0F1C` | Page background |
| `--brand-600` | `#2747E8` | `#5B78FF` | Primary actions, links (AA on white) |
| `--brand-500` | `#3355FF` | | Hover / highlights |
| `--brand-50` | `#EEF1FF` | | Selected rows, subtle fills |
| `--accent-500` | `#E8A33D` | | Sparing accent: one per view at most (markers, key numbers). Never for text on white |
| `--success-600` | `#11845B` | | Paid, success |
| `--warning-600` | `#B25E09` | | Overdue soon, pending |
| `--danger-600` | `#C2362F` | | Overdue, failed, destructive |
| `--info-600` | `#2563B0` | | Info |

Rules: no rainbow gradients. At most one subtle radial glow or grid texture in the public hero.
Status colours always come with a text label (never colour alone).

### Typography (self-hosted via `@fontsource-variable/*`)
- **Display/headings:** *Manrope Variable* (600–800), tight tracking (−0.02em on ≥ 32 px).
- **Body/UI:** *Inter Variable* (400–600), `font-feature-settings: "cv11","ss01"`. Tabular numerals (`tnum`) on all money/number columns.
- **Mono:** *JetBrains Mono* for references (INV-2026-00012), code snippets.
- Scale (public): 14 / 16 / 18 / 20 / 24 / 32 / 40 / 56 / 72 (hero, clamp() fluid). Line-height 1.5 body, 1.1 display.
- Scale (app): 12 / 13 / 14 (base) / 16 / 20 / 24. Dense but readable.

### Space, radius, elevation, motion
- 4-px base grid: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- Radius: 6 (inputs, buttons), 10 (cards), 16 (feature panels). No pill-everything.
- Shadows: two levels only. `0 1px 2px rgb(10 15 28 / .06)` and `0 8px 24px rgb(10 15 28 / .08)`. Prefer borders.
- Motion: 150–200 ms ease-out for hover/focus, 250 ms for dialogs. Reveal-on-scroll is allowed only as a
  subtle fade/translate ≤ 8 px. Respect `prefers-reduced-motion`. No parallax, no auto-carousels.
- Layout: public content max-width 1200 px, prose 68ch. Admin fluid with 240 px sidebar (64 px collapsed).

## 3. Three related but distinct surfaces

| | Public site | Admin portal | Client portal |
|---|---|---|---|
| Feel | Editorial, spacious, confident | Productive, dense, quiet | Calm, reassuring, simple |
| Background | White + canvas bands, one dark (`ink-950`) section for contrast (hero or CTA) | `canvas` with white panels | White, generous spacing |
| Brand colour | Links, CTAs, small accents | Primary buttons, focus, active nav only | Primary buttons, progress |
| Type | Manrope display large | Inter 14 px base | Inter 15–16 px base |
| Navigation | Top nav + mobile sheet | Left sidebar grouped, collapsible, ⌘K search | Top nav with 5 items: Overview, Quotations, Invoices, Projects, Support |

## 4. Public page composition guidance
- **Hero:** left-aligned headline (≤ 10 words), 1–2 line subhead, two CTAs, and on the right an
  abstract, code-native visual (an SVG/CSS composition of interface fragments: a mini invoice card, an
  API response, a chart line). No stock photos of people. No "AI robot" imagery. No fake logos strip.
- **Services grid:** 6 cards, 3×2 on desktop. Each has an icon, name, one-line summary and a "Learn more" arrow link (real link).
- **Why Kuzikode:** 3–4 short, honest principles (e.g. "Built for local rails: EcoCash, ZIPIT, cards",
  "Fast on real networks", "Clear scope and fixed milestones", "Support after launch").
- **Process strip:** Discover → Design → Build → Launch → Support.
- Section rhythm: alternate white/canvas. Use one dark band. Vertical padding 96–128 px on desktop, 64 px on mobile.
- Images: real screenshots from portfolio entries only. Placeholders never ship.

## 5. App UI components (build in `src/components/ui` + `admin`)
Button (primary/secondary/ghost/danger, sizes sm/md, loading state), IconButton (with aria-label),
Input, Textarea, Select, Combobox (client/service pickers), DatePicker (native `type=date` styled),
MoneyInput (currency-aware, parses to minor units), Checkbox, Switch, RadioGroup, Field (label, hint,
error), Form (Zod-driven errors per field), Dialog, ConfirmDialog (destructive requires typing the
number for void/delete), Drawer, DropdownMenu, Tabs, Tooltip, Toast (success/error/info, aria-live),
Badge/StatusBadge (one mapping per entity status), Card, KpiTile, DataTable (server pagination,
sortable headers, column visibility, row selection where bulk actions exist, sticky header, skeleton
loading, empty state with a real primary action, error state with retry), FilterBar, Pagination,
SearchInput (debounced), EmptyState, Skeleton, Breadcrumbs, PageHeader (title + actions), Timeline
(activity/audit/payment events), LineItemEditor (add/reorder/remove rows, live totals using shared
pricing code), FileUpload (drag-drop, type/size feedback, progress), RichTextEditor (TipTap with a
minimal toolbar, output sanitized server-side), Chart wrappers.

Status badge mapping example (invoices): draft = neutral, issued = info, partially_paid = warning,
paid = success, overdue = danger, void = neutral strikethrough.

## 6. Accessibility checklist (every screen)
Landmarks (`header/nav/main/footer`), one `h1`, logical heading order, visible focus ring
(2 px `brand-500` + offset), skip link, labels for all inputs, error text linked via `aria-describedby`,
dialogs trap focus and restore it, tables have `<th scope>`, touch targets ≥ 44 px on mobile,
contrast AA (check with axe in Playwright), works with keyboard only, `lang="en"`.

## 7. Using design tools
See **`docs/11-DESIGN-TOOLS.md`** (pen.dev mockups, Canva brand assets, Figma review mirror, budgets and fallbacks).
These tokens stay the source of truth whatever a tool produces.

## 8. Visual QA gate (before ticking a UI task)
- Screenshot at 375, 768, 1440 px. No horizontal scroll, no overlapping text, no orphaned single words in headlines.
- Every button/link works (Playwright clicks each primary action).
- Empty, loading, error states exist and look intentional.
- axe-core: zero serious/critical violations.
- No lorem ipsum, no placeholder images, no `href="#"`.
