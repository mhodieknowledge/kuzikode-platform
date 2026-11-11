# Admin guide

For the owner and staff of Kuzikode Technologies. It covers the first sign-in, the settings to fill in before you invoice
anyone, inviting staff and clients, the quotation → invoice → payment cycle, and payment gateways. Everything here happens in
the admin at `/admin` (staging: https://kuzikode-staging.mhodieknowledge.workers.dev/admin). Press **Ctrl K** / **⌘ K**
anywhere in the admin to jump to a page or record.

## 1. First sign-in

1. Create the first Super Administrator once per environment: GitHub → this repository → **Actions** → **Bootstrap first
   admin** → **Run workflow** → choose the environment, enter your email and name → **Run workflow**. Within about
   10 minutes you get an email "You have been invited to the Kuzikode admin" with a **Set your password** button (the link
   works once, for 24 hours). Until your email domain is verified in Resend, use the email address of your Resend account
   ([EMAIL-SETUP.md](EMAIL-SETUP.md)).
2. Choose a password (at least 12 characters; long passphrases are best).
3. Two-step sign-in is **required** for Super Administrators and Finance Managers. You're taken to the set-up page: scan
   the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Aegis…), enter the
   6-digit code, then **store the 10 backup codes** somewhere safe (password manager or printed). Each backup code works
   once if you lose your phone.
4. From then on you sign in at `/admin/login` with email, password and a code. **Account** (top-right menu) has
   *Security & password*, *Signed-in devices* (sign other devices out) and *Notification preferences*.

If you are locked out with no backup codes, another Super Administrator can use Admin → Users → you → **Reset two-factor**.
Keep at least two Super Administrators once you have staff you trust; the system never lets you disable the last one.

## 2. Settings to fill in first (Admin → Settings)

| Tab | What to set |
|---|---|
| **General** | Company name, contact email and phone, address, and anything you want on documents. Registration and tax numbers are shown only once you enter them, so leave them empty until they're real. |
| **Billing & taxes** | Currencies you invoice in (USD, ZWG), default payment terms, bank details for bank transfers, the document logo, and tax rates. Add a VAT rate only once you are VAT-registered and know the current rate (BLOCKERS). |
| **Numbering** | Prefixes and next numbers for quotations, invoices, credit notes and receipts (e.g. `INV-2026-0001`). Numbers are given out when a document is issued, never reused, and can't move backwards. |
| **Website** | Site-wide content: contact details shown on the website, social links, SEO defaults, announcement bar. Page texts are under Admin → Pages; services, industries, insights, FAQ and testimonials under Admin → Content. |
| **Integrations** | Email status and **Send a test email to me**, payment gateway status. |
| **Data export** | (Super Administrator) a full export of your data. |

Website content honesty: the portfolio, testimonials and client logos start empty on purpose. Add only real work and real,
approved quotes (Admin → Pages → Portfolio, Admin → Content → Testimonials).

## 3. Staff

Admin → **Users** → **Invite staff member** → name, email, role(s) → send. They get an email with a link valid for 7 days.
Roles (Admin → Users → Roles shows exactly what each can do):

| Role | Typical use |
|---|---|
| Super Administrator | Owner. Everything, incl. users, gateways, data export |
| Administrator | Runs the business day to day, no user/role management |
| Finance Manager | Invoices, payments, credit notes, expenses, reports (two-step sign-in required) |
| Project Manager | Projects, time, support for their clients |
| Content Manager | Website content, insights, media |
| Support Staff | Support tickets and client questions |
| Hiring Manager | Careers: postings and applicants |

To remove access: the user → **Disable account** (they are signed out everywhere at once; you can enable them again later).
Every sensitive action is recorded in Admin → **Audit log**.

## 4. Clients and the client portal

- Enquiries from the website arrive in Admin → **Enquiries** (you also get a notification). Turn a promising one into a
  **Lead** (Admin → Leads) to track it through your pipeline, then into a **Client**.
- Admin → **Clients** → New client: company or person, contacts, billing details, currency.
- Portal: on the client's page → **Invite to the portal** → choose the contact → **Send invitation**. They set a password and
  can then see quotations (and accept them), invoices (and pay them), receipts, projects and support tickets. People can
  also ask for portal access themselves; requests appear under Clients → Portal sign-ups for you to link or decline.
  **Revoke access** removes a person's portal access.
- Archive a client you no longer work with (their documents stay; financial records are never deleted).

## 5. Quotations

Admin → **Quotations** → New: client, currency, lines (free text or **Add package** from your catalogue), valid-until
date, terms. Save as draft, then **Send to client**: they get an email with a link to view and accept it (in the portal or
through the link). You can also **Mark accepted** / **Mark rejected** yourself when the client answers by phone or email
(you record who accepted and when). An accepted quotation can be turned into an invoice with **Convert to invoice**
and into a project with **Create project**. To change a sent quotation use **Revise** (creates a new version) or **Void**.

## 6. Invoices, payments and credit notes

1. Admin → **Invoices** → New (or Convert to invoice from a quotation): client, currency, issue and due dates, lines,
   notes to the client. A draft can be edited or deleted freely.
2. **Issue invoice** gives it its number and freezes it: issued invoices can't be edited or deleted (accounting rule).
   Tick *Email the invoice to the client* to send it at once, or use **Send to client** / **Resend** later. The email has
   the PDF and a **Pay now** link.
3. Payments:
   - **Online** (EcoCash, OneMoney, InnBucks, O'mari, Visa/Mastercard, Zimswitch) through the payment link or the portal.
     The invoice updates by itself when the gateway confirms the payment, and the client gets a receipt.
   - **Offline** (bank transfer, cash): open the invoice → **Record payment** → amount, date received, method, reference.
   Partial payments are fine; the balance updates. Overdue invoices are marked automatically each night and reminders go
   out according to the *Payment reminder schedule* setting (by default 3 days before the due date, on the due date,
   then while overdue).
4. Mistakes: an issued invoice is corrected with a **Credit note** (part or **Credit everything left**) or **Void invoice**
   (only when nothing has been paid), then issue a corrected invoice. Client credit can be used on another invoice with
   **Apply credit**.
5. Admin → **Payments** lists every payment and online attempt; Admin → **Reports** gives revenue, outstanding balances,
   ageing and expenses, with CSV export.

Recurring work (hosting, support plans): Admin → **Subscriptions** issues the invoices automatically each period and can
charge a saved card when the client agreed to it (needs Paynow card tokenization, see BLOCKERS).

## 7. Payment gateways (Admin → Payments → Gateways)

The platform doesn't depend on one gateway. Each **gateway account** (e.g. "Paynow USD") holds which currencies and methods
it accepts and the *names* of its secrets (the keys themselves are Worker secrets, never typed into the admin).
**Payment routes** decide which account handles which currency/method; the most specific matching route wins, then
priority. To pause online payments, edit the account and untick **Enabled**. Staging also has a *Mock gateway (test only)*
that moves no money and is labelled TEST everywhere; it does not exist in production.

Adding or switching a gateway is described step by step in [PAYMENTS-ONBOARDING.md](PAYMENTS-ONBOARDING.md).

## 8. Everything else

| Area | What it's for |
|---|---|
| Projects, Time | Delivery tracking, milestones, time entries per client/project |
| Support | Client tickets from the portal, replies by email |
| Managed services | Client assets (domains, hosting, certificates) with renewal reminders |
| Expenses | Business expenses with receipts, categories and a report |
| Packages, Services | The catalogue shown on the pricing and service pages and used in quotations |
| Careers | Job postings, applications, applicant pipeline |
| Content, Pages, Media | Website text, insights (blog), FAQ, industries, technologies, newsletter, images |
| Notifications | The bell: new enquiries, payments, overdue invoices, support replies |
