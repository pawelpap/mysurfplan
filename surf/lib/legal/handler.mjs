import { validateLegalAction, canRepresentSchool } from './contracts.mjs';
import { legalDocuments } from './contracts.mjs';
import { defaultLocale, isLocale } from '../locale/preferences.mjs';

export function createLegalHandler({ requireAuth, store }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!['GET', 'POST'].includes(req.method)) {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }
    const session = await requireAuth(req, res);
    if (!session) return;
    try {
      if (req.method === 'GET') {
        const records = await store.records(session.userId);
        const preview = await store.preview(req);
        const language = req.query?.language ?? session.preferredLocale ?? defaultLocale;
        if (!isLocale(language)) return res.status(400).json({ ok: false, error: 'Unsupported language' });
        const documents = (await Promise.all(legalDocuments.filter(d => d.kind !== 'privacy_notice').map(async d =>
          await store.document(d.id, { language, preview }) ||
          (language !== defaultLocale ? await store.document(d.id, { preview }) : null)
        ))).filter(Boolean).map(({ content, ...d }) => d);
        const schools = (session.schools || []).filter(s => canRepresentSchool(s)).map(({ id, name }) => ({ id, name }));
        return res.json({ ok: true, data: { ...records, documents, schools, preview } });
      }
      const preview = await store.preview(req);
      const body = req.body;
      if (body?.action === 'notice_delivery') return res.status(400).json({ok:false,error:'Notice delivery is recorded when the server provides the notice.'});
      if (!body || typeof body !== 'object' || Array.isArray(body) || !['accept_terms','accept_school','optional_preference'].includes(body.action))
        return res.status(400).json({ok:false,error:'Invalid legal action.'});
      if (body.action !== 'optional_preference' && (!legalDocuments.some(d=>d.id===body.documentId) ||
        typeof body.version !== 'string' || !body.version || body.version.length>80 || !isLocale(body.language) ||
        typeof body.contentHash !== 'string' || !/^[0-9a-f]{64}$/.test(body.contentHash)))
        return res.status(400).json({ok:false,error:'Invalid document version or language.'});
      const document = body?.action === 'optional_preference' ? null : await store.document(body?.documentId, { version: body?.version, language: body?.language, preview });
      const action = validateLegalAction(body, session, document, { stagingPreview: preview });
      await store.record(action, { preview });
      return res.json({ ok: true, data: await store.records(session.userId) });
    } catch (error) {
      const status = [400, 401, 403, 409].includes(error.statusCode) ? error.statusCode : 503;
      return res.status(status).json({ ok: false, error: status === 503 ? 'Legal records are temporarily unavailable. Please try again.' : error.message });
    }
  };
}
