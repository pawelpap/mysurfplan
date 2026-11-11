import {sql} from '../../../lib/db';
import {requireAuth,authenticatedSessionHash} from '../../../lib/auth';
import {schoolOwnershipHandler} from '../../../lib/school-ownership-server.mjs';
import {scheduleOwnershipDelivery} from '../../../lib/school-ownership-delivery.mjs';
export const config={api:{bodyParser:{sizeLimit:'8kb'}},maxDuration:30};
export default schoolOwnershipHandler({sql,requireAuth,getSessionHash:authenticatedSessionHash,scheduleDelivery:scheduleOwnershipDelivery},'claims');
