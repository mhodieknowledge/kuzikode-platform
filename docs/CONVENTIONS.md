# Coding Conventions

Applies to every file in this repo. Architecture and layering rules live in `docs/03-ARCHITECTURE.md`;
this file covers the day-to-day details. If they ever disagree, docs/03 wins and this file gets fixed.

## 1. Naming
| Thing | Convention | Example |
|---|---|---|
| Files (TS modules) | kebab-case | `credit-notes.ts`, `html-sanitize.ts` |
| Astro / React components | PascalCase file + export | `StatusBadge.tsx`, `PublicLayout.astro` |
| Functions, variables | camelCase, verbs for functions | `issueInvoice`, `nextNumber` |
| Types, interfaces, classes | PascalCase, no `I` prefix | `RequestContext`, `InvoiceRow` |
| Constants | UPPER_SNAKE only for true constants | `MAX_UPLOAD_BYTES` |
| DB tables / columns | snake_case, plural tables | `invoice_items.unit_price_minor` |
| Money fields | `*_minor` integers + `currency` | `total_minor`, `currency` |
| Quantities | `quantity_milli` (thousandths) | `1500` = 1.5 |
| Basis points | `*_bp` | `rate_bp = 1550` = 15.5% |
| IDs | prefixed sortable IDs from `ids.ts` | `inv_01JC…`, `cli_01JC…` |
| Human numbers | separate `number` / `reference` column | `INV-2026-00001` |
| Permission keys | `module.action` | `invoices.issue` |
| Audit actions | `entity.verb_past` | `invoice.issued`, `role.permission_granted` |
| Outbox job types | `domain.action` | `email.send`, `pdf.generate` |
| Env vars / secrets | UPPER_SNAKE | `PUBLIC_SITE_URL`, `HMAC_SECRET` |
| CSS custom properties | `--group-step` | `--ink-950`, `--brand-600` |

Row types mirror the table (`InvoiceRow`, snake_case keys as returned by D1). Services map rows to
camelCase DTOs defined by the Zod schemas in `src/shared/schemas`.

## 2. Module layout
Every business module in `src/server/modules/<name>/`:
```
index.ts        public surface: re-exports service functions + types only
routes.ts       Hono sub-router: validation (zValidator), coarse permission, calls service, maps to { data, meta }
service.ts      business rules, state machines, batches, audit + outbox. First arg is always ctx: RequestContext
repository.ts   SQL only. Bound params. Returns typed rows or D1PreparedStatements for batching
policies.ts     ownership / visibility checks (canViewInvoice(ctx, row) …)
```
- Modules import other modules only through `../<other>/index.ts`. Never another module's repository.
- `src/shared/**` never imports `src/server/**` or `cloudflare:*`.
- Astro pages call services directly via `Astro.locals.ctx`; React islands call `/api/v1/*`.
- Repositories expose statement builders (`insertInvoiceStmt(db, row)`) so a service can put several of them in one `db.batch()`.

## 3. Errors
Throw `AppError` subclasses from `src/server/lib/errors.ts`; the global handler maps them:
| Code | HTTP | Use |
|---|---|---|
| `VALIDATION_FAILED` | 422 | Zod failure or business validation; may carry `fields` |
| `UNAUTHENTICATED` | 401 | No/expired session |
| `FORBIDDEN` | 403 | Authenticated but lacks permission; CSRF/Origin failures |
| `NOT_FOUND` | 404 | Missing **or not visible to the caller** (no enumeration) |
| `CONFLICT` | 409 | State-machine violation, unique clash, stale optimistic update |
| `RATE_LIMITED` | 429 | Limits from docs/07 §4 (`Retry-After` header) |
| `PROVIDER_ERROR` | 502 | Gateway / email provider failure (safe message only) |
| `INTERNAL` | 500 | Anything unexpected; message is generic |

Response shapes: success `{ data, meta? }`; error `{ error: { code, message, fields? }, requestId }`.
Never put SQL, stack traces, secrets or provider payloads into an error message.

## 4. Code rules
- TypeScript `strict`, `noUncheckedIndexedAccess`. No `any` except at a validated boundary, with a `// boundary:` comment.
- Zod schemas use `.strict()` and max lengths. Export the inferred type next to the schema.
- Money only through `src/server/lib/money.ts` / `pricing.ts`. Never `parseFloat` a price. Never sum two currencies.
- Time only through `ctx.now()` (tests inject a clock). Store ISO-8601 UTC strings; business dates `YYYY-MM-DD`.
- Dynamic `ORDER BY` only from an allow-list map. No string-built SQL values, ever.
- Logs via `ctx.logger` (structured JSON, redacted). No `console.log` in `src/` except the logger itself.
- Comments explain *why*, not *what*. No commented-out code. No `TODO` in core paths.
- Prefer small pure functions. Keep Worker CPU in mind: no heavy work in request paths (PDFs go to the queue).

## 5. Tests
| Kind | Location | Runner | Name |
|---|---|---|---|
| Unit (pure) | `tests/unit/**/*.test.ts`, `packages/payments/test/**` | Vitest (node) | `<module>.test.ts` |
| Integration | `tests/integration/**/*.test.ts` | Vitest + `@cloudflare/vitest-plugin` (workerd, D1/R2/KV/Queues) | `<module>.<topic>.test.ts` |
| E2E | `tests/e2e/*.spec.ts` | Playwright against the built worker | `<journey>.spec.ts` |

- `describe('<unit under test>')` → `it('<does X> when <Y>')`. Behaviour, not implementation.
- Every bug fix gets a regression test. No `.skip` / `.only` / `fixme` on `main` (ESLint enforces).
- Factories in `tests/helpers/factories.ts`; never hand-write the same fixture twice.
- Fixed clock and deterministic IDs where assertions depend on them.

## 6. Git
Conventional Commits (`feat(scope): …`, `fix(…)`, `test(…)`, `docs: …`, `chore: …`, `refactor(…)`), imperative, ≤ 72 chars
subject. Scope = module name (`invoices`, `payments`, `auth`, `ui`, `cms` …) or `infra`. One roadmap task per commit or a few
focused commits. `npm run verify` green before every push.

## 7. UI
- Tokens from `src/styles/tokens.css` only; no raw hex in components.
- Every interactive element is a real `<button>` or `<a href>` with a working target. No `href="#"`.
- Each list/table screen has empty, loading and error states.
- Status shown with text + colour (StatusBadge), never colour alone.
- Copy follows PRD §1 copy rules (banned words list) and the honesty rules (no invented clients, stats or people).
