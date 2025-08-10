// /api/create-payment.js  (Node 18+)
// Env: MOLLIE_API_KEY, ABN_API_KEY, TIKKIE_APP_TOKEN, PUBLIC_BASE_URL
// Optional: KV_REST_API_URL, KV_REST_API_TOKEN (Vercel KV)

const ORDER_PREFIX = 'order:';
let memory = new Map();
async function kvSet(key, obj) {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import('@vercel/kv'); await kv.hset(key, obj);
  } else memory.set(key, { ...(memory.get(key)||{}), ...obj });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { provider, amountEUR, description, referenceId, returnUrl, buyer } = req.body || {};
  if (!provider || !amountEUR || !description || !referenceId || !returnUrl) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    if (provider === 'mollie') {
      const resp = await fetch('https://api.mollie.com/v2/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MOLLIE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: { currency: 'EUR', value: Number(amountEUR).toFixed(2) },
          description,
          redirectUrl: returnUrl,
          webhookUrl: `${process.env.PUBLIC_BASE_URL}/api/payment-webhook?provider=mollie&ref=${encodeURIComponent(referenceId)}`
        })
      });
      const j = await resp.json();
      if (!resp.ok) return res.status(resp.status).json(j);
      await kvSet(ORDER_PREFIX + referenceId, {
        provider: 'mollie',
        status: 'open',
        molliePaymentId: j.id,
        amount: amountEUR,
        buyerEmail: buyer?.email || null
      });
      const checkout = j._links?.checkout?.href;
      return res.status(200).json({ paymentUrl: checkout, provider: 'mollie' });
    }

    if (provider === 'tikkie') {
      const cents = Math.round(Number(amountEUR) * 100);
      const resp = await fetch('https://api.abnamro.com/v2/tikkie/paymentrequests', {
        method: 'POST',
        headers: {
          'API-Key': process.env.ABN_API_KEY,
          'X-App-Token': process.env.TIKKIE_APP_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amountInCents: cents,
          description,
          referenceId,
          callbackUrl: `${process.env.PUBLIC_BASE_URL}/api/payment-webhook?provider=tikkie&ref=${encodeURIComponent(referenceId)}`
        })
      });
      const j = await resp.json();
      if (!resp.ok) return res.status(resp.status).json(j);

      const paymentUrl = j.url || j._links?.paymentRequestUrl?.href;
      await kvSet(ORDER_PREFIX + referenceId, {
        provider: 'tikkie',
        status: 'open',
        tikkiePaymentRequestToken: j.paymentRequestToken || j.id || null,
        amount: amountEUR,
        buyerEmail: buyer?.email || null
      });
      return res.status(200).json({ paymentUrl, provider: 'tikkie' });
    }

    return res.status(400).json({ error: 'Unknown provider' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
