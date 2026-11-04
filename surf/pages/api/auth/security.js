import { clearAuthCookie, requireAuth } from '../../../lib/auth';
import { sql } from '../../../lib/db';
import { accountLifecycleHandler } from '../../../lib/account-lifecycle.mjs';

export const config = { api: { bodyParser: { sizeLimit: '2kb' } } };
export default accountLifecycleHandler({ sql, requireAuth, clearCookie: clearAuthCookie });
