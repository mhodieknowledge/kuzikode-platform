# Progress Log

The agent appends a new entry at the top after every task, and always before a session ends.
The **Next step** line must be specific enough that a fresh session can continue without guessing.

## Current status
- Phase: 1 — inspection & planning
- Last completed task: P2.5 (P1.5 pen.dev runs in progress)
- **Next step:** P2.6 initial migrations (all docs/04 tables split into logical files, audit trigger, indexes) + constraint tests. Then review P1.5 mockups.
- Staging URL: — (workers.dev subdomain `mhodieknowledge`) · Figma file: https://www.figma.com/design/xB9rBVFa7BKitPiUqcYdhh (non-exempt calls this month: ~3/15) · CI status: —

---

## 2026-11-05 20:00 UTC — P2.5 money & pricing core
- Done: shared money (minor units, half-even BigInt mul/div, allocation, parsing/formatting) + pricing engine (lines, discounts, doc discount
  allocation, inclusive/exclusive tax). Server re-exports.
- Tests: unit 80 passed (money/pricing suites per docs/08 §2) / integration 7. verify green.
- Next step: P2.6.

## 2026-11-05 19:45 UTC — P2.4 config & core libs
- Done: config.ts (Zod, fail-closed), errors.ts (AppError + mapping), logger.ts (redaction), ids.ts, context.ts, security-headers.ts,
  Hono requestContext + apiHeaders middleware + global onError/notFound, Astro middleware (headers, private no-store/noindex, ctx in locals).
- Tests: unit 38 / integration 7 passed. Checked with wrangler dev: page + /admin headers correct.
- Next step: P2.5.

## 2026-11-05 19:30 UTC — P2.1–P2.3 scaffold, worker entry, wrangler config
- Done: Astro 7 SSR + Cloudflare adapter 14 + React 19 + Tailwind 4, TS 6 strictest, ESLint 9 (ts, astro, jsx-a11y, react-hooks, no-only-tests,
  no .skip/.fixme), Prettier, .gitignore, .nvmrc, .dev.vars.example, npm scripts. `src/worker.ts` → `createWorker()` (Hono for /api/*, Astro
  handler otherwise, queue + scheduled exported). wrangler.jsonc with local/staging/production envs, all bindings, placeholders for remote IDs.
  `npm run preview:worker` serves `/`, `/api/health`, static assets (checked with curl). Staging dry-run deploy lists all bindings.
- Tests: unit 1 passed / integration 4 passed (health, page routing, queue ack, scheduled). verify green.
- Next step: P2.4.

## 2026-11-05 18:55 UTC — P1.4 brand & tool probe
- Done: Canva logo exploration (1 candidate, chosen), hand-built `public/brand/logo.svg`, `logo-white.svg`, `logo-mark.svg`, `favicon.svg`;
  `public/favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-512.png`, `icon-512-maskable.png`. Figma probe succeeded (file + colour variables).
  pen.dev authenticated.
- Next step: P1.5.

## 2026-11-05 18:40 UTC — P1.1–P1.3 inspection, external facts, conventions
- Done: P1.1 repo inspected: docs + CLAUDE.md + owner notes + `.claude/skills/pen-design`, empty `design/` folders, no code, no tooling,
  no package.json. Node 22.23.4 / npm 10.9.9 in the container. Env has (names only) CLOUDFLARE_API_TOKEN/ACCOUNT_ID, PAYNOW_USD_*,
  PAYNOW_TEST_AUTHEMAIL, RESEND_API_KEY, TURNSTILE_SITE_KEY/SECRET_KEY, PEN_CLI_KEY, PEN_CLAUDE_OAUTH_TOKEN, OPENAI_API_KEY. Connectors
  (Figma, Canva, Cloudflare) present. P1.2 versions + deviations logged in DECISIONS.md (TS 6.0 pin, vitest-plugin rename, adapter v14
  custom entry, per-env builds). P1.3 `docs/CONVENTIONS.md` written.
- Tests: none yet (no code).
- Next step: P1.4.

<!-- Entry template
## YYYY-MM-DD HH:MM UTC — <task id> <title>
- Done: …
- Tests: unit X passed / integration Y passed / e2e Z passed (durations)
- Notes / decisions: … (also logged in DECISIONS.md)
- Next step: <task id> — <exact next action, files involved>
-->
