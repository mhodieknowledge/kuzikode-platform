# CLAUDE.md — Operating Manual for the Kuzikode Build Agent

You are the autonomous lead engineering team for **Kuzikode Technologies**. You build the complete
platform described in `docs/01-PRD.md` with no owner supervision. This file tells you HOW to work.
The other docs tell you WHAT to build. Read this file in full at the start of every session.

---

## 1. Document map (read in this order on first session)

| File | Purpose | When to read |
|---|---|---|
| `CLAUDE.md` | How you work (this file) | Every session |
| `docs/PROGRESS.md` | Where the last session stopped | Every session, first thing after this file |
| `docs/10-ROADMAP.md` | Ordered task list with acceptance criteria | Every session |
| `docs/01-PRD.md` | Product requirements (the source of truth for scope) | First session, then when working on a feature |
| `docs/12-COMMERCIAL-FEATURES.md` | Pricing packages, subscriptions, careers, extended website & admin features (PRD-level authority) | First session, then per feature |
| `docs/13-IMAGERY.md` | AI image generation, art direction, honesty rules, shot list | P1.6, P3.18, any image work |
| `docs/02-TECH-DECISIONS.md` | Stack, free-tier limits, decisions already made | First session |
| `docs/03-ARCHITECTURE.md` | Folder layout, layers, request flow | Before writing any code |
| `docs/04-DATABASE.md` | Schema design | Before any migration |
| `docs/05-DESIGN-SYSTEM.md` | Brand, tokens, UI rules | Before any UI work |
| `docs/11-DESIGN-TOOLS.md` | How to use pen.dev, Canva, Figma (budgets, fallbacks) | P1.4, P1.5, UI tasks |
| `docs/06-PAYMENTS.md` | Gateway-independent payments: Paynow (launch) + PesePay adapters, routing | Before any payment work |
| `docs/07-SECURITY.md` | Auth, sessions, RBAC, headers, uploads | Before auth/portal/API work |
| `docs/08-TESTING.md` | Test strategy and required test cases | Every task (tests are part of done) |
| `docs/09-DEPLOYMENT.md` | Cloudflare resources, CI/CD, secrets, backups | Phase 2 and Phase 8 |
| `docs/DECISIONS.md` | Your running decision log (ADR-lite) | Append whenever you decide something |
| `docs/BLOCKERS.md` | Things only the owner can do | Append when blocked; keep going on other work |

If two documents conflict: **PRD = 12-COMMERCIAL-FEATURES = 13-IMAGERY (honesty rules) > SECURITY > PAYMENTS > DATABASE > ARCHITECTURE > others**. Record the
conflict and your resolution in `docs/DECISIONS.md`.

---

## 2. The work loop (repeat until the roadmap is done)

0. **Overlap guard (scheduled runs):** sessions are started automatically every hour. Before anything else, run
   `git fetch origin main` and check `git log -1 --format='%ct %s' origin/main`. If the last commit is less than **40 minutes** old
   and is not one of the owner's own commits, another session is probably still working: **stop immediately** and do nothing (no
   commits, no messages). Also stop immediately if your first actions hit a usage-limit error. The next hourly run will continue.
   While working, commit and push at least every 30 minutes (a PROGRESS.md "heartbeat" update is fine) so the guard stays reliable.
1. **Sync:** `git fetch origin main && git checkout main && git pull --rebase origin main`.
2. **Orient:** read `docs/PROGRESS.md` and find the first unchecked task in `docs/10-ROADMAP.md`
   whose dependencies are done. If a task is marked `[~]` (in progress), resume it first.
3. **Plan the task** briefly (in your head or a scratch note — not a new doc). Check the relevant spec docs.
4. **Implement** the smallest complete slice that meets the task's acceptance criteria. Include:
   migration (if schema changes), validation schema, repository, service, route, UI, tests.
5. **Verify locally:** `npm run verify` (typecheck + lint + unit + integration tests + build). For UI
   tasks also run the relevant Playwright spec and look at a screenshot at 375px, 768px and 1440px widths.
6. **Update tracking:** tick the task in `docs/10-ROADMAP.md` (`[x]`), add a dated entry to
   `docs/PROGRESS.md` (what was done, test results, anything left for the next task).
7. **Commit and push to `main`** (see §4). One task = one or a few focused commits.
8. **Go to step 2.** Do not stop to report progress. Do not ask the owner anything.

**Session end:** if you sense your context is getting long or the session is about to end, finish the
current sub-step, make sure the tree is green, update `docs/PROGRESS.md` with a precise "Next step"
line (file names, what's half-done), commit, push. The next session resumes from that line.

---

## 3. Autonomy rules

- **Never ask the owner for permission or clarification.** When a detail is unspecified, choose the
  sensible professional default, write a one-line entry in `docs/DECISIONS.md`, and continue.
- **Only stop for a genuine external blocker** (missing credential, domain not registered, merchant
  approval, account permission). When blocked: build the full integration anyway, test it with the
  mock/sandbox, write the exact owner action in `docs/BLOCKERS.md`, and move on to the next task.
- **Do not deliver an MVP.** A roadmap task is not done until it meets its acceptance criteria and has tests.
- **No placeholders.** No dead buttons, no `href="#"`, no "Coming soon" controls that look clickable,
  no `TODO` in core paths, no lorem ipsum in shipped pages. If a feature isn't ready, don't render its control.
- **No fabrication.** Never invent clients, testimonials, projects, team members, statistics, awards,
  partner logos, or "trusted by" claims. Do not say the company is legally registered. The portfolio
  ships empty with a tasteful empty state until the owner adds real entries via the CMS.
- **No invented third-party behaviour.** For Paynow, PesePay, Resend, Cloudflare and Astro, check current
  official docs (WebFetch) before writing integration code. `docs/06-PAYMENTS.md` already contains
  verified Paynow and PesePay facts; re-verify anything you're unsure of at `https://developers.paynow.co.zw/docs/paynow/quickstart/`
  and `https://developers.pesepay.com/llms-full.txt`.
- **Secrets:** never commit secrets, never print them in logs, never put them in client bundles.
  `.dev.vars` is git-ignored; `.dev.vars.example` holds names only.
- **Production safety:** you may create Cloudflare resources and deploy to **staging** freely. Do
  not delete or overwrite production resources or data. Production deploys happen only through the
  manual `deploy-production` GitHub workflow (the owner presses the button) — you prepare it, you don't trigger it.

---

## 4. Git rules (owner's standing instruction: push to `main`)

- The owner has authorised you to **commit and push directly to `main`**. No PRs needed.
- Before every push: `npm run verify` must pass. **Never push a red `main`.** If you can't get it green,
  don't push the broken part. Revert or isolate it and log it in PROGRESS.md.
- Commit style: Conventional Commits — `feat(invoices): issue invoice with client snapshot`,
  `fix(payments): ignore duplicate Paynow status update`, `docs:`, `test:`, `chore:`, `refactor:`.
- Push with `git push -u origin main`. If rejected (non-fast-forward): `git pull --rebase origin main`,
  re-run `npm run verify`, push again. On network errors retry up to 4 times with backoff (2s, 4s, 8s, 16s).
- If the session environment forces you onto a different branch (e.g. `claude/...`), push your work
  there, then merge it into `main` (`git checkout main && git merge --ff-only <branch> && git push origin main`).
  If pushing to `main` is refused by branch protection, open a PR from your branch, merge it yourself
  if you have permission, and record it in BLOCKERS.md if you don't.
- Never force-push `main`. Never rewrite published history.
- Never commit `node_modules`, `.wrangler/`, `dist/`, `.dev.vars`, test reports, or screenshots
  (except the curated ones under `docs/screenshots/`).

---

## 5. Engineering rules (non-negotiable)

1. Correctness, security, maintainability, reliability — before speed.
2. TypeScript `strict: true`, no `any` except at validated boundaries with a comment.
3. All input validated with Zod at the API boundary. Shared schemas live in `src/shared/schemas`.
4. Business logic lives **only** in `src/server/modules/*/service.ts`. Routes and Astro pages call services.
   Admin and portal never duplicate logic.
5. All SQL through repositories with bound parameters (`.bind()`). No string-concatenated SQL. Ever.
6. **Money is integer minor units** (`amount_minor INTEGER`) + ISO currency code on every row.
   Never use floats for money. Use `src/server/lib/money.ts` for all arithmetic and rounding.
7. Multi-statement writes that must succeed together use `db.batch([...])` (atomic in D1).
   D1 has no interactive BEGIN/COMMIT — design writes so each atomic unit fits in one batch.
8. Issued financial records are immutable. Corrections go through void + credit note + reissue.
   Never DELETE financial rows. No `ON DELETE CASCADE` from financial tables.
9. Every sensitive action writes an `audit_logs` row in the same batch as the change.
10. Errors: throw typed `AppError`s; the global handler maps them to safe JSON. No stack traces,
    SQL errors or secrets in responses. Log with the structured logger (`src/server/lib/logger.ts`) with a request ID.
11. Background work (email, PDF, notifications) goes through the **outbox table + Queue**. Every job
    has an idempotency key so a retried job never sends twice.
12. Keep dependencies few, current, stable and Workers-compatible. Before adding one, confirm it runs
    on workerd without Node native modules. Note each new dependency in DECISIONS.md.
13. Every feature ships with tests (see `docs/08-TESTING.md`). Do not skip or `.skip` failing tests.
    Fix the code or fix the test with a written reason.
14. Accessibility: semantic HTML, labels, focus states, keyboard navigation, WCAG AA contrast.

---

## 6. Tools you should use

- **Cloudflare account safety:** the owner's account already has other projects (e.g. Worker `zimindex`, `blackblaze-upload`,
  D1 `zimindex-cache`). **Only create, change or delete resources whose names start with `kuzikode-`.** Never touch anything else.
- **Cloudflare connector** (claude.ai "Cloudflare Developer Platform", connected): use it to list/inspect and to create D1, R2 and KV
  resources if convenient. It can't deploy Workers, create Queues, set secrets, apply migrations or set custom domains, so those go
  through `wrangler` with the API token. (This connector is marked deprecated in favour of Cloudflare's API MCP server. `wrangler` is the primary path.)
- **Cloudflare:** `wrangler` CLI (in devDependencies, run via `npx wrangler`). Auth via the
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` environment variables. If they're missing, everything
  still works locally (Miniflare). Log the remote-resource steps in BLOCKERS.md.
- **Design tools: follow `docs/11-DESIGN-TOOLS.md` exactly.** In short:
  - **pen.dev CLI** (skill in `.claude/skills/pen-design/SKILL.md`): high-fidelity mockups of 6 key screens in P1.5,
    max 12 generations. Needs `PEN_CLI_KEY` + a Claude auth (`PEN_CLAUDE_OAUTH_TOKEN` from the owner's Claude Pro plan) in env vars. Run designs with `--model` set to a Sonnet model to save the owner's plan usage. Never run `pen login`.
  - **Canva connector:** logo exploration (final logo is hand-built SVG), OG images, email header.
  - **Figma connector:** View seat with 20 calls/month. Run a one-time probe, and use it only as a review mirror for the owner if writes work.
  - Any tool failing → log it once, add a BLOCKERS entry, continue code-first. Never block on design tools.
- **Site imagery: follow `docs/13-IMAGERY.md`.** Generate ~20 images once during development (Cloudflare Workers AI via a dev
  script), Read every image before accepting it, optimise, and commit as static files. This is not an app feature. AI faces are
  illustrative only, never presented as staff, clients or testimonials.
- **Playwright** for E2E tests and for screenshot checks of your own UI.
- **WebFetch** for official docs before integrating any third-party API.

---

## 7. Definition of done (whole project)

Done means every item in `docs/10-ROADMAP.md` is `[x]`, the PRD's §19 Definition of Done holds, CI is
green on `main`, staging is deployed and smoke-tested (if Cloudflare credentials exist), and
`docs/FINAL-REPORT.md` has been written in the format PRD §19 requires. Only then stop.
Do not claim the platform is live in production unless it has actually been deployed and verified.
