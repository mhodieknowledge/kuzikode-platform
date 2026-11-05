# 08 — Testing Strategy

Tests are part of every task's definition of done. `npm run verify` must be green before every push.

## 1. Tooling & scripts (`package.json`)
| Script | Does |
|---|---|
| `npm run typecheck` | `astro check && tsc --noEmit` |
| `npm run lint` | ESLint + Prettier check |
| `npm run test:unit` | Vitest (node env) for pure modules: money, pricing, numbering formats, mappers, validators, permissions |
| `npm run test:integration` | Vitest with `@cloudflare/vitest-pool-workers`: real workerd, local D1 with migrations applied per test file, R2/KV/Queue bindings, Hono app via `SELF.fetch` |
| `npm run test:e2e` | Playwright against `wrangler dev` (built app) with a fresh local D1 seeded with base + dev seeds, mock payment + log email providers |
| `npm run test:sandbox` | PesePay sandbox suite. Runs only if sandbox secrets exist. Never in default CI |
| `npm run verify` | typecheck + lint + unit + integration + build |
| `npm run verify:full` | verify + e2e (CI runs this) |

Test helpers: `tests/helpers/factories.ts` (create client, staff with role, portal user linked to client,
quotation, issued invoice …), `loginAs(role)`, `portalLoginAs(client)`, fixed clock (`ctx.now`),
captured outbox/email inspector, mock provider controller.

## 2. Unit tests (minimum)
- **money/pricing:** minor-unit conversion for 0/2-digit currencies, rounding (half-even) edge cases, quantity_milli × price,
  line and document discounts (percent & amount, never below zero), tax exclusive/inclusive per line, totals equal the
  sum of rounded lines, currency mismatch throws, very large values stay within safe integer (assert < 2^53).
- **invoice balance:** partial payments, exact payment, overpayment → credit remainder, credit note reduces balance, void rules.
- **state machines:** invoice, quotation, payment attempt. Every allowed transition passes and every disallowed one throws.
- **numbering:** format rendering (`INV-{YYYY}-{SEQ:5}`), year rollover, uniqueness.
- **permissions:** role matrix resolves expected keys. Super admin has everything. The last super admin can't be removed.
- **validation:** each Zod schema accepts good input and rejects bad (lengths, emails, unknown keys).
- **PesePay:** encryption round-trip, mapper for every status in the table, amount minor ↔ major string.
- **sanitizer:** XSS payload corpus stripped. Allowed tags kept.

## 3. Integration tests (minimum)
Auth (login, wrong password, lockout, logout, session revoke, reset flow, invite flow, must-change-password),
client isolation (every portal resource type, IDOR → 404), admin permissions (each role vs representative endpoints),
DB ops (migrations apply from zero; FK and unique constraints enforced), invoice creation/issue (snapshot
frozen after client edit, number assigned once, **concurrent issue of 20 invoices → 20 unique sequential numbers**),
quotation accept via public token, **convert twice → same invoice** (also concurrently), payment initiation (status/currency/
balance validation), callback processing, **duplicate callbacks ×5 in parallel → exactly 1 payment**, callback lies
(claims success, status check says pending) → nothing applied, reconciliation cron applies a missed success, expiry
after 72 h, email queue (outbox row created in same batch, consumer sends once even if the message is delivered twice,
failure → retry → failed + DLQ + admin notification), document generation (PDF bytes start with `%PDF`, contain invoice
number + total text, stored in R2, second request served from R2), audit rows written for each sensitive action,
cache headers on private routes, contact form (Turnstile test keys, honeypot, rate limit).

Use Cloudflare Turnstile **test keys** in tests (always-pass / always-fail keys from Turnstile docs).

**docs/12 & 13 additions (integration):** package → quotation insertion copies prices (catalogue change later doesn't alter the quote),
show-prices switch hides prices; subscription billing cron runs twice on the same day → one invoice per period, auto-issue vs draft,
at-risk flag; asset renewal reminders sent once per window; careers: apply with CV (valid PDF accepted, renamed EXE rejected),
closed posting rejects applications, auto-close on closing date, JobPosting JSON-LD present only for open roles, retention job
anonymises and deletes the CV; wizard creates enquiry with brief JSON + "create quotation from brief"; newsletter double opt-in +
unsubscribe; testimonials can't be published without consent; time entries billed once (concurrent bill attempts); TOTP
enrolment, verify, replay rejected, backup code single-use, mandatory enrolment for super admin/finance.

## 4. End-to-end (Playwright) — `tests/e2e/full-journey.spec.ts`
One serial spec that walks the owner's 16 steps, using the mock provider and log email adapter:
1. Visitor submits enquiry on /contact → sees reference.
2. Admin logs in → enquiry visible with a notification → triages it into a lead → adds a note.
3. Admin converts the lead → client (or creates a client).
4. Admin creates a quotation with 3 lines + discount + tax → sends it → email captured with link.
5. Client opens `/q/:token` → downloads PDF → accepts.
6. Admin converts the quotation → invoice → issues it (a second convert click returns the same invoice).
7. Invoice email captured. It contains `/i/:token` and the portal link.
8. Admin invites the client contact → client accepts invite, sets password, logs into /portal.
9. Client views invoice → downloads PDF (`%PDF`, correct number).
10. Client clicks Pay now → mock hosted checkout → chooses **Partial** first (or pays part via manual record) then completes.
11. Callback processed → return page shows confirmation only after verification.
12. Invoice shows partially paid, then paid with correct balance.
13. Receipt PDF downloadable in portal.
14. Admin dashboard: revenue this month and recent payments reflect the amounts. Payments list shows the provider reference.
15. Admin creates a project from the quotation → adds milestone (client-visible) + update + deliverable file.
16. Client sees project progress, the update and downloads the deliverable.

Plus `tests/e2e/security.spec.ts`: client B can't open client A's invoice/project/file URLs (404),
staff Content Manager can't reach invoices, logged-out access redirects to login, and `/admin` is never indexed (meta + header).
Plus `tests/e2e/commercial.spec.ts`: visitor picks "Business Website" on /pricing → wizard prefilled → submits → admin creates a
quotation from the brief; admin posts a job → it appears on /careers → visitor applies with a CV → admin moves the applicant to
interview → email captured; admin creates a monthly subscription → cron produces exactly one invoice.
Plus `tests/e2e/public.spec.ts`: every nav link resolves 200, every service page renders, sitemap lists published
pages, robots disallows private paths, axe has no serious violations on all public pages, screenshots at 375/768/1440.

## 5. Non-functional checks (Phase 7)
- Lighthouse CI (`@lhci/cli`) on Home, Services, a Service page, Contact. Targets in PRD §10.
- Link checker over the built site (no 404s, no `#` hrefs).
- Migration check: apply all migrations to an empty DB in CI, plus `wrangler d1 migrations list` shows nothing pending.
- CPU sanity: `wrangler dev` + timing logs for login, invoice PDF, home SSR. Record results in PROGRESS.md and DECISIONS.md.
- Backup/restore drill (see deployment doc) executed against staging or local, with results recorded.

## 6. Rules
- No `.skip`, `.only`, or `test.fixme` on `main`. ESLint rule enforces it.
- A flaky test is a bug. Fix the cause (usually missing await or an unfixed clock).
- Tests never call real PesePay or Resend except the opt-in sandbox suite.
- Report real numbers (passed/failed/count, duration) in PROGRESS.md and FINAL-REPORT.md.
