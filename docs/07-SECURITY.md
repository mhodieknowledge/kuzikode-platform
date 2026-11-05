# 07 — Security Specification

## 1. Passwords
- PBKDF2-HMAC-SHA256 via WebCrypto, **100,000 iterations** (Workers maximum), 16-byte random salt,
  32-byte output. Stored as `pbkdf2_sha256$100000$<salt_b64>$<hash_b64>` so parameters can be upgraded
  (rehash on login if the stored params are weaker). Compare in constant time.
- Policy: min 12 chars, check against a bundled top-10k common-password list, no composition rules.
- Never log passwords or hashes. Password change/reset revokes all other sessions and sends a security email.

## 2. Sessions & cookies
- Token: 32 random bytes (base64url) in the cookie. Only its SHA-256 goes in `sessions.token_hash`.
- Separate audiences and cookies: `__Host-kz_admin` (staff), `__Host-kz_portal` (clients).
  A staff session cannot be used on portal APIs and vice versa.
- Attributes: `HttpOnly; Secure; SameSite=Lax; Path=/`. In local dev (http) drop `Secure` and the
  `__Host-` prefix through config (`kz_admin_dev`).
- Lifetime: admin idle 2 h / absolute 12 h. Portal idle 24 h / absolute 30 days. `last_seen_at` is updated at
  most once per 5 min (limits D1 writes). Rotate the token on login and on privilege change.
- Logout deletes the cookie and sets `revoked_at`. Users can see and revoke their sessions. Admins can revoke anyone's.

## 3. CSRF, CORS, Origin
- All state-changing requests (POST/PUT/PATCH/DELETE) from cookie-authenticated contexts require
  (a) a matching `Origin` (or `Referer`) equal to `PUBLIC_SITE_URL`'s origin and (b) header
  `X-CSRF-Token` = HMAC(session.csrf_secret, session.id), delivered to the page in a `<meta>` tag.
  Astro form posts include it as a hidden field.
- Provider callbacks/webhooks are exempt from CSRF (no cookies) but have their own verification.
- CORS: none needed (same origin). Reject cross-origin API calls by default. No `Access-Control-Allow-Origin: *` on anything authenticated.

## 4. Rate limiting & abuse
D1-backed fixed-window counters (`rate_limits`). Use the Workers Rate Limiting binding instead if it's
available on the account's plan, and record the choice:
| Action | Limit |
|---|---|
| Login | 5 / 15 min per (email) and 20 / 15 min per IP; lock account 15 min after 10 consecutive failures; generic error message |
| Password reset request | 3 / hour per email, 10 / hour per IP; always respond "If an account exists…" |
| Contact form | 5 / hour per IP + Turnstile + honeypot |
| Public quotation/invoice token routes | 60 / min per IP |
| Payment initiate | 10 / hour per invoice |
| Payment status poll | 1 / 5 s per attempt |
Turnstile on login (after 3 failures), reset, contact, registration. Verify server-side with `TURNSTILE_SECRET_KEY`.

## 5. Authorisation (RBAC)
Permission keys (`src/shared/permissions.ts`), grouped by module, e.g.:
`dashboard.view, clients.view|create|update|archive, leads.view|manage, enquiries.view|manage,
services.manage, quotations.view|create|update|send|void, invoices.view|create|update|issue|void|send,
credit_notes.issue, payments.view|record_manual|reconcile|refund, projects.view|manage|view_all,
expenses.view|manage, cms.manage, media.manage, support.view|reply|manage, reports.view|export,
settings.view|manage, users.view|manage, roles.manage, audit.view|export, data.export`.

Default role matrix:
| Role | Permissions |
|---|---|
| Super Administrator | all (implicit). Only role that can manage roles, grant super_admin, change payment provider settings and numbering, and export all data. At least one must always exist (it can't remove itself if it's the last one). |
| Administrator | everything except `roles.manage`, granting super admin, payment provider settings |
| Finance Manager | dashboard, clients.view, quotations.*, invoices.*, credit_notes, payments.*, expenses.*, reports.*, audit.view (finance entities) |
| Project Manager | dashboard (non-financial tiles), clients.view, projects.* (own or `view_all`), support.*, quotations.view |
| Content Manager | cms.manage, media.manage, services.manage |
| Support Staff | enquiries.*, leads.view, clients.view, support.view/reply, projects.view (assigned) |
| Hiring Manager | dashboard (careers tiles), careers.view, careers.manage |

Additional permission keys (docs/12): `packages.manage, subscriptions.view|manage, client_assets.manage, careers.view|manage,
content.manage (insights, industries, FAQ, testimonials, technologies), newsletter.view|export, time.track, time.view_all, time.bill`. Administrator gets all of these. Finance Manager gets subscriptions.* + time.bill. Project Manager gets time.*.
Content Manager gets content.manage + packages.manage (prices still need `price_review` by an Administrator).

Enforcement: `requirePermission('invoices.issue')` middleware on every admin route, **plus** service-level
checks for ownership/state. The UI hides what the user can't do, but that's cosmetic: every check is on the server.
Role/permission changes are audited (before/after).

**Portal isolation:** `ctx.clientIds` = active `client_user_access` rows. Every portal repository
query includes `client_id IN (…)`. Resources not in scope → **404** (not 403). Files are served through
`/api/v1/portal/files/:id`, which checks the owning entity's client + `client_visible` flag.

## 5b. Two-factor authentication
TOTP (RFC 6238, 30 s step, 6 digits, ±1 step window, replay protection via `last_used_step`), QR provisioning URI,
10 backup codes (hashed, single-use). Mandatory for `super_admin` and `finance_manager` (enrolment is forced at next login).
Optional for other staff and portal users. Disabling 2FA requires the current password + a valid code. Admin reset of another user's 2FA is
super-admin only and audited. Secret encrypted at rest with AES-GCM using `DATA_ENCRYPTION_KEY` (Worker secret).

## 5c. Applicant & subscriber data
CVs are private R2 objects served only through `careers.view`-authorised routes. Retention job anonymises applications (name → "Erased",
contact fields nulled, CV deleted) after the retention period. Newsletter uses double opt-in plus one-click unsubscribe (signed token).

## 6. Public document links
`/q/:token`, `/i/:token`: 32-byte random token, only SHA-256 stored. Revocable (regenerate). Optional
expiry (quotation: valid_until + 30 days). `noindex`, `no-store`, rate-limited. They show the document and
the pay/accept actions only. No other client data, no navigation into the portal.

## 7. Input, output, files
- Zod on every input. Reject unknown keys (`.strict()`). Max lengths everywhere.
- SQL: bound parameters only. Dynamic `ORDER BY` from an allow-list map.
- XSS: Astro escapes by default. Never use `set:html` / `dangerouslySetInnerHTML` except for CMS rich text
  that has been sanitized on write with an allow-list sanitizer that works on Workers (e.g. a small
  allow-list built on `htmlparser2` or `ultrahtml`. Verify Workers compatibility). Also sanitize on render.
- Uploads: max 10 MB (images 5 MB). Allow-list by extension **and** magic bytes: PNG, JPEG, WebP, AVIF, PDF,
  DOCX/XLSX/PPTX (zip signature + content-type), ZIP for deliverables, TXT/CSV. No SVG uploads from users
  (XSS vector). Brand SVGs are committed files only. Random R2 keys, original names stored separately,
  `Content-Disposition: attachment` for non-images, `X-Content-Type-Options: nosniff`.
- PDFs and private files are streamed through authorised routes. R2 is never public, except an optional
  public media bucket path for published CMS images.

## 8. Headers (middleware, all responses)
`Strict-Transport-Security: max-age=63072000; includeSubDomains` (prod only),
`Content-Security-Policy` with nonces: `default-src 'self'; script-src 'self' 'nonce-…' https://challenges.cloudflare.com;
frame-src https://challenges.cloudflare.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline';
connect-src 'self'; form-action 'self' <pesepay checkout origin>; frame-ancestors 'none'; base-uri 'self'; object-src 'none'`
(adjust for Cloudflare Web Analytics if enabled), `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`,
`Cross-Origin-Opener-Policy: same-origin`, `X-Frame-Options: DENY`.

## 9. First administrator bootstrap
`npm run bootstrap:admin -- --env <local|staging|production> --email owner@… --name "…"`:
- The script (Node, run by the operator) refuses if any `super_admin` user already exists (checked via
  `wrangler d1 execute --remote --json`).
- It creates the user with **no usable password** (status `invited`), the `super_admin` role, an audit row
  (`actor_type='system'`), and a single-use `auth_tokens` row (purpose `invite_staff`, **expires in 24 h**), using
  `wrangler d1 execute --command` with the values escaped by the script.
- It prints a one-time set-password link (`<PUBLIC_SITE_URL>/admin/accept-invite?token=…`) to the terminal only.
  Never run it in CI, and never commit or log the link. If the agent runs it, it gives the link to the owner in the
  session chat. If the link expires unused, `--reissue` creates a new one, still only while no active super admin exists.
- There is no HTTP endpoint that can create the first admin. The `/admin` login page never offers registration.

## 10. Audit logging
Append-only `audit_logs` (DB trigger blocks UPDATE/DELETE). Required for: login success/failure,
logout-all, password change/reset, user invite/disable, role/permission changes, settings changes,
client archive, quotation send/accept/reject/void/convert, invoice issue/void/send, credit note issue,
payment record/apply/reverse/refund, manual reconcile, provider config change, data exports, file
downloads of financial docs by staff. Before/after JSON is redacted (no secrets, no password hashes, no tokens).

## 11. Errors & logging
Global error handler → safe JSON with `requestId`. Logs are structured JSON
(`level, msg, requestId, route, userId?, durationMs, err.code`), with secrets and PII redacted by a logger
filter. Enable Workers Logs/observability in wrangler config. Never log request bodies of auth or payment routes.

## 12. Security test list (must exist in tests)
IDOR across clients for every portal resource type (quotation, invoice, PDF, payment, receipt, project,
file, support request, message), staff role denial for each permission group, admin cookie rejected on
portal API and vice versa, CSRF missing/invalid → 403, foreign Origin → 403, rate limits trigger, login
lockout, password reset token single-use + expiry, invite token single-use, session revocation effective
immediately, upload with spoofed extension rejected, SVG rejected, XSS payload in CMS rich text stripped,
public token route doesn't expose other invoices, mock provider unreachable when `APP_ENV=production`,
security headers present, `no-store` on private routes.
