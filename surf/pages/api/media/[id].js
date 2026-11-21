import { sql } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import { mediaHandlers } from '../../../lib/media-server.mjs';
export default mediaHandlers({sql,requireAuth}).image;
