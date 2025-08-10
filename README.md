# Basil Bazaar — Vercel Project

This folder contains a ready-to-deploy version of your 90s basil shop.

## Files
- `index.html` — single-file site (shop + agent + iDEAL buttons + thanks page status polling)
- `api/create-payment.js` — creates a payment link (Tikkie or Mollie) and stores a lightweight order status
- `api/payment-webhook.js` — receives payment updates from provider and marks order as paid
- `api/order-status.js` — polled by the front-end on the #thanks page

## What next
1) Push this folder to GitHub/GitLab and import it as a new project in Vercel.
2) In Vercel → Project → Settings → Environment Variables, add at least:
   - `PUBLIC_BASE_URL` → e.g. `https://your-project.vercel.app`
   - `ABN_API_KEY`, `TIKKIE_APP_TOKEN` (for Tikkie) and/or `MOLLIE_API_KEY` (for Mollie)
3) In your payment provider dashboard, set the webhook URL to:
   `https://<your-domain>/api/payment-webhook?provider=tikkie` (or `provider=mollie`)
4) Deploy. The site will be at your Vercel URL. Test a payment in sandbox/test mode.
