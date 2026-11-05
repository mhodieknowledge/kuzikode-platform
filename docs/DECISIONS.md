# Decision Log

One line per decision (newest at the bottom). Format:
`YYYY-MM-DD · <area> · <decision> · <why> · <alternatives rejected>`

## Pre-made decisions (from the planning stage)
- 2026-11-05 · database · Cloudflare D1, not MongoDB · relational integrity for finance, native binding, free 5 GB · MongoDB Atlas M0, Turso
- 2026-11-05 · email · Resend behind an EmailProvider interface · free 3k/month, good API, idempotency keys · SMTP (not possible from Workers), SES (needs AWS account)
- 2026-11-05 · pdf · pdf-lib, generated in background, stored in R2, never regenerated once issued · pure JS, Workers-compatible · Puppeteer/Browser Rendering
- 2026-11-05 · jobs · D1 outbox + Cloudflare Queues + cron sweep · Queues free since Feb 2026 but 24h retention; outbox makes it durable · Queues alone
- 2026-11-05 · hashing · PBKDF2-SHA256 100k iterations (WebCrypto) · fastest secure option under the Workers CPU limits · argon2/bcrypt WASM (CPU heavy)
- 2026-11-05 · numbering · numbers assigned at issue/send, not at draft · avoids gaps from deleted drafts
- 2026-11-05 · payments · gateway-independent design: @kuzikode/payments adapters + DB accounts/routes per app/currency/method; Paynow is the launch gateway, PesePay a fully built alternative · owner chose Paynow but wants to switch gateways without code changes · hard-wiring one gateway
- 2026-11-05 · payments-verification · every callback confirmed by polling the gateway before applying; Paynow SHA-512 hash validated both ways; reconciliation cron · return URLs and callbacks alone are never proof
- 2026-11-05 · tax · VAT seeded inactive · owner must confirm ZIMRA registration and current rate
- 2026-11-05 · deploys · main → staging auto; production manual workflow with owner approval · safety for real financial data
- 2026-11-05 · design-tools · pen.dev for mockups, Canva for brand assets, Figma as optional review mirror (View seat, 20 calls/month) · see docs/11 · Figma as primary design source (seat too limited)
- 2026-11-05 · pricing · priced packages seeded with suggested USD prices, hidden in production until owner review · owner asked for plans with prices; prices are a business decision · leaving pricing blank
- 2026-11-05 · email-product · Zoho Mail Lite as default cost basis for bundled mailboxes; Google Workspace as upgrade · ~$1 vs ~$7 per user/month · bundling Workspace in all plans
- 2026-11-05 · imagery · ~20 AI images (people, faces, scenes, objects) generated ONCE during development via Workers AI and committed as static files; no in-app generator · owner wants a polished look like cassavatechnologies.com · runtime image-generation feature (not wanted)
- 2026-11-05 · imagery-ethics · AI-generated people are illustrative only, never staff/clients/testimonials · honesty rule from the PRD
- 2026-11-05 · package-sales · packages lead to the wizard/quotation, no direct checkout · scope must be confirmed before work; invoices are paid online
- 2026-11-05 · payments-packaging · gateway code in reusable workspace package `packages/payments` (@kuzikode/payments), extractable to its own repo via git subtree · reuse later without multi-repo overhead now · separate repo from day one
- 2026-11-05 · checkout · custom Kuzikode checkout page for all methods; gateway pages are never the checkout UI. Card entry is a short hand-off to the gateway's secure card form (or saved-card tokens when approved) · owner requirement + PCI DSS (never handle raw card data) · building our own card form
- 2026-11-05 · cards · Paynow-only cards: saved-card tokens pay fully on our checkout; a new card is entered once in Paynow's secure popup over our checkout (tokenize=true), never our own card inputs · owner wants Paynow only + no gateway checkout UI; Paynow has no raw-card API or embeddable fields and blocks iframes; PCI DSS · own card form (forbidden), other processors (owner declined), full redirect

## Agent decisions
