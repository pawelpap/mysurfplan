import { clearAuthSession, getAuthSession, setAuthSession } from '../../../lib/auth';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, data: getAuthSession(req) });
    }

    if (req.method === 'POST') {
      const session = await setAuthSession(res, req.body || {});
      return res.status(200).json({ ok: true, data: session });
    }

    if (req.method === 'DELETE') {
      clearAuthSession(res);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
