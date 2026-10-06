import { defaultPreferences, isLegalStagingPreview, legalError } from './contracts.mjs';

export function createLegalStore(sql) {
  return {
    async preview(req) {
      const [row] = await sql`SELECT environment FROM job_environment WHERE singleton`;
      return isLegalStagingPreview({ host: req.headers?.host, environment: row?.environment,
        projectId: process.env.VERCEL_PROJECT_ID, development: process.env.NODE_ENV === 'development' });
    },
    async document(id, { version, language = 'en-GB', preview = false } = {}) {
      const [row] = await sql`SELECT document_id,version,language,kind,title,content,content_hash,status,effective_at
        FROM legal_documents WHERE document_id=${id} AND language=${language}
        AND (${version || null}::text IS NULL OR version=${version || null})
        AND effective_at<=now() AND (status='published' OR (${preview} AND status='staging_preview'))
        ORDER BY effective_at DESC, reviewed_at DESC LIMIT 1`;
      return row || null;
    },
    async records(userId) {
      const [acceptances, notices, preferences] = await Promise.all([
        sql`SELECT a.document_id,a.version,a.language,a.content_hash,a.kind,a.school_id,a.accepted_at,d.status
          FROM legal_acceptances a JOIN legal_documents d USING(document_id,version,language,content_hash)
          WHERE a.user_id=${userId} ORDER BY a.accepted_at DESC LIMIT 100`,
        sql`SELECT document_id,version,language,channel,delivered_at FROM privacy_notice_deliveries
          WHERE user_id=${userId} ORDER BY delivered_at DESC LIMIT 100`,
        sql`SELECT DISTINCT ON (purpose) purpose,selected,recorded_at FROM optional_preference_events
          WHERE user_id=${userId} ORDER BY purpose,id DESC`,
      ]);
      return { acceptances, notices, preferences: { ...defaultPreferences(), ...Object.fromEntries(preferences.map(p => [p.purpose, p.selected])) } };
    },
    async record(action, { preview = false } = {}) {
      if (action.action === 'optional_preference') {
        const rows = await sql`INSERT INTO optional_preference_events(user_id,purpose,selected,version,language)
          SELECT id,${action.purpose},false,${action.version},${action.language} FROM users
          WHERE id=${action.userId} AND deleted_at IS NULL AND disabled_at IS NULL AND NOT is_demo RETURNING user_id`;
        if (!rows.length) throw legalError('Account access has changed. Reload and try again.',409);
        return;
      }
      const kind = action.action === 'accept_school' ? 'school_processing' : action.action === 'accept_terms' ? 'terms' : 'privacy_notice';
      let rows;
      if (kind === 'privacy_notice') {
        rows = await sql`INSERT INTO privacy_notice_deliveries(user_id,document_id,version,language,content_hash,channel)
          SELECT u.id,d.document_id,d.version,d.language,d.content_hash,'legal_page'
          FROM users u CROSS JOIN legal_documents d
          WHERE u.id=${action.userId} AND u.deleted_at IS NULL AND u.disabled_at IS NULL AND NOT u.is_demo
          AND d.document_id=${action.documentId} AND d.version=${action.version} AND d.language=${action.language}
          AND d.content_hash=${action.contentHash} AND d.kind='privacy_notice' AND d.effective_at<=now()
          AND (d.status='published' OR (${preview} AND d.status='staging_preview'))
          ON CONFLICT DO NOTHING RETURNING user_id`;
      } else {
        rows = await sql`INSERT INTO legal_acceptances(user_id,document_id,version,language,content_hash,kind,school_id,membership_id)
          SELECT u.id,d.document_id,d.version,d.language,d.content_hash,d.kind,${action.schoolId || null}::uuid,${action.membershipId || null}::uuid
          FROM users u CROSS JOIN legal_documents d
          WHERE u.id=${action.userId} AND u.deleted_at IS NULL AND u.disabled_at IS NULL AND NOT u.is_demo
          AND d.document_id=${action.documentId} AND d.version=${action.version} AND d.language=${action.language}
          AND d.content_hash=${action.contentHash} AND d.kind=${kind} AND d.effective_at<=now()
          AND (d.status='published' OR (${preview} AND d.status='staging_preview'))
          AND (${kind}='terms' OR EXISTS (
            SELECT 1 FROM school_memberships m JOIN schools s ON s.id=m.school_id
            WHERE m.id=${action.membershipId || null}::uuid AND m.user_id=u.id AND m.school_id=${action.schoolId || null}::uuid
            AND m.status='active' AND s.deleted_at IS NULL AND s.workspace_status NOT IN ('closed','suspended')
            AND (s.owner_membership_id=m.id OR EXISTS(SELECT 1 FROM membership_roles r
              WHERE r.membership_id=m.id AND r.role='school_admin' AND r.revoked_at IS NULL))))
          ON CONFLICT DO NOTHING RETURNING user_id`;
      }
      // Repeated exact evidence is idempotent; loss of authority must not be
      // reported as a successful new agreement.
      if (!rows.length && kind !== 'privacy_notice') {
        const [prior] = await sql`SELECT id FROM legal_acceptances WHERE user_id=${action.userId}
          AND document_id=${action.documentId} AND version=${action.version} AND language=${action.language}
          AND school_id IS NOT DISTINCT FROM ${action.schoolId || null}::uuid`;
        if (!prior) throw legalError('The document or school authority has changed. Reload and try again.', 409);
      }
    },
  };
}
