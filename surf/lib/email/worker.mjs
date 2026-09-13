import { decryptPayload, recipientHash } from './crypto.mjs';
import { retryDelay } from './mailjet.mjs';

export async function runEmailWorker({ config, store, send, now = Date.now }) {
  if (!config.enabled) return { enabled: false, processed: 0 };
  const started = now();
  let processed = 0;
  await store.heartbeat();
  try {
    await store.maintain();
    // At most three sends, eight seconds each; finish with room inside maxDuration.
    while (processed < 3 && now() - started < 25000) {
      const job = await store.claim();
      if (!job) break;
      processed++;
      let recipient;
      try {
        if (job.type !== 'email.delivery_check' || job.schema_version !== 1) throw new Error();
        recipient = decryptPayload(job.payload, job.id, config).recipient;
        if (!config.allowlist.includes(recipient) || recipientHash(recipient, config) !== job.recipient_hash) throw new Error();
      } catch {
        await store.finish(job, { status: 'failed', code: 'payload_or_recipient_invalid' });
        continue;
      }
      if (await store.prepare(job, recipient, config) !== 'ready') continue;
      const outcome = await send(job, recipient);
      const dueAt = outcome.status === 'retry' ? new Date(now() + retryDelay(job.attempts + 1, outcome.retryAfter, now())).toISOString() : null;
      await store.finish(job, outcome, dueAt);
    }
    await store.heartbeat(true);
    return { enabled: true, processed };
  } catch {
    // A failed completion after dispatch is recovered as unknown by the lease.
    await store.heartbeat(false, 'worker_failed').catch(() => {});
    throw new Error('email_worker_failed');
  }
}
