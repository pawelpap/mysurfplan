import { sql } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import { schoolBrandingHandler } from '../../../lib/school-branding-server.mjs';
export const config={api:{bodyParser:{sizeLimit:'12kb'}},maxDuration:180};
export default schoolBrandingHandler({sql,requireAuth});
