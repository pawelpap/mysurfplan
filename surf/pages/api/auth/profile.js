import { requireAuth } from '../../../lib/auth';
import { sql } from '../../../lib/db';

export const config = { api: { bodyParser: { sizeLimit: '2kb' } } };

export default async function profile(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ ok: false, error: 'account.unavailable' });
  }
  const session = await requireAuth(req, res);
  if (!session) return;
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const familyName = typeof body.familyName === 'string' ? body.familyName.trim() : '';
  if (!name || name.length > 120 || familyName.length > 120 || /[\x00-\x1f\x7f]/.test(name + familyName))
    return res.status(400).json({ ok: false, error: 'account.invalidName' });

  try {
    const [person] = await sql`
      UPDATE users SET name=${name},family_name=${familyName || null}
      WHERE id=${session.userId} AND deleted_at IS NULL AND disabled_at IS NULL AND NOT is_demo
      RETURNING id
    `;
    if (!person) return res.status(401).json({ ok: false, error: 'account.unavailable' });
    return res.json({ ok: true });
  } catch {
    return res.status(503).json({ ok: false, error: 'account.unavailable' });
  }
}
