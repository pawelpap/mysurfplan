import { emailHandler } from '../../../lib/email/http.mjs';
export const config = { api: { bodyParser: { sizeLimit: '4kb' } }, maxDuration: 30 };
export default emailHandler('operations', async () => {
  const { sql } = await import('../../../lib/db');
  return (text, params) => sql.query(text, params);
});
