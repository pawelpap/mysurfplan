import { emailHandler } from '../../../lib/email/http.mjs';
export const config = { maxDuration: 120 };
export default emailHandler('worker', async () => {
  const { sql } = await import('../../../lib/db');
  return (text, params) => sql.query(text, params);
},process.env,async()=>{
  const {sql}=await import('../../../lib/db');
  const {createMediaStorage}=await import('../../../lib/media-storage.mjs');
  return createMediaStorage({sql}).cleanup(3);
});
