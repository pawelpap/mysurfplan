import { clearAuthSession, getAuthSession } from '../../../lib/auth';
import { requireMutation } from '../../../lib/request-security.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!requireMutation(req, res)) return;
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, data: await getAuthSession(req) });
    }
    if (req.method === 'DELETE') {
      if (req.query.all !== undefined && req.query.all !== '1') {
        return res.status(400).json({ ok: false, error: 'Invalid logout scope' });
      }
      await clearAuthSession(req, res, { all: req.query.all === '1' });
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', ['GET', 'DELETE']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    const status = [401, 403].includes(err?.statusCode) ? err.statusCode : 503;
    return res.status(status).json({ ok: false, error: status === 401 ? 'Authentication required' : status === 403 ? 'Demo access can only log out this device.' : 'Account access is temporarily unavailable. Please try again.' });
  }
}
