import { waitUntil } from '@vercel/functions';
import deploymentConfig from '../../../vercel.json';
import { accountHandler } from '../../../lib/account-server.mjs';
import { createMailjetAdapter } from '../../../lib/email/mailjet.mjs';
import { createJobStore } from '../../../lib/email/store.mjs';
import { runEmailWorker } from '../../../lib/email/worker.mjs';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } }, maxDuration: 60 };

function scheduleDelivery(sql, config, jobId) {
  const store = createJobStore((query, values) => sql.query(query, values), config.environment);
  waitUntil(runEmailWorker({ config, store, send: createMailjetAdapter(config), jobId }).catch(() => {
    console.error('account_email_fast_delivery_failed');
  }));
}

// Tie immediate delivery and its readiness window to the recovery schedule.
const scheduled = deploymentConfig.crons?.some(cron => cron.path === '/api/cron/jobs');
export default accountHandler(async () => (await import('../../../lib/db')).sql, process.env,
  scheduled ? scheduleDelivery : undefined);
