# Implementation plan (R1.2)

Engineering order, component inventory and reuse decisions. Stack: Astro 5 SSR + React islands + Tailwind 4 on Workers.

## 1. Tokens and styles (R2.1)
- `src/styles/tokens.css` → new CSS variables: felt, concrete, ink, cobalt, status, spacing, radius, shadow, z-index, motion, type
  scale (fluid `clamp`), and a `[data-theme="dark"]` override for the workspace.
- `src/styles/global.css` `@theme` → new Tailwind names (`felt-*`, `concrete-*`, `cobalt-*`, `font-display`, `font-mono`, `text-*`
  fluid sizes) **plus compatibility aliases**: `ink-950/800/600/400`, `line`, `surface`, `canvas`, `brand-600/500/50`, `dark-*`,
  status names map onto the new values. Untouched admin/portal markup therefore adopts the new palette immediately; rebuilt markup
  uses the new names. Aliases are removed in R8 once nothing references them (grep-checked).
- Fonts: add `@fontsource-variable/archivo` (wdth axis file) and `@fontsource-variable/jetbrains-mono`; remove Manrope and Inter
  packages. Preload the latin Archivo file in `BaseHead.astro`.

## 2. Primitives (R2.2–R2.3)
| Primitive | Where | Reuse vs rebuild |
|---|---|---|
| `Icon.astro` (public) + `lucide-react` (islands) | all | **Keep**, normalise sizes/stroke; add `label` prop → `aria-label` or `aria-hidden` |
| Button (`ui/Button.tsx` + new `Button.astro`) | all | **Rebuild** visuals: pill primary (cobalt, arrow knob), secondary (felt/ink outline), quiet, danger; sizes 40/48/52 |
| Input, Field, Choice, MoneyInput, FileUpload | forms, admin | **Restyle**: 16 px text, 48/52 px height, inline validation slot, grouped choice tiles |
| SegmentedControl (new, Astro + script; React twin for islands) | pricing, FAQ, division tabs, workspace | **New** |
| Tabs (new) | division sub-services, admin | **New** (roving tabindex) |
| Accordion (`<details>` based, new) | FAQ, pricing features, footer groups | **New** |
| Rail / carousel (new Astro + script) | packages, work, insights, home workspace | **New** (scroll-snap, buttons, dots, fade) |
| Sheet (new) | mobile menu, filters, compare | **New** (dialog element, focus trap, swipe-to-dismiss) |
| Dialog (`ui/Dialog.tsx`) | admin/portal | **Restyle** + bottom-sheet variant on phones |
| Toast (`ui/Toast.tsx`) | admin/portal | **Restyle** |
| Badge / StatusPill | all | **Restyle** to dot + label |
| DataTable (`ui/DataTable.tsx`) | admin | **Extend** with list-row mode < 768 px |
| Card (`ui/Card.tsx`) | admin | **Restyle**; public pages stop using generic cards |
| DirectoryRow / DirectoryBoard (new Astro) | home, services, mega-panel, mobile menu, industries, careers | **New**, the signature component |
| FloorIndicator (new) | pricing, long pages | **New** (segmented + scroll-spy) |
| SectionHeader (replaces `SectionHeading.astro`) | public | **Rebuild**: index label + title + optional intro right + link |

## 3. Shell (R3)
`SiteHeader.astro` (rebuild: desktop nav with indicator + mega-panels; mobile sheet), `SiteFooter.astro` (rebuild), `PublicLayout.astro`
(load motion module, header theme per page: `felt` or `concrete` start), `AnnouncementBar.astro` (restyle), `WhatsAppButton.astro`
(restyle as a compact round button above the bottom safe area; hidden when a sticky action bar is present).

## 4. Pages (R4) and their components
| Page | Components (new / rebuilt) |
|---|---|
| Home | `Hero` (rebuilt: felt, route list, desktop board), `DirectoryBoard`, `WorkspaceShowcase` (new, renders real portal UI fragments with fixture data), `Approach` (replaces Features/"Why"), `Process` (rebuilt timeline), `WorkGallery` (rebuilt rail), `ProductsGrid` (modest row), `TechnologiesStrip` (marquee), `CtaBand` (rebuilt) |
| Services | `DirectoryBoard` (expanded), division page sections: `SubServiceTabs`, `PackageRail`, `IncludedStrip`, `DeliveryBars`, FAQ accordion, `StickyActionBar` |
| Pricing | `FloorIndicator`, `PackageCard` (rebuilt), `PackageSelector` + rail, `CompareSheet` (phone) / `ComparisonTable` (rebuilt), add-ons list |
| Work | empty state panel, `WorkGrid` (rebuilt), case-study sections |
| About group | `Statement`, `Values` (directory list), `Process`, industries rows |
| Contact group | `ContactForm`, `StartProjectWizard`, `ConsultationForm` restyled through primitives; channel tiles |
| Rest | insights listing/cards, careers rows, FAQ, products, legal prose, search, 404/500 |
| Documents / checkout | `QuotationDocument`, `InvoiceDocument`, `CheckoutPage`, `CheckoutSummary` restyled |

Data access stays in `src/server/modules/*` services (no business logic in components). New derived values (division "from" price,
"included in every package") are computed by small pure helpers in `src/shared/` with unit tests, fed from the existing catalogue.

## 5. Panels (R5–R6)
`PortalLayout.astro` → workspace shell (status bar, dock, bottom dock on phones, theme toggle island, command palette island reused
from admin with portal-scoped results). `AdminLayout.astro` → felt sidebar + top bar. Restyle portal pages and admin modules through
primitives; list-row mode for tables.

## 6. Testing per task
- `npm run verify` + the affected e2e specs (full e2e before each push of a page group).
- Visual loop: `SHOOT=<pages> SHOOT_SET=core npx playwright test -c playwright.visual.config.ts` (all 10 viewports for major pages),
  read screenshots, fix, re-shoot; `SHOOT_REDUCED=1` once per component family.
- New tests: pricing accuracy (R4.3), helpers for derived pricing values (unit), mobile menu / segmented control / rail keyboard and
  touch behaviour (e2e), reduced-motion check (e2e).

## 7. Order of work and commits
R2.1 tokens+fonts → R2.2 icons → R2.3 primitives → R2.4 gallery → R3.1 header → R3.2 footer → R3.3 motion → R4.1 home → R4.2
services → R4.3 pricing → R4.4 work → R4.5 → R4.6 → R4.7 → R4.8 → R5.1–R5.4 → R6.1–R6.2 → R7 → R8. One task = one or a few
commits, each with verify green, pushed to `main`.
