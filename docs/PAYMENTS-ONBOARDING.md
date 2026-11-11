# Payments onboarding

How to take Kuzikode from test payments to real ones with Paynow, add a ZWG integration, and add or switch to PesePay.
Background and design: [06-PAYMENTS.md](06-PAYMENTS.md). Every step that touches money is yours: the build only prepares
and tests.

## How it fits together

- A **gateway account** (Admin → Payments → Gateways) = one merchant integration: gateway (Paynow, PesePay), mode
  (test/live), currencies, methods, and a **secret prefix**. Its keys are Worker secrets named `<prefix>_<field>`, e.g.
  `PAYNOW_USD_INTEGRATION_ID` and `PAYNOW_USD_INTEGRATION_KEY`. Keys are never typed into the admin, stored in the
  database or shown anywhere; the admin only says whether each one is present.
- **Payment routes** choose the account per currency and method: exact currency beats `*`, exact method beats `*`, then
  lower priority wins. Accounts that are disabled or missing secrets are skipped.
- Payments confirm through the gateway's server-to-server result URL
  (`https://<site>/api/payments/callbacks/<gateway>/<accountId>`), verified by hash, plus a status poll and a 5-minute
  reconciliation. A client closing the browser early doesn't lose a payment.

Already set up: the account **Paynow USD** (`PAYNOW_USD`, test mode, EcoCash/OneMoney/InnBucks/card) with routes for USD,
and **PesePay main** (`PESEPAY_MAIN`, not routed). Staging also has the **Mock gateway (test only)**.

## 1. Paynow merchant account and test integration (done)

Your test integration's keys are in the build environment and on the staging Worker, and the automated live test suite
passed against it (EcoCash success/cancel/insufficient balance, card on Paynow's page). Remaining: the Faked Success
payment below.

## 2. Faked Success test (needed before going live)

Paynow only lets the merchant that owns the integration fake-pay. With staging deployed:

1. Staging admin → Clients → create a test client with **your** email.
2. Invoices → New → that client, USD, one small line → **Issue invoice** → open the client link (or **Send to client**).
3. **Pay now** → Bank card → Pay. On the Paynow page, sign in with your Paynow merchant login and choose **Faked Success**.
4. You return to Kuzikode's page, which shows *Paid*; the invoice is paid and a receipt is emailed.

In test mode Paynow sends mobile-money prompts only for the merchant's own account email, so staging sends your
Paynow login (`PAYNOW_TEST_AUTHEMAIL`, a staging Worker secret) as the payer email. Test numbers: `0771111111` success,
`0772222222` delayed success, `0773333333` cancelled, `0774444444` insufficient balance.

## 3. Going live with Paynow

1. Paynow → your integration → **Request to be Set Live** (Paynow asks for your merchant KYC documents).
2. When Paynow confirms the integration is live, put its keys into production as GitHub secrets (repository → Settings →
   Secrets and variables → Actions, or on the `production` environment): `PAYNOW_USD_INTEGRATION_ID`,
   `PAYNOW_USD_INTEGRATION_KEY`. Run **Deploy production** (it copies them to the Worker).
3. Production admin → Payments → Gateways → edit **Paynow USD** → Mode **Live** → Save. (In Live mode the test payer email is no longer
   sent; Paynow itself decides test vs live per integration.)
4. In Paynow's integration settings, check the site URL is your production address.
5. Pay one small real invoice yourself with EcoCash and with a card, confirm both show as paid in Admin → Payments, then
   refund them in Paynow and record a credit note in Kuzikode (Invoices → the invoice → **Credit note**).
6. Recommended before real volume: Workers Paid plan ($5/month, see BLOCKERS) so card hashing and PDF rendering never hit
   the free CPU limit.

**Saved cards and automatic subscription charges** additionally need Paynow to enable tokenization for your merchant
(BLOCKERS has the exact email to send). After Paynow confirms: edit Paynow USD → switch on **Saved cards (card
tokenization)**.

## 4. ZWG payments

Paynow uses one integration per currency.

1. Paynow → Create Advanced Integration in **ZWG** → Email Key To Company Address.
2. Secrets `PAYNOW_ZWG_INTEGRATION_ID` and `PAYNOW_ZWG_INTEGRATION_KEY` (GitHub secrets for production, then Deploy
   production; for staging `npx wrangler secret put … --env staging`).
3. Admin → Payments → Gateways → **Add account**: Gateway Paynow, Name "Paynow ZWG", Secret prefix `PAYNOW_ZWG`,
   currency ZWG, methods you enabled at Paynow → Save.
4. **Add route**: Account Paynow ZWG, Currency ZWG, Method *Any method* → Save. ZWG invoices now pay through it; until then ZWG
   invoices offer bank transfer only (and the mock gateway on staging).

## 5. Adding PesePay, or switching to it

No code change is needed: PesePay is a supported adapter and the account already exists.

1. PesePay merchant dashboard → integration → copy the **integration key** and **encryption key**.
2. Secrets `PESEPAY_MAIN_INTEGRATION_KEY` and `PESEPAY_MAIN_ENCRYPTION_KEY` (GitHub secrets → Deploy production).
3. Admin → Payments → Gateways: the **PesePay main** account shows both secrets as present. Set its currencies/methods.
4. Routes:
   - **Run both:** add a route for the method or currency PesePay should handle (e.g. USD · card → PesePay main,
     priority 10), leave the rest on Paynow.
   - **Switch completely:** add USD/ZWG routes to PesePay main with a lower priority number than Paynow's, or disable
     the Paynow account. Payments already started with Paynow still finish and reconcile through Paynow.
5. Make one small real payment through PesePay and check it in Admin → Payments.

A further gateway needs a new adapter in `packages/payments` (guide in `packages/payments/README.md`); the rest of the
platform doesn't change.
