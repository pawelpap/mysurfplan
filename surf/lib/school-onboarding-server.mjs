import { schoolSettingsInput, SchoolInputError } from './school-onboarding.mjs';

export function schoolOnboardingHandler({ sql, requireAuth }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH');
      return res.status(405).json({ ok: false, error: 'schoolSetup.unavailable' });
    }
    const session = await requireAuth(req, res);
    if (!session) return;
    if (session.demo) return res.status(403).json({ ok: false, error: 'schoolSetup.forbidden' });
    try {
      if (req.method === 'GET') {
        const rows = await sql`SELECT school_settings_json(s,${session.userId}::uuid) AS data
          FROM schools s WHERE account_reads_school_settings(${session.userId}::uuid,s.id)
          ORDER BY s.created_at DESC,s.id LIMIT 200`;
        return res.json({ ok: true, data: rows.map(row => row.data) });
      }
      const create = req.method === 'POST';
      const body = req.body || {};
      const details = JSON.stringify(schoolSettingsInput(body, create ? 'create' : 'update'));
      const [row] = create
        ? await sql`SELECT create_draft_school(${session.userId}::uuid,${body.requestId}::uuid,${details}::jsonb) AS result`
        : await sql`SELECT update_school_settings(${session.userId}::uuid,${body.id}::uuid,${body.revision}::integer,${details}::jsonb) AS result`;
      return res.status(create && !row.result.replayed ? 201 : 200).json({ ok: true, data: row.result.data, replayed: row.result.replayed || false });
    } catch (error) {
      const status = error instanceof SchoolInputError ? 400 : ({ '42501': 403, '22023': 400, '23514': 409, '23505': 409, 'P0002': 404, '40001': 409, '40P01': 409 })[error?.code] || 503;
      const code = error instanceof SchoolInputError ? error.message : status === 403 ? 'schoolSetup.forbidden' : status === 409 ? 'schoolSetup.conflict' : status === 400 ? 'schoolSetup.invalidInput' : 'schoolSetup.unavailable';
      return res.status(status).json({ ok: false, error: code });
    }
  };
}
