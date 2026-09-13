import { emailHandler } from '../../../lib/email/http.mjs';
export const config = { api: { bodyParser: { sizeLimit: '64kb' } }, maxDuration: 30 };
export default emailHandler('events', async () => {
  const { sql } = await import('../../../lib/db');
  return (text, params) => sql.query(text, params);
});
