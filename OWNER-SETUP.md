# Owner Setup: everything to do before the agent starts

Do these in order. About 60–90 minutes in total. When all **Required** steps are done, the agent can build without stopping.
**Never paste keys, tokens or passwords into a chat.** They only go into the settings pages named below.

---

## Step 1: GitHub repo (Required, 5 min)
1. github.com → **New repository** → name `kuzikode-platform` → **Private** → create it with a README.
2. Unzip the dev pack and upload **everything** to the repo root on `main`, including the hidden `.claude` folder
   (GitHub web: "Add file → Upload files" and drag the folder contents in; make sure `.claude/skills/pen-design/SKILL.md` is included).
3. **Do not** turn on branch protection for `main`. The agent pushes there directly.
4. Go to **claude.ai/connect-github**: connect your GitHub account and install the **Claude GitHub App** on `kuzikode-platform`
   (this gives the cloud agent permission to push).

## Step 2: Cloudflare (Required, 15 min)
1. dash.cloudflare.com: you already have an account (it holds `zimindex`; the agent won't touch it).
2. **Enable R2:** left menu → R2 → enable (a card is required, but the free tier costs $0).
3. **Copy your Account ID:** Account home or Workers & Pages → right sidebar → "Account ID".
4. **Create the API token:** top-right profile → **My Profile → API Tokens → Create Token** → start from the template
   **"Edit Cloudflare Workers"**, then **Add more** permissions so the list is:
   - Account → **Workers Scripts: Edit** · **Workers KV Storage: Edit** · **Workers R2 Storage: Edit** · **D1: Edit** ·
     **Queues: Edit** · **Workers AI: Edit** · **Workers Tail: Read** · **Account Settings: Read**
   - User → **User Details: Read** · **Memberships: Read** (included in the template)
   - Account Resources: *your account* · Zone Resources: *All zones* (needed later for kuzikode.com)
   → Create → **copy the token now** (it's shown once).
5. **Turnstile (spam protection):** left menu → Turnstile → Add widget → name "Kuzikode" → hostname `workers.dev` (add `kuzikode.com`
   later) → Managed → create → copy the **Site Key** and **Secret Key**.

## Step 3: Free service accounts (Recommended, 20 min). The agent builds without them, but tests more with them.
| Service | Where | What to copy |
|---|---|---|
| **Resend** (email) | resend.com → sign up → API Keys → Create (full access) | `RESEND_API_KEY` |
| **Paynow** (payments) | Register at paynow.co.zw/Customer/Register → add your bank account → **Other Ways To Get Paid** (paynow.co.zw/Home/Receive) → **Create/Manage Shopping Carts → Create Advanced Integration** → tick EcoCash, OneMoney, InnBucks, O'mari, Visa/Mastercard, Zimswitch → Save → **Email Key To Company Address** | Integration ID → `PAYNOW_USD_INTEGRATION_ID`, Integration Key → `PAYNOW_USD_INTEGRATION_KEY`, your Paynow login email → `PAYNOW_TEST_AUTHEMAIL` |
| **pen.dev** (mockups) | pen.dev → sign in → **Organization settings → Developer Keys** → Create key | `PEN_CLI_KEY` |
| **Claude subscription token** (pen.dev's designer runs on it, uses your Claude Pro plan, no API credit) | On your PC in cmd: `claude setup-token` → sign in with your Claude account in the browser → copy the token it prints | `PEN_CLAUDE_OAUTH_TOKEN` |
| *Optional:* OpenAI (better hero faces) | platform.openai.com → API keys | `OPENAI_API_KEY` |

## Step 4: GitHub Actions secrets (Required, 5 min)
Repo → **Settings → Secrets and variables → Actions → New repository secret**:
| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from Step 2.4 |
| `CLOUDFLARE_ACCOUNT_ID` | your Account ID |
| `BACKUP_ENCRYPTION_PASSPHRASE` | a long random passphrase you also save in your password manager (it decrypts your backups) |

Then **Settings → Environments → New environment** → name `production` → tick **Required reviewers** → add yourself.
(Production deploys then wait for your one click. Staging deploys automatically.)

## Step 5: Claude Code cloud environment (Required, 10 min). This is where the pen.dev key goes.
1. Open **claude.ai/code** → start a session → select the repo `kuzikode-platform`.
2. In the session's title bar, open the **cloud environment menu → Edit** (or create a new environment named "kuzikode").
3. **Network access:** choose **Full** (simplest: the agent needs npm, Cloudflare, Paynow, Resend, pen.dev, unpkg and docs sites).
   If you prefer *Limited*, keep "Allow package managers" ticked and add: `api.cloudflare.com`, `*.workers.dev`, `www.paynow.co.zw`, `developers.paynow.co.zw`,
   `api.pesepay.com`, `api.test.sandbox.pesepay.com`, `developers.pesepay.com`, `api.resend.com`, `challenges.cloudflare.com`, `*.pen.dev`, `pen.dev`,
   `api.anthropic.com`, `unpkg.com`, `cdn.jsdelivr.net`, `developers.cloudflare.com`, `docs.astro.build`, `github.com`.
4. **Environment variables.** Add one per line as `NAME=value`. If your app shows a **Network secrets** / **API credentials** section,
   still put these as environment variables, because the tools read them by these exact names:
   ```
   CLOUDFLARE_API_TOKEN=...
   CLOUDFLARE_ACCOUNT_ID=...
   TURNSTILE_SITE_KEY=...
   TURNSTILE_SECRET_KEY=...
   RESEND_API_KEY=...
   PAYNOW_USD_INTEGRATION_ID=...
   PAYNOW_USD_INTEGRATION_KEY=...
   PAYNOW_TEST_AUTHEMAIL=...      (your Paynow merchant login email)
   PEN_CLI_KEY=...
   PEN_CLAUDE_OAUTH_TOKEN=...   (from `claude setup-token`, uses your Claude Pro plan)
   OPENAI_API_KEY=...        (optional)
   ```
   **pen.dev key = `PEN_CLI_KEY` here**, together with `PEN_CLAUDE_OAUTH_TOKEN`. Leave out any you don't have yet and add them later.
   New sessions pick them up. The agent copies the right ones into Cloudflare Worker secrets itself.
5. **Setup script** (runs at the start of each session; it can't read the variables above, so it only installs tools):
   ```bash
   npm install -g @pen.dev/cli@0.3.14 || true
   ```
6. Save.

## Step 6: Fewer approval prompts (Recommended, 2 min)
1. When starting a session, set the mode dropdown next to the prompt box to **Auto** (or **Accept edits** if Auto isn't offered).
2. Optional: in the repo, create the file `.claude/settings.json` with this content and commit it, so common commands never ask:
   ```json
   {
     "permissions": {
       "allow": [
         "Bash(npm:*)", "Bash(npx:*)", "Bash(node:*)", "Bash(git:*)", "Bash(gh:*)", "Bash(pen:*)",
         "Bash(curl:*)", "Bash(openssl:*)", "WebFetch", "WebSearch"
       ]
     }
   }
   ```

## Step 7: Connectors (already done)
Figma ✓, Canva ✓, Cloudflare Developer Platform ✓, all connected on claude.ai. Nothing to do.

## Step 8: Start the build
1. New session on `kuzikode-platform`, mode **Auto**, environment from Step 5.
2. Paste the contents of **`KICKOFF_PROMPT.md`** and send.
3. **Keep it running unattended:** ask Claude in that session: *"Create a recurring scheduled task every 3 hours that starts a fresh session
   on this repo with the prompt in KICKOFF_PROMPT.md."* Each run resumes from `docs/PROGRESS.md`.

## While it builds (your only jobs)
- Glance at `docs/PROGRESS.md` and `docs/BLOCKERS.md` every day or two.
- When the staging site is up, open the one-time admin link the agent gives you and set your password.
- Later: review package prices (then switch on "Show prices"), register **kuzikode.com**, click **"Request to be Set Live"** in Paynow once the agent's test payments pass,
  pick Zoho or Google for client mailboxes, legal review of policies, Workers Paid ($5/month) before real payments,
  approve production deploys in GitHub Actions.

---

## Quick reference: every key and where it lives
| Key | Claude Code environment | GitHub Actions secrets | Set in Cloudflare by |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | ✓ | ✓ | n/a |
| `CLOUDFLARE_ACCOUNT_ID` | ✓ | ✓ | n/a |
| `BACKUP_ENCRYPTION_PASSPHRASE` | n/a | ✓ | n/a |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | ✓ | n/a | agent (var / secret) |
| `RESEND_API_KEY` | ✓ | n/a | agent (secret) |
| `PAYNOW_USD_INTEGRATION_ID` / `PAYNOW_USD_INTEGRATION_KEY` / `PAYNOW_TEST_AUTHEMAIL` | ✓ (test mode) | n/a | agent for staging. Live keys: same names after Paynow sets you live |
| `PEN_CLI_KEY` + `PEN_CLAUDE_OAUTH_TOKEN` | ✓ | n/a | n/a (mockups only) |
| `OPENAI_API_KEY` (optional) | ✓ | n/a | n/a (images only) |
| `HMAC_SECRET`, `DATA_ENCRYPTION_KEY` | n/a | n/a | agent generates and sets these itself |

## Files in the pack
`CLAUDE.md` (agent rules) · `KICKOFF_PROMPT.md` · `OWNER-SETUP.md` (this file) · `KANSO-NOTE.md` (snapshot) ·
`docs/01–13` (requirements, tech, architecture, database, design, payments, security, testing, deployment, roadmap with 98 tasks,
design tools, commercial features, imagery) · `docs/PROGRESS.md`, `DECISIONS.md`, `BLOCKERS.md` · `.claude/skills/pen-design/`.
