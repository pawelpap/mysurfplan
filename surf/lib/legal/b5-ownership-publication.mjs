import assert from 'node:assert/strict';
import { legalContentHash } from './b5-legal-preparation.mjs';
import { ownershipLegalLocales, ownershipPrivacyVersion, ownershipStagingPrivacyVersion } from './b5-ownership-amendments.mjs';

export function ownershipPublicationOptions(args) {
  const [environment, action = '--rehearse', ...flags] = args;
  assert(['staging', 'production'].includes(environment), 'Specify staging or production.');
  assert(['--rehearse', '--apply'].includes(action), 'Specify --rehearse or --apply.');
  assert.equal(new Set(flags).size, flags.length, 'Duplicate publication flag.');
  assert(flags.every(flag => flag === '--production-approved' || /^--reviewed-bundle-sha=[0-9a-f]{64}$/.test(flag)), 'Unexpected publication flag.');
  assert(flags.filter(flag => flag.startsWith('--reviewed-bundle-sha=')).length <= 1, 'Conflicting bundle fingerprints.');
  assert(environment !== 'production' || flags.includes('--production-approved'), 'Production requires integrated owner approval.');
  const reviewedHash = flags.find(flag => flag.startsWith('--reviewed-bundle-sha='))?.split('=')[1];
  assert(action !== '--apply' || reviewedHash, 'Apply requires the exact reviewed private bundle fingerprint.');
  return { environment, action, reviewedHash };
}

export function ownershipPolicyVersions(environment) {
  assert(['staging', 'production'].includes(environment), 'Unexpected environment.');
  return { agreement: environment === 'staging' ? '2026-11-11.2-staging-test' : '2026-11-11.2',
    privacy: environment === 'staging' ? ownershipStagingPrivacyVersion : ownershipPrivacyVersion };
}

export function assertOwnershipPublishedDocument(row, expected, environment) {
  assert(row, 'Required published document is absent.');
  for (const key of ['document_id', 'version', 'language', 'kind', 'title', 'content_hash'])
    assert.equal(row[key], expected[key], 'Published document does not match the exact reviewed source.');
  assert.equal(legalContentHash(row.content), expected.content_hash, 'Published body fingerprint differs.');
  assert.equal(row.status, 'published', 'Document is not published.');
  assert.equal(row.environment, environment, 'Document environment mismatch.');
  assert.equal(row.effective, true, 'Document is not yet effective.');
}

export function assertOwnershipPolicyAdvance(before, after, environment) {
  const versions = ownershipPolicyVersions(environment);
  assert.equal(before.required_agreement_version, versions.agreement, 'School agreement must remain on the exact .2 version.');
  assert([versions.agreement, versions.privacy].includes(before.required_privacy_version), 'Unexpected original privacy pointer.');
  assert.equal(after.required_privacy_version, versions.privacy, 'Privacy pointer was not advanced.');
  const withoutPrivacy = row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'required_privacy_version'));
  assert.deepEqual(withoutPrivacy(after), withoutPrivacy(before), 'A policy field other than required_privacy_version changed.');
}

export function assertOwnershipTranslations(documents) {
  assert.equal(documents.length, 4, 'Exactly four privacy documents required.');
  assert.deepEqual(documents.map(row => row.language).sort(), [...ownershipLegalLocales].sort(), 'Four exact translations required.');
  assert(documents.every(row => row.document_id === 'mywaveplan.privacy'), 'Ownership publication is privacy-only.');
}
