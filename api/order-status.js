// /api/order-status.js
const ORDER_PREFIX = 'order:';
let memory = new Map();
async function kvGet(key) {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import('@vercel/kv'); return await kv.hgetall(key);
  } else return memory.get(key) || null;
}
async function kvSet(key, obj) {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import('@vercel/kv'); await kv.hset(key, obj);
  } else memory.set(key, { ...(memory.get(key)||{}), ...obj });
}

export default async function handler(req, res) {
  const referenceId = req.query.referenceId;
  if (!referenceId) return res.status(400).json({ error: 'Missing referenceId' });

  let rec = await kvGet(ORDER_PREFIX + referenceId);
  if (!rec) return res.status(404).json({ status: 'unknown' });

  try {
    if (rec.status !== 'paid') {
      if (rec.provider === 'mollie' && rec.molliePaymentId) {
        const r = await fetch(`https://api.mollie.com/v2/payments/${rec.molliePaymentId}`, {
          headers: { 'Authorization': `Bearer ${process.env.MOLLIE_API_KEY}` }
        });
        const p = await r.json();
        if (r.ok && p.status) {
          rec.status = p.status;
          await kvSet(ORDER_PREFIX + referenceId, { status: rec.status });
        }
      } else if (rec.provider === 'tikkie' && rec.tikkiePaymentRequestToken) {
        const r = await fetch(`https://api.abnamro.com/v2/tikkie/paymentrequests/${rec.tikkiePaymentRequestToken}/payments`, {
          headers: { 'API-Key': process.env.ABN_API_KEY, 'X-App-Token': process.env.TIKKIE_APP_TOKEN }
        });
        const j = await r.json();
        if (r.ok && Array.isArray(j.payments)) {
          const paid = j.payments.find(p => String(p.status || p.paymentStatus).toLowerCase().includes('paid'));
          if (paid) { rec.status = 'paid'; await kvSet(ORDER_PREFIX + referenceId, { status: 'paid' }); }
        }
      }
    }
    return res.status(200).json({ status: rec.status || 'unknown' });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ status: rec.status || 'unknown' });
  }
}
