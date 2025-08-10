// /api/payment-webhook.js
const ORDER_PREFIX = 'order:';
let memory = new Map();
async function kvSet(key, obj) {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import('@vercel/kv'); await kv.hset(key, obj);
  } else memory.set(key, { ...(memory.get(key)||{}), ...obj });
}
async function kvGet(key) {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import('@vercel/kv'); return await kv.hgetall(key);
  } else return memory.get(key) || null;
}

export default async function handler(req, res) {
  const provider = (req.query.provider || '').toLowerCase();
  const ref = req.query.ref;

  try {
    if (provider === 'mollie') {
      let id = req.body?.id;
      if (!id && typeof req.body === 'string') id = new URLSearchParams(req.body).get('id');
      if (!id) return res.status(400).send('Missing id');

      const r = await fetch(`https://api.mollie.com/v2/payments/${id}`, {
        headers: { 'Authorization': `Bearer ${process.env.MOLLIE_API_KEY}` }
      });
      const p = await r.json();
      if (!r.ok) return res.status(r.status).json(p);

      const status = p.status;
      await kvSet(ORDER_PREFIX + (ref || p.metadata?.referenceId || id), {
        provider: 'mollie',
        status,
        molliePaymentId: id,
        paidAt: status === 'paid' ? new Date().toISOString() : null
      });
      return res.status(200).send('ok');
    }

    if (provider === 'tikkie') {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const statusText = String(payload.status || payload.eventStatus || '').toLowerCase();
      const status = statusText.includes('paid') ? 'paid' : (statusText || 'paid');
      await kvSet(ORDER_PREFIX + (ref || payload.referenceId || payload.paymentRequest?.referenceId || 'unknown'), {
        provider: 'tikkie',
        status,
        tikkieRaw: payload,
        paidAt: status === 'paid' ? new Date().toISOString() : null
      });
      return res.status(200).send('ok');
    }

    return res.status(400).send('unknown provider');
  } catch (e) {
    console.error(e);
    return res.status(500).send('error');
  }
}
