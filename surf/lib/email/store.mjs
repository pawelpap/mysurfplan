import { randomUUID } from 'node:crypto';
import { encryptPayload, recipientHash } from './crypto.mjs';
import { validEmail } from './config.mjs';

// query(text, values) returns rows. A future business action must pass its own
// transaction's query here so its update and this insert commit or roll back together.
export async function enqueueDeliveryCheck(query, config, { recipient, idempotencyKey, userId = null, authVersion = null, operator = false }) {
  recipient = recipient?.trim().toLowerCase();
  if (!config.enabled || !validEmail(recipient) || !config.allowlist.includes(recipient)) throw new Error('email_recipient_denied');
  if (!/^[a-zA-Z0-9:_-]{1,150}$/.test(idempotencyKey || '')) throw new Error('email_idempotency_required');
  if (userId && !Number.isInteger(authVersion)) throw new Error('email_user_version_required');
  const id = randomUUID();
  const payload = encryptPayload({ recipient }, id, config);
  const [{ id: queued }] = await query('SELECT enqueue_delivery_check($1,$2,$3,$4,$5,$6,$7,$8) AS id',
    [id, config.environment, idempotencyKey, userId, authVersion, recipientHash(recipient, config), JSON.stringify(payload), operator]);
  return queued ? { id: queued } : null;
}

export function createJobStore(query, environment) {
  return {
    async maintain() {
      await query(`UPDATE job_outbox SET status=CASE WHEN dispatch_started_at IS NULL THEN 'pending' ELSE 'delivery_unknown' END,
        payload=CASE WHEN dispatch_started_at IS NULL THEN payload ELSE NULL END,
        error_code=CASE WHEN dispatch_started_at IS NULL THEN 'lease_recovered' ELSE 'dispatch_interrupted' END,
        lease_token=NULL,lease_until=NULL,updated_at=now()
        WHERE id IN (SELECT id FROM job_outbox WHERE environment=$1 AND status='leased' AND lease_until<=now() LIMIT 100 FOR UPDATE SKIP LOCKED)`, [environment]);
      await query(`UPDATE job_outbox SET status='expired',payload=NULL,error_code='job_expired',updated_at=now()
        WHERE id IN (SELECT id FROM job_outbox WHERE environment=$1 AND status='pending' AND expires_at<=now() LIMIT 100 FOR UPDATE SKIP LOCKED)`, [environment]);
      await query(`DELETE FROM job_outbox WHERE id IN (SELECT id FROM job_outbox WHERE environment=$1
        AND status NOT IN ('pending','leased') AND updated_at<now()-interval '30 days' LIMIT 100)`, [environment]);
      await query(`DELETE FROM email_usage WHERE environment=$1 AND starts_on<current_date-interval '2 months'`, [environment]);
    },
    async heartbeat(complete = false, error = null) {
      await query(`INSERT INTO job_worker_status(environment,started_at,completed_at,last_error)
        VALUES($1,now(),CASE WHEN $2 THEN now() END,$3) ON CONFLICT(environment) DO UPDATE SET
        started_at=CASE WHEN $2 THEN job_worker_status.started_at ELSE now() END,
        completed_at=CASE WHEN $2 THEN now() ELSE job_worker_status.completed_at END,last_error=$3`, [environment, complete, error]);
    },
    async claim() {
      const [job] = await query(`UPDATE job_outbox SET status='leased',lease_token=$2,lease_until=now()+interval '60 seconds',
        dispatch_started_at=NULL,updated_at=now() WHERE id=(SELECT id FROM job_outbox WHERE environment=$1
        AND status='pending' AND due_at<=now() AND expires_at>now() ORDER BY priority DESC,due_at
        LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`, [environment, randomUUID()]);
      return job;
    },
    async prepare(job, recipient, config) {
      const [row] = await query('SELECT prepare_email_dispatch($1,$2,$3,$4,$5,$6) AS result',
        [job.id, job.lease_token, environment, recipient, config.dailyLimit, config.monthlyLimit]);
      return row.result;
    },
    async finish(job, outcome, dueAt = null) {
      const retry = outcome.status === 'retry';
      // A callback may already have changed the state. Never overwrite it.
      await query(`UPDATE job_outbox SET status=CASE WHEN $4='retry' THEN
        CASE WHEN attempts>=6 THEN 'failed' WHEN $7::timestamptz>=expires_at THEN 'expired' ELSE 'pending' END ELSE $4 END,
        payload=CASE WHEN $4='retry' AND attempts<6 AND $7::timestamptz<expires_at THEN payload ELSE NULL END,
        due_at=coalesce($7::timestamptz,due_at),provider_id=coalesce($5,provider_id),error_code=$6,
        dispatch_started_at=CASE WHEN $4='retry' THEN NULL ELSE dispatch_started_at END,
        lease_token=NULL,lease_until=NULL,updated_at=now()
        WHERE id=$1 AND environment=$2 AND status='leased' AND lease_token=$3 AND lease_until>now()`,
      [job.id, environment, job.lease_token, outcome.status, outcome.providerId || null, outcome.code || null, retry ? dueAt : null]);
    },
    async status() {
      const counts = await query(`SELECT status,count(*)::integer AS count FROM job_outbox WHERE environment=$1 GROUP BY status`, [environment]);
      const [health] = await query(`SELECT extract(epoch FROM now()-min(due_at))::integer AS overdue_seconds
        FROM job_outbox WHERE environment=$1 AND status='pending' AND due_at<=now()`, [environment]);
      const [worker] = await query('SELECT started_at,completed_at,last_error FROM job_worker_status WHERE environment=$1', [environment]);
      const usage = await query(`SELECT period,starts_on,attempts FROM email_usage WHERE environment=$1
        AND starts_on>=date_trunc('month',now() AT TIME ZONE 'UTC')::date`, [environment]);
      return { counts, ...health, worker: worker || null, usage };
    },
  };
}
