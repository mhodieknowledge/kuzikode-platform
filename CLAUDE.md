# CLAUDE.md — Operating Manual for the Kuzikode Build Agent

You are the autonomous lead engineering and design team for **Kuzikode Technologies**. The platform described in
`docs/01-PRD.md` is built (`docs/FINAL-REPORT.md`). **Current mission: the complete UI/UX reconstruction in
`docs/redesign/BRIEF.md`**, working through `docs/redesign/ROADMAP.md` with no owner supervision. This file tells you HOW to
work. Read this file and `docs/redesign/BRIEF.md` in full at the start of every session.

**Clean slate:** the UI/UX is rebuilt from scratch in a new component tree, never restyled. Only logic is reused (BRIEF B.0).

---

## 1. Document map (read in this order on first session)

| File | Purpose | When to read |
|---|---|---|
| `CLAUDE.md` | How you work (this file) | Every session |
| `docs/redesign/BRIEF.md` | **The redesign brief (top authority for all UI/UX)** + operating rules (Playwright loop, images, skills) | Every session |
| `docs/redesign/ROADMAP.md` | **Current task list** (R0–R8) with acceptance criteria | Every session |
| `docs/redesign/*.md` | Audit, direction, reference analysis, image traceability, specs, QA report (you create and maintain these) | Every session |
| `docs/redesign/IMAGE-REQUESTS.md` | Image prompts for the owner and their delivery status | Every session start (B.4) |
| `docs/PROGRESS.md` | Where the last session stopped | Every session, first thing after this file |
| `docs/10-ROADMAP.md` | The original build roadmap: **complete, history only** | When you need context |
| `docs/01-PRD.md` | Product requirements (the source of truth for scope) | First session, then when working on a feature |
| `docs/12-COMMERCIAL-FEATURES.md` | Pricing packages, subscriptions, careers, extended website & admin features (PRD-level authority) | First session, then per feature |
| `docs/02-TECH-DECISIONS.md` | Stack, free-tier limits, decisions already made | First session |
| `docs/03-ARCHITECTURE.md` | Folder layout, layers, request flow | Before writing any code |
| `docs/04-DATABASE.md` | Schema design | Before any migration |
| `docs/06-PAYMENTS.md` | Gateway-independent payments: Paynow (launch) + PesePay adapters, routing | Before any payment work |
| `docs/07-SECURITY.md` | Auth, sessions, RBAC, headers, uploads | Before auth/portal/API work |
| `docs/08-TESTING.md` | Test strategy and required test cases | Every task (tests are part of done) |
| `docs/09-DEPLOYMENT.md` | Cloudflare resources, CI/CD, secrets, backups | Phase 2 and Phase 8 |
| `docs/DECISIONS.md` | Your running decision log (ADR-lite) | Append whenever you decide something |
| `docs/BLOCKERS.md` | Things only the owner can do | Append when blocked; keep going on other work |

If two documents conflict: **for anything visual or interaction-related, `docs/redesign/BRIEF.md` wins** (the old design-system,
design-tools and imagery docs were deliberately removed; ignore any leftover visual instructions in older docs). **For functionality,
data, pricing and business rules: PRD = 12-COMMERCIAL-FEATURES > SECURITY > PAYMENTS > DATABASE > ARCHITECTURE > others.** Record the
conflict and your resolution in `docs/DECISIONS.md`.

---

## 2. The work loop (repeat until the roadmap is done)

0. **Session start checks (every build session, before anything else):**
   a. **Connector check (owner requirement: every build session has the connectors).** Use ToolSearch to confirm tools from
      **Figma**, **Canva** and **Cloudflare Developer Platform** are available (they can take a few seconds to connect, so retry
      for up to ~60 s). If any is still missing: append one dated line to `docs/BLOCKERS.md` ("session <id> started without <connector>"),
      commit + push that line only, set your session title to "Kuzikode redesign: STOPPED (missing connectors)", and **stop**. Don't build.
   b. **Overlap guard:** if your prompt says it's a **hand-off** or **owner's manual start**, skip this check. Otherwise run
      `git fetch origin main` and `git log -1 --format='%ct %s' origin/main`. If the last commit is less than **40 minutes** old,
      another session is probably working: **stop immediately** (no commits).
   c. Set your session title to `Kuzikode redesign: <YYYY-MM-DD HH:MM UTC>` (`set_session_title`) so the watchdog can see you.
   d. **Image delivery check:** look in `design/inbox/` and in R2 bucket `images` under `incoming/` (read only) for owner images; process new ones per BRIEF B.4.
   e. **Skills present:** confirm `.claude/skills/impeccable` and `.claude/skills/design-taste-frontend` exist (they're committed).
   While working, commit and push at least every 30 minutes (a PROGRESS.md heartbeat line is fine).
1. **Sync:** `git fetch origin main && git checkout main && git pull --rebase origin main`.
2. **Orient:** read `docs/PROGRESS.md` and find the first unchecked task in `docs/redesign/ROADMAP.md`
   whose dependencies are done. If a task is marked `[~]` (in progress), resume it first.
3. **Plan the task** briefly (in your head or a scratch note — not a new doc). Check the relevant spec docs.
4. **Implement** the smallest complete slice that meets the task's acceptance criteria. Include:
   migration (if schema changes), validation schema, repository, service, route, UI, tests.
5. **Verify locally:** `npm run verify` (typecheck + lint + unit + integration tests + build) and the e2e suite. **For every UI change,
   run the Playwright visual loop (BRIEF B.2): screenshots at the phone, tablet and desktop sizes, Read them, fix what's wrong,
   re-shoot until clean. Mobile first: more than 75% of visitors are on phones, and desktop must still be flawless.**
6. **Update tracking:** tick the task in `docs/redesign/ROADMAP.md` (`[x]`), add a dated entry to
   `docs/PROGRESS.md` (what was done, test results, anything left for the next task).
7. **Commit and push to `main`** (see §4). One task = one or a few focused commits.
8. **Go to step 2.** Do not stop to report progress. Do not ask the owner anything.

**Session end:** if you sense your context is getting long or the session is about to end, finish the
current sub-step, make sure the tree is green, update `docs/PROGRESS.md` with a precise "Next step"
line (file names, what's half-done), commit, push. The next session resumes from that line.

**Hand-off (keeps the build going, with connectors):** after that final push, start **exactly one** successor session with
`create_session` (from the claude-code-remote tools): `source_url` = `https://github.com/mhodieknowledge/kuzikode-platform`,
`permission_mode` = `auto`, `environment_id` = `env_019Mujw8AsLq9GtkNZSgMFCH` (the owner's "kuzikode" environment with all keys; always this one), `title` = `Kuzikode redesign: <YYYY-MM-DD HH:MM UTC>`, and `prompt` =
`"Hand-off from session <your session id>: skip the overlap guard (CLAUDE.md §2 step 0b)."` followed by the full text of
`KICKOFF_PROMPT.md`. Then rename yourself `Kuzikode redesign: finished (handed off)` and stop. Never start more than one successor. If `create_session` fails (for example the session-chain depth limit), just stop after your final push: the
hourly watchdog starts a fresh session within an hour.
Don't hand off if the redesign roadmap is complete. Instead write `docs/redesign/REDESIGN-REPORT.md`, rename yourself `Kuzikode redesign: DONE` and stop.

**Usage limit reached:** don't hand off (the new session would hit the same limit). Push what's green, rename yourself
`Kuzikode redesign: paused until <time UTC>` (now + 60 min), and use `send_later` (delay 60 min) to message yourself:
"Usage window should have reset: continue the work loop from docs/PROGRESS.md." You keep your connectors because you're the same session.
If you're still limited when you wake, repeat (up to 6 times, then hand off).

**Watchdog:** an hourly scheduled task checks that a build session is alive and starts one if not. It never builds.
Leave it alone.

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
- **Design skills (committed in `.claude/skills/`): use them, see BRIEF B.3.** Start each design phase with `impeccable`; apply
  `design-taste-frontend` rules and its browser finish gate; use the emilkowalski skills for motion, gestures and mobile-native polish;
  `web-design-guidelines` for audits; the Vercel React skills for component architecture (ignore Next.js/Vercel-hosting specifics).
  Subagents: `.claude/agents/impeccable-*` plus the Agent tool for parallel work (BRIEF B.5).
- **Design connectors:** Figma, Canva (optional; never block on them). pen.dev (`pen-design` skill) is optional for mockups.
- **Images:** never generate placeholders. Request images from the owner via `docs/redesign/IMAGE-REQUESTS.md` and keep building
  (BRIEF B.4). AI-generated people are illustrative only, never staff, clients or testimonials.
- **Playwright** for E2E tests **and for the mandatory visual loop on every UI change** (BRIEF B.2: 10 viewports, Read every screenshot, fix, repeat).
- **WebFetch** for official docs before integrating any third-party API.

---

## 7. Definition of done (current mission)

Done means every item in `docs/redesign/ROADMAP.md` is `[x]` (or `[!]` blocked by the owner), BRIEF §18 holds, the full test suite is
green on `main`, staging is redeployed and smoke-tested, and `docs/redesign/REDESIGN-REPORT.md` is written. Only then stop.
Never deploy production yourself.
