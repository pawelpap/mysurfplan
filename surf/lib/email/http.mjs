import { emailConfig, equalSecret } from './config.mjs';
import { createJobStore, enqueueDeliveryCheck } from './store.mjs';
import { createMailjetAdapter } from './mailjet.mjs';
import { runEmailWorker } from './worker.mjs';
import { recordDeliveryEvents } from './events.mjs';

// Database loading is deliberately deferred until after method/auth checks.
export function emailHandler(kind, getQuery, env = process.env) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const methods = kind === 'worker' ? ['GET'] : kind === 'events' ? ['POST'] : ['GET','POST'];
    if (!methods.includes(req.method)) { res.setHeader('Allow', methods.join(', ')); return res.status(405).json({ ok: false }); }
    try {
      const config = emailConfig(env);
      if (!config.enabled) return res.status(503).json({ ok: false, code: 'email_disabled' });
      const credential = kind === 'events' ? `Basic ${Buffer.from(`${config.environment}:${config.callbackSecret}`).toString('base64')}` :
        `Bearer ${kind === 'worker' ? config.cronSecret : config.operationsSecret}`;
      if (!equalSecret(req.headers.authorization, credential)) return res.status(401).json({ ok: false });
      const query = await getQuery();
      if (kind === 'events') {
        await recordDeliveryEvents(query, req.body, config);
        return res.status(200).json({ ok: true });
      }
      const store = createJobStore(query, config.environment);
      if (kind === 'worker') return res.status(200).json(await runEmailWorker({ config, store, send: createMailjetAdapter(config) }));
      if (req.method === 'GET') return res.status(200).json({ enabled: true, environment: config.environment, ...(await store.status()) });
      // Operator-only fixed delivery check. There is no arbitrary recipient,
      // template, subject or message API, and no user-session access to this route.
      if (!req.body || Object.keys(req.body).some(k => k !== 'idempotencyKey') ||
          !/^[a-zA-Z0-9:_-]{1,150}$/.test(req.body.idempotencyKey || '')) return res.status(400).json({ ok: false });
      const job = await enqueueDeliveryCheck(query, config, { recipient: config.allowlist[0], idempotencyKey: `check:${req.body.idempotencyKey}`, operator: true });
      if (!job) return res.status(429).json({ ok: false, code: 'delivery_check_throttled' });
      return res.status(202).json({ ok: true, job });
    } catch {
      // Never log provider responses, addresses, callback URLs, credentials or payloads.
      console.error('email_operation_failed', { operation: kind });
      return res.status(503).json({ ok: false, code: 'email_unavailable' });
    }
  };
}
