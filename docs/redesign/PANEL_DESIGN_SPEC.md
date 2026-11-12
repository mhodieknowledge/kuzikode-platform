# Panel design spec: client workspace and admin (R1.2)

BRIEF §11: a refined, Linux-desktop-inspired panel language: clean window and workspace layouts, organised side navigation,
terminal-flavoured type where it helps, subtle system-status indicators, functional density, consistent window / panel / navigation
patterns, light and dark surfaces. **Not** an OS clone, a terminal cosplay, a hacker theme or retro. Same tokens as the public site
(DESIGN_DIRECTION.md): felt navy, concrete, cobalt, Archivo, JetBrains Mono, Lucide.

The two panels are **related but distinct**:

| | Client workspace (`/portal`) | Admin (`/admin`) |
|---|---|---|
| Who | Clients | Kuzikode staff |
| Feel | Calm workspace, GNOME-like clarity: few, large, well-spaced windows | Utilitarian operations console, KDE-like density: more columns, compact rows |
| Chrome | Light concrete desktop, felt **top status bar**, left **dock** of workspaces (icons + labels), windows with title bars | Felt **sidebar** (grouped modules), concrete top bar with search + bell + user, content as panes without window title bars |
| Density | Comfortable (row 56 px, body 16 px) | Compact (row 44 px, body 15 px, mono figures 14 px) |
| Theme | Light default + **dark (felt) theme** toggle, remembered per device | Light only (dark later if wanted) |
| Command palette | Yes (⌘K / Ctrl K): jump to project, invoice, quotation, page, action | Already exists (CommandPalette.tsx): restyled |

## 1. Shared building blocks
- **Status bar** (workspace) / **top bar** (admin): 40 px, mono 13 px. Workspace left: wordmark + current workspace name; centre:
  connection indicator ("● online" in ok green, "offline" when `navigator.onLine` is false); right: notifications, theme toggle,
  account menu. Never fake system metrics (no CPU / memory theatre).
- **Window** (workspace only): 10 px radius panel with a 40 px title bar (icon + title + optional mono meta like `INV-2026-00012`),
  title-bar actions on the right (icon buttons with labels on hover/focus). Body padding 20 px (desktop) / 16 px (phone). Windows tile
  in a 12-column grid; no dragging (decorative OS behaviour adds nothing).
- **Pane** (admin): section with a header row (title + actions) and a groove, no title-bar chrome.
- **Status pills**: dot + label, colour from status tokens, mono label for references; every status has a text label (not colour only).
- **Data rows**: on ≥ 1024 px tables with sticky header, mono numeric columns right-aligned, row hover cut to concrete-100; on < 768 px
  each row becomes a **list row**: primary line (name / number), secondary meta line, amount + status on the right, chevron; filters
  move into a bottom sheet with an "Apply" bar.
- **Empty states**: a short mono line ("no invoices yet") + sentence + action, inside the window. Never an illustration.
- **Keyboard**: every window / pane reachable by Tab; `g` then letter shortcuts are not added (discoverability) except ⌘K.
- **Terminal accent, sparingly**: a mono prompt-style label for references (`$ INV-2026-00012`), mono timestamps in activity feeds.
  Nowhere else.

## 2. Client workspace layout

**Desktop (≥ 1024):** status bar (felt, full width) → dock (72 px rail, icon + 11 px label under each: Overview, Projects, Quotations,
Invoices, Payments, Services, Support; Account at the bottom) → desktop area (concrete-50) with windows.
- **Overview:** a "Balance" window (outstanding per currency in large mono, open/overdue counts, Pay now), "Waiting for you"
  window (quotations to answer, invoices due), "Active projects" window (milestone progress as segmented bars, next milestone), and
  "Activity" window (mono timestamps). Windows arranged 8/4 then 6/6.
- **Projects:** list window (left 4 cols) + project window (right 8): milestones as a vertical track, updates feed, deliverables
  list, messages composer.
- **Quotations / Invoices / Payments:** list + detail windows; documents render inside a window as a paper sheet; actions (accept,
  pay, download PDF) in the title bar and repeated at the bottom on phones.
- **Services (subscriptions, managed services, saved cards):** cards-as-windows per service with status and renewal date.
- **Support:** ticket list + conversation window.
- **Account:** profile, security (password, 2FA, sessions/devices) as stacked windows.

**Tablet (640–1023):** dock collapses to icons only (with tooltips + accessible names); windows stack 1 column with 2-up where content
is small.

**Phone (< 640):** status bar slims to 48 px (wordmark, online dot, notifications, account); a **bottom dock** (5 items: Overview,
Projects, Invoices, Support, More) with safe-area padding; "More" opens a sheet with Quotations, Payments, Services, Account, theme.
Windows become full-width panels with title bars kept (16 px radius insets), detail views slide over the list (320 ms) with a back
button in the title bar. Primary actions (Pay, Accept) sit in a sticky bottom action bar above the dock.

**Dark theme:** felt-900 desktop, felt-800 windows, felt-700 grooves, cobalt-300 links, status colours lifted for ≥ 4.5:1.

## 3. Admin layout

**Desktop:** felt sidebar 248 px (groups: Overview · Sales · Finance · Delivery · Website · Administration, condensed caps group
labels, 40 px rows with icons, active row inverted cobalt), collapsible to 64 px icons; concrete top bar (search / ⌘K, notifications,
user); content max 1440 with panes. Dashboard: KPI strip as a single grooved row of figures (mono) instead of 10 cards; charts in panes.
**Tablet:** sidebar collapsed by default. **Phone:** top bar with menu button; sidebar becomes a left sheet; lists use the list-row
pattern; forms single column with sticky save bar.

## 4. Auth screens (both)
Split layout (IMG_5017): felt panel left (wordmark, one line on what the workspace / admin is, and for the workspace three small
step cards: invitation → password → workspace), form right on paper. Phone: felt band header 160 px with wordmark + title, form
below. Workspace and admin auth differ by the panel copy and a "Staff sign-in" label on admin; the admin panel is plain felt with no
marketing copy.

## 5. What must not change
Every route, form field, permission check, API call and test hook (`data-*`, accessible names used by e2e). Restyling happens in
layouts (`PortalLayout.astro`, `AdminLayout.astro`, `AuthLayout.astro`), shared UI primitives (`src/components/ui/*`) and page-level
markup only. Where an e2e test pins a visible label that changes, the test is updated in the same commit with the reason.
