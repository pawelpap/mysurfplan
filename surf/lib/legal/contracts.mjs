import { isUuid } from '../school-access.mjs';

export const legalDocuments = Object.freeze([
  { id: 'mywaveplan.privacy', slug: 'privacy', title: 'Privacy notice', kind: 'privacy_notice' },
  { id: 'mywaveplan.adult-pilot-terms', slug: 'terms', title: 'Adult-pilot terms', kind: 'terms' },
  { id: 'mywaveplan.school-processing', slug: 'school-processing', title: 'School-processing agreement', kind: 'school_processing' },
]);
export const optionalPurposes = Object.freeze(['marketing', 'analytics', 'advertising', 'session_recording', 'public_ranking']);
export const preferenceVersion = 'optional-preferences/1';
export const defaultPreferences = () => Object.fromEntries(optionalPurposes.map(purpose => [purpose, false]));
export function legalError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}
export function validateLegalAction(body, session, document, { stagingPreview = false } = {}) {
  if (!session?.userId) throw legalError('Authentication required', 401);
  if (session.demo) throw legalError('Demo access is read-only.', 403);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw legalError('Invalid legal action.');
  if (body.action === 'optional_preference') {
    if (!optionalPurposes.includes(body.purpose) || typeof body.selected !== 'boolean' || body.version !== preferenceVersion || body.language !== 'en-GB')
      throw legalError('Invalid preference or version.');
    // No optional processing is available in A4/B6. A later reviewed release
    // must enable its purpose, notice and real withdrawal/identifier controls.
    if (body.selected) throw legalError('This optional purpose is not enabled.', 409);
    return { action: body.action, purpose: body.purpose, selected: false, version: preferenceVersion, language: body.language, userId: session.userId };
  }
  if (!['accept_terms', 'accept_school', 'notice_delivery'].includes(body.action)) throw legalError('Invalid legal action.');
  if (!document || !(document.status === 'published' || (stagingPreview && document.status === 'staging_preview')) || !document.effective_at || new Date(document.effective_at).getTime() > Date.now())
    throw legalError('This document is not available for acceptance or delivery.', 409);
  if (body.documentId !== document.document_id || body.version !== document.version || body.language !== document.language || body.contentHash !== document.content_hash)
    throw legalError('The document version or language has changed. Open the document again.', 409);
  const result = { action: body.action, userId: session.userId, documentId: document.document_id, version: document.version, language: document.language, contentHash: document.content_hash };
  if (body.action === 'notice_delivery') {
    if (document.kind !== 'privacy_notice') throw legalError('Only a privacy notice can have delivery evidence.');
    return result;
  }
  if (body.accepted !== true) throw legalError('Confirm acceptance of this document.');
  if (body.action === 'accept_terms') {
    if (document.kind !== 'terms' || body.schoolId !== undefined) throw legalError('Invalid terms scope.');
    return result;
  }
  if (document.kind !== 'school_processing' || !isUuid(body.schoolId)) throw legalError('Choose a school.');
  const relation = session.schools?.find(s => s.id === body.schoolId);
  // Platform authority alone cannot sign for a school. No ownership inference.
  if (!relation || relation.status !== 'active' || relation.open !== true ||
      !(relation.owner || relation.roles?.includes('school_admin')) || !isUuid(relation.membershipId))
    throw legalError('An active authorised school representative is required.', 403);
  if (body.authorisedRepresentative !== true) throw legalError('Confirm your authority to represent this school.');
  return { ...result, schoolId: relation.id, membershipId: relation.membershipId };
}

export function isLegalStagingPreview({ host, environment, projectId, development = false }) {
  const allowedHost = host === 'staging.mywaveplan.com' || (development && /^localhost(:\d+)?$/.test(host || ''));
  return allowedHost && environment === 'staging' &&
    (!projectId || projectId === 'prj_sWC9MbvG8rWtAO0YpuSNiOqZwYlO');
}
