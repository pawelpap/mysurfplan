import { sql } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import { mediaHandlers } from '../../../lib/media-server.mjs';
export const config={api:{bodyParser:{sizeLimit:'1kb'}}};
export default mediaHandlers({sql,requireAuth}).profile;
