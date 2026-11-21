import { createHash } from 'node:crypto';
import { prepareGeoapifyAmendment } from './geoapify-amendments.mjs';
import { geoapifyLegalLocales } from './geoapify-amendments.mjs';
import { b5LegalVersion, b5StagingLegalVersion, b5ResourceSections, b5SchoolProviderSections,
  b5OldResourceSentence, b5NewResourceSentence, b5StagingTestIntroduction } from './b5-school-sections.mjs';

export const legalContentHash = content => createHash('sha256').update(content).digest('hex');

export function prepareB5LegalDocument(source) {
  const candidate = prepareGeoapifyAmendment(source, { version: b5LegalVersion });
  if (source.document_id === 'mywaveplan.privacy') {
    const old = b5OldResourceSentence[source.language];
    if (candidate.content.split(old).length !== 2)
      throw new Error(`Review the existing resource description for ${source.language}.`);
    candidate.content = candidate.content.replace(old, b5NewResourceSentence[source.language]) + '\n\n' + b5ResourceSections[source.language];
  } else candidate.content += '\n\n' + b5SchoolProviderSections[source.language];
  candidate.content_hash = legalContentHash(candidate.content);
  return candidate;
}

export function prepareB5StagingTestDocument(candidate) {
  if (candidate.version !== b5LegalVersion || !b5StagingTestIntroduction[candidate.language] ||
      legalContentHash(candidate.content) !== candidate.content_hash)
    throw new Error('Unexpected B5 review candidate.');
  const content = b5StagingTestIntroduction[candidate.language] + '\n\n' + candidate.content;
  return { ...candidate, version: b5StagingLegalVersion, content, content_hash: legalContentHash(content),
    review_version: candidate.version, review_content_hash: candidate.content_hash };
}

export function validateB5LegalBundle(bundle) {
  if (bundle?.schema !== 1 || bundle.review_version !== b5LegalVersion || bundle.staging_test_version !== b5StagingLegalVersion ||
      !Array.isArray(bundle.review) || bundle.review.length !== 8 || !Array.isArray(bundle.staging_test) || bundle.staging_test.length !== 8)
    throw new Error('Unexpected B5 legal bundle.');
  const keys = new Set();
  for (const candidate of bundle.review) {
    const school = candidate.document_id === 'mywaveplan.school-processing';
    if (!(school || candidate.document_id === 'mywaveplan.privacy') || candidate.kind !== (school ? 'school_processing' : 'privacy_notice') ||
        candidate.version !== b5LegalVersion || !geoapifyLegalLocales.includes(candidate.language) ||
        typeof candidate.title !== 'string' || !candidate.title.trim() || typeof candidate.content !== 'string' ||
        legalContentHash(candidate.content) !== candidate.content_hash || !/^[0-9a-f]{64}$/.test(candidate.source_content_hash || '') ||
        candidate.source_version !== (school ? '2026-11-04.2' : '2026-11-11.1') ||
        Object.hasOwn(candidate, 'status') || Object.hasOwn(candidate, 'environment') || Object.hasOwn(candidate, 'effective_at'))
      throw new Error('Unexpected B5 review document.');
    const key = candidate.document_id + ':' + candidate.language;
    if (keys.has(key)) throw new Error('Duplicate translated B5 document.');
    keys.add(key);
    const matches = bundle.staging_test.filter(row => row.document_id === candidate.document_id && row.language === candidate.language);
    const expected = prepareB5StagingTestDocument(candidate);
    if (matches.length !== 1 || JSON.stringify(matches[0]) !== JSON.stringify(expected))
      throw new Error('Staging test copy does not match the reviewed body and translated prefix.');
  }
  return bundle;
}
