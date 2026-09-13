import { emailHandler } from '../../../lib/email/http.mjs';
export const config = { maxDuration: 60 };
export default emailHandler('worker', async () => {
  const { sql } = await import('../../../lib/db');
  return (text, params) => sql.query(text, params);
});
