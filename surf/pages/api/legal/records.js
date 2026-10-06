import { requireAuth } from '../../../lib/auth';
import { sql } from '../../../lib/db';
import { createLegalStore } from '../../../lib/legal/store.mjs';
import { createLegalHandler } from '../../../lib/legal/handler.mjs';

export default createLegalHandler({ requireAuth, store: createLegalStore(sql) });
