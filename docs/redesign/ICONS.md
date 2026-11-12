# Icon system and placement audit (R2.2)

**Family:** Lucide (`lucide-react` 1.x), one family only. **Code:** `src/ui/icons/registry.ts` (meaning → glyph), `Icon.astro`
(server-rendered SVG, zero JS), `icon.tsx` (React islands). **Sizes / stroke:** 16 and 20 px at 1.75, 24 and 32 px at 1.5;
`currentColor`. **Accessibility:** decorative by default (`aria-hidden`); `label` makes it `role="img"` with `aria-label`; icon-only
controls carry their name on the control itself (`aria-label` on the button), never only on the SVG. **Placement rule:** an icon sits
beside text or is the whole of a control. Never alone in a tile above a heading (impeccable icon-tile-stack). Lucide 1.x ships no
brand logos: social links are text chips with `external` (no hand-drawn brand marks).

Tests: `tests/unit/ui-icons.test.ts` (CMS names, division/industry slugs, sizes).

## Where icons are required (built in the listed task)

| Area | Place | Icon(s) | Task |
|---|---|---|---|
| Header | Menu / close, search, mega-menu chevrons, external portal link | `menu`, `close`, `search`, `chevron-down`, `arrow-up-right` | R3.1 |
| Mobile menu | Division rows, contact channel tiles, portal | `div-*`, `whatsapp`, `phone`, `email`, `account` | R3.1 |
| Directory rows (home, services, mega-panel) | Division glyph beside the name; arrow knob | `div-*`, `arrow-right` | R3.1 / R4.1 |
| Buttons | Primary pill knob; download, pay, send, external | `arrow-right`, `download`, `pay`, `send`, `external` | R2.3 |
| Hero route list | Website / app or system / AI-automation / pay an invoice | `div-web`, `div-software`, `div-automation`, `pay` | R4.1 |
| Approach (why) | Claim markers inline with titles | `wallet`, `gauge`, `list-checks`, `life-buoy` (CMS) | R4.1 |
| Process timeline | Step nodes (numbers carry the order; icon beside the step title) | CMS icons | R4.1 / R4.5 |
| Division page | Sub-service tabs, benefits, deliverables lists, delivery bars | `check`, `hours`, `div-*` | R4.2 |
| Pricing | Included / not included rows, info explanations, compare, unit notes | `check`, `remove`, `status-info`, `filter` | R4.3 |
| Industries | Industry rows | `ind-*` | R4.5 |
| Contact | Channel tiles, location, hours, form success | `whatsapp`, `phone`, `email`, `location`, `hours`, `status-ok` | R4.6 |
| Forms | Field errors, success, file upload, date picker | `status-danger`, `status-ok`, `upload`, `calendar` | R2.3 / R4.6 |
| Footer | Contact channels, social chips, back to top | `whatsapp`, `phone`, `email`, `location`, `external`, `arrow-right` | R3.2 |
| Documents / checkout | Method tiles (EcoCash, OneMoney, InnBucks, card), status, download, print, lock | `wallet`, `pay`, `status-*`, `download`, `print`, `lock` | R4.8 |
| Workspace | Dock items, status bar (online/offline), notifications, theme, sign out, command palette, window title bars | `overview`, `projects`, `quotations`, `invoices`, `payments`, `services`, `support`, `account`, `online`, `offline`, `notifications`, `theme-*`, `sign-out`, `command` | R5 |
| Admin | Sidebar modules, row actions, filters, sort, status pills, empty states | `enquiries`, `leads`, `clients`, …, `audit`; `edit`, `delete`, `filter`, `sort`, `status-*` | R6 |
| Status pills (all) | Dot + label; warn/danger also an icon | `status-ok`, `status-warn`, `status-danger`, `status-pending` | R2.3 |
