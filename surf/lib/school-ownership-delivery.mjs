import {waitUntil} from '@vercel/functions';
import {createJobStore} from './email/store.mjs';
import {createMailjetAdapter} from './email/mailjet.mjs';
import {runEmailWorker} from './email/worker.mjs';
export function scheduleOwnershipDelivery(sql,config,jobId){
 waitUntil(runEmailWorker({config,jobId,store:createJobStore((q,p)=>sql.query(q,p),config.environment),send:createMailjetAdapter(config)}).catch(()=>console.error('ownership_delivery_deferred')));
}
