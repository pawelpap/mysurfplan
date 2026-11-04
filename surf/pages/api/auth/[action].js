import { accountHandler } from '../../../lib/account-server.mjs';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };
export default accountHandler(async () => (await import('../../../lib/db')).sql);
