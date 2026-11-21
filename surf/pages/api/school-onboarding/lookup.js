import { sql } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import { schoolGeocodingHandler } from '../../../lib/school-geocoding-server.mjs';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };
export default schoolGeocodingHandler({ sql, requireAuth });
