import { sql } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import { invitationHandler } from '../../../lib/invitation-server.mjs';
export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };
export default invitationHandler({sql,requireAuth},'accept');
