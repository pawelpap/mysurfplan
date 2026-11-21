import { sql } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import { mediaHandlers } from '../../../lib/media-server.mjs';
export const config={api:{bodyParser:false},maxDuration:180};
export default mediaHandlers({sql,requireAuth}).upload;
