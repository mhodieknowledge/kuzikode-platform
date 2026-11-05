# 11 — Design Tools Playbook (pen.dev · Canva · Figma)

How the agent uses the design tools, in what order, and what to do when one isn't available.
**Code is the source of truth.** `docs/05-DESIGN-SYSTEM.md` tokens win over anything a tool generates.
Design tools produce *references and assets*. They never replace building and screenshot-checking the real UI.

Every tool is **optional**. If one fails (not installed, not authenticated, permission denied, rate-limited),
log it once in DECISIONS.md, add an owner action to BLOCKERS.md, and continue code-first. Never retry in a loop.

## 0. Which tool for what

| Need | Tool | Output lands in |
|---|---|---|
| High-fidelity mockups of key screens before coding | **pen.dev CLI** | `design/mockups/*.pen` + `*.png` |
| Logo exploration, OG/social images, email header, favicon source | **Canva** (MCP connector) | `design/brand/` (sources), `public/brand/` (final exports) |
| Shareable design-system file + review copies of the built screens | **Figma** (MCP connector) | Figma file link in PROGRESS.md |

Status of the owner's accounts (checked 2026-11-05):
- **Canva:** connector working. No Brand Kit (needs Canva Pro, not required). Free-plan AI generation credits are limited, so keep generations few.
- **Figma:** connector working. Account is on the **Starter plan with a View seat**. Figma's MCP rate limit for that seat
  is **20 tool calls per month**. Tools that write to files (`create_new_file`, `generate_figma_design`, …) are exempt from the limit,
  but a View seat may not have edit rights at all. See §3.
- **pen.dev:** needs `PEN_CLI_KEY` + `PEN_CLAUDE_OAUTH_TOKEN` (owner's Claude Pro plan) in the environment (§1). Until both are set, skip it.

---

## 1. pen.dev (skill: `.claude/skills/pen-design/SKILL.md`)

**Setup (once per session, only if you'll use it):**
```bash
which pen || npm install -g @pen.dev/cli@0.3.14   # pinned. Check `npm view @pen.dev/cli version` once and update the pin + skill file if newer
pen status                                         # must show the CLI key / org; if not authenticated → skip pen.dev
```
Unattended auth is **only** via environment variables (never run `pen login`/`pen signup`: they need the owner's email OTP):
- `PEN_CLI_KEY`: created by the owner at pen.dev → organization settings → Developer Keys.
- **Claude auth for pen.dev's designer agent, in this order of preference:**
  1. `PEN_CLAUDE_OAUTH_TOKEN`: a long-lived token the owner created with `claude setup-token`. It's stored under this name (not
     `CLAUDE_CODE_OAUTH_TOKEN`) so it never overrides the build session's own login. Pass it only to pen: 
     `CLAUDE_CODE_OAUTH_TOKEN="$PEN_CLAUDE_OAUTH_TOKEN" pen --agent claude --model <sonnet-model> …`. It runs on the owner's **Claude Pro
     subscription** (no API credit). pen.dev's skill says its agent needs "an authenticated Claude Code user … via env var or a user subscription".
     **Usage counts against the owner's Pro limits, which this build agent may also be using.** So always pass
     `--model` with a current Sonnet model (check `pen --list-models --agent claude`), keep to the 12-run budget, and stop pen.dev for the
     session if you hit a usage-limit error.
  2. `ANTHROPIC_API_KEY` (pay-as-you-go): only if the owner adds one later.
  3. Neither works → skip pen.dev and go code-first (docs/05 + Playwright screenshots). Log once in DECISIONS.md.
- First run check: `pen status` (pen.dev key OK?) then one small test design. If the Claude auth fails, record the exact error in BLOCKERS.md.

**Where pen.dev is used (budget: ≤ 12 generations for the whole project, run with a 10-minute timeout each):**
| Roadmap task | Screen | Iterations |
|---|---|---|
| P1.5 | Home page (desktop), Home page (mobile) | ≤ 2 each |
| P1.5 | Service division page | ≤ 1 |
| P1.5 | Admin dashboard, Invoice editor | ≤ 2 each |
| P1.5 | Client portal overview | ≤ 1 |

**How to prompt (Kuzikode adaptation of the skill's guidance):** the skill says to pass the user's request as-is. For this
project the "user's request" is the owner's design system, so pass a short brief **and attach the design doc** instead of inventing details:
```bash
pen --out design/mockups/home-desktop.pen \
    --prompt "Desktop home page for Kuzikode Technologies, a Zimbabwe-based technology company. Follow the attached design system and page brief exactly." \
    --prompt-file docs/05-DESIGN-SYSTEM.md \
    --prompt-file design/briefs/home.md \
    --export design/mockups/home-desktop.png --export-scale 2
```
- Write each brief (`design/briefs/<screen>.md`) from PRD content: real section list and real copy. No invented stats, clients, testimonials or people photos.
- After each run, **Read the PNG** and check it against docs/05: palette, type, spacing, no gradients/clutter, no fake content.
  If it drifts, iterate once with `--in … --out …-v2.pen --prompt "<specific correction>"`. Otherwise move on.
- Stock photos: pen.dev can pull Unsplash images. Allowed only for abstract/texture use. Never photos of people that could read as staff or clients.
- Commit `.pen` + `.png` files (they're small). Reference them in the relevant UI task in PROGRESS.md.
- The mockups are **guidance**: when coding, match the docs/05 tokens even where the mockup differs.

---

## 2. Canva (MCP connector)

Use only for brand/marketing assets. Keep the total number of AI generations small (free-plan credits).

| Task | Steps |
|---|---|
| **P1.4 Logo exploration** | `generate-design` (or `generate-image`) with a brief: "minimal geometric monogram 'K' for a technology company named kuzikode; lowercase wordmark; must read at 16 px; ink #0A0F1C + blue #2747E8; no gradients, no AI/robot/circuit clichés". Get ~3 candidates. `export-design` → PNG into `design/brand/logo-explorations/`. Read each, pick one, record why in DECISIONS.md. **Then hand-build the final logo as clean SVG in code** (`public/brand/logo.svg`, `logo-mark.svg`, `logo-white.svg`): Canva exports aren't clean vector marks. |
| **P3.10 Open Graph images** | One 1200×630 design per template (Home, Services division, Case study, Generic) with title text from the page and the brand mark. `export-design` PNG → `public/brand/og/`. If Canva credits run out, generate OG images at build time from an SVG template instead (also acceptable). |
| **P6.6 Email header** | 600×120 header banner → `public/brand/email-header.png` (also host it at a stable public URL for emails). |
| **Optional** | Social profile image (400×400) + cover (1500×500) for the owner's LinkedIn/X/Facebook, placed in `design/brand/social/`. |

Rules: always `user_intent` describing the Kuzikode task, export → download → commit the file (don't hot-link Canva URLs),
alt text for every image used on the site, no text-heavy images (put text in HTML).

---

## 3. Figma (MCP connector)

**Constraint:** View seat on Starter → at most **20 non-exempt calls/month**, and possibly no edit rights. Treat Figma as a
*review mirror for the owner*, not part of the build loop. Before any `use_figma` call, load the Figma skill
(`/figma-use`, or the MCP resource `skill://figma/figma-use/SKILL.md`). Before `generate_figma_design`, load `/figma-generate-design`.

**P1.4 capability probe (once):**
1. `whoami`, then `create_new_file` named "Kuzikode — Design System".
2. `create_session` with that file key, then one small write (create the colour variables from docs/05).
3. Success → record the file URL in PROGRESS.md and continue with §3 tasks below. Permission error → stop using Figma,
   add to BLOCKERS.md: *"Figma edits need a Full/Dev seat (Professional plan). Upgrade if you want the Figma design file. Optional."*

**If the probe succeeded:**
| Task | What | Approx. calls |
|---|---|---|
| P2.15 | Foundations page: colour/type/spacing variables + core components (Button, Input, Badge, Card, Table row, Nav) | writes (exempt) + ≤ 3 reads |
| After P3, P4, P5 | Push rendered pages into the file for review: Home, a service page, Admin dashboard, Invoice detail, Portal overview (code → design via `generate_figma_design`) | writes (exempt) |
| P8.6 | Final sync of key screens + post the link in FINAL-REPORT.md | writes (exempt) + ≤ 2 reads |

Keep a running count of non-exempt Figma calls in PROGRESS.md. Stop at 15/month to leave headroom for the owner.

---

## 4. Without any design tool
Use docs/05 directly. Build the `/dev/ui` kitchen-sink page early, then take Playwright screenshots at 375/768/1440 and
review them (Read the PNG) against docs/05 §8 before ticking any UI task. That visual QA gate is mandatory **with or without** design tools.
