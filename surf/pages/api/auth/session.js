import { clearAuthSession, getAuthSession } from '../../../lib/auth';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, data: await getAuthSession(req) });
    }
    if (req.method === 'DELETE') {
      // Browser requests must originate here; non-browser clients may omit Origin.
      const origin = req.headers.origin;
      if (origin) {
        let host;
        try { host = new URL(origin).host; } catch { host = null; }
        if (host !== req.headers.host) return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      if (req.query.all !== undefined && req.query.all !== '1') {
        return res.status(400).json({ ok: false, error: 'Invalid logout scope' });
      }
      await clearAuthSession(req, res, { all: req.query.all === '1' });
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', ['GET', 'DELETE']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    const status = err?.statusCode === 401 ? 401 : 503;
    return res.status(status).json({ ok: false, error: status === 401 ? 'Authentication required' : 'Account access is temporarily unavailable. Please try again.' });
  }
}
