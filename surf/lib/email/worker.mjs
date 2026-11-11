import { decryptPayload, recipientHash } from './crypto.mjs';
import { retryDelay } from './mailjet.mjs';
import { ACCOUNT_ACTIVITY_SUBJECTS, recipientAllowed } from './config.mjs';
import { validAccountToken } from '../account-flow.mjs';
import { isLocale } from '../locale/preferences.mjs';

export async function runEmailWorker({ config, store, send, jobId = null, now = Date.now }) {
  if (!config.enabled) return { enabled: false, processed: 0 };
  const started = now();
  let processed = 0;
  if (!jobId) await store.heartbeat();
  try {
    if (!jobId) await store.maintain();
    // At most three sends, eight seconds each; finish with room inside maxDuration.
    while (processed < (jobId ? 1 : 3) && now() - started < 25000) {
      const job = await store.claim(jobId);
      if (!job) break;
      processed++;
      let payload;
      try {
        const invitation = job.type === 'email.staff_invitation';
        const ownershipOffer=job.type==='email.ownership_offer', ownershipChanged=job.type==='email.ownership_changed';
        const accountLink = job.type === 'email.account_verify' || job.type === 'email.account_reset';
        if ((!accountLink && !invitation && !ownershipOffer && !ownershipChanged && job.type !== 'email.delivery_check' && !Object.hasOwn(ACCOUNT_ACTIVITY_SUBJECTS, job.type)) ||
            job.schema_version !== 1) throw new Error();
        payload = decryptPayload(job.payload, job.id, config, job.type);
        if (!recipientAllowed(config, payload.recipient, job.type) ||
            recipientHash(payload.recipient, config) !== job.recipient_hash ||
            ((accountLink || invitation || ownershipOffer) &&
              ((accountLink && !config.accountFlows) || !validAccountToken(payload.token) || !isLocale(payload.locale))) ||
            (ownershipOffer && !['claim','transfer'].includes(payload.kind)) ||
            (ownershipChanged && (!isLocale(payload.locale) || !['new','previous'].includes(payload.audience) || typeof payload.schoolName!=='string' || payload.schoolName.length>160))) throw new Error();
      } catch {
        await store.finish(job, { status: 'failed', code: 'payload_or_recipient_invalid' });
        continue;
      }
      const preparation = await store.prepare(job, payload.recipient, config);
      if (preparation === 'obsolete') await store.finish(job, { status: 'cancelled', code: 'account_link_obsolete' });
      if (preparation !== 'ready') continue;
      const outcome = await send(job, payload.recipient, payload);
      const dueAt = outcome.status === 'retry' ? new Date(now() + retryDelay(job.attempts + 1, outcome.retryAfter, now())).toISOString() : null;
      await store.finish(job, outcome, dueAt);
    }
    if (!jobId) await store.heartbeat(true);
    return { enabled: true, processed };
  } catch {
    // A failed completion after dispatch is recovered as unknown by the lease.
    if (!jobId) await store.heartbeat(false, 'worker_failed').catch(() => {});
    throw new Error('email_worker_failed');
  }
}
