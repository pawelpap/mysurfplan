import { waitUntil } from '@vercel/functions';
import { sql } from '../../../lib/db';
import { requireAuth, resolveSchoolScope } from '../../../lib/auth';
import { invitationHandler } from '../../../lib/invitation-server.mjs';
import { createJobStore } from '../../../lib/email/store.mjs';
import { createMailjetAdapter } from '../../../lib/email/mailjet.mjs';
import { runEmailWorker } from '../../../lib/email/worker.mjs';
export const config = { api: { bodyParser: { sizeLimit: '4kb' } }, maxDuration: 30 };
function scheduleDelivery(sql, config, jobId) {
 waitUntil(runEmailWorker({ config, jobId, store: createJobStore((q,p)=>sql.query(q,p),config.environment), send:createMailjetAdapter(config) }).catch(()=>console.error('invitation_delivery_deferred')));
}
export default invitationHandler({sql,requireAuth,resolveSchoolScope,scheduleDelivery});
