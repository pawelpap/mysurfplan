import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareB5LegalDocument, prepareB5StagingTestDocument, legalContentHash } from '../lib/legal/b5-legal-preparation.mjs';
import { b5OldResourceSentence, b5StagingTestIntroduction } from '../lib/legal/b5-school-sections.mjs';
import { ownershipLegalLocales, ownershipPrivacySections, ownershipPrivacyVersion, ownershipStagingPrivacyVersion,
  prepareOwnershipPrivacyBundle, validateOwnershipPrivacyBundle } from '../lib/legal/b5-ownership-amendments.mjs';
import { ownershipPublicationOptions, assertOwnershipPolicyAdvance, assertOwnershipPublishedDocument,
  assertOwnershipTranslations } from '../lib/legal/b5-ownership-publication.mjs';
import { getStorageNotice } from '../lib/legal/storage-notice.mjs';
import { ownershipStorageSections, ownershipStorageVersion } from '../lib/legal/storage-ownership.mjs';

function sourceBundle() {
  const review = ownershipLegalLocales.flatMap(language => [false, true].map(school => {
    const content = 'Reviewed source body.\n\n' + (school ? 'Vercel, Neon, Zoho.' : b5OldResourceSentence[language]);
    return prepareB5LegalDocument({ document_id: school ? 'mywaveplan.school-processing' : 'mywaveplan.privacy',
      kind: school ? 'school_processing' : 'privacy_notice', version: school ? '2026-11-04.2' : '2026-11-11.1',
      language, title: 'Reviewed title', content, content_hash: legalContentHash(content) });
  }));
  return { schema: 1, review_version: '2026-11-11.2', staging_test_version: '2026-11-11.2-staging-test',
    review, staging_test: review.map(prepareB5StagingTestDocument) };
}

test('ownership preparation appends only the translated ownership section and preserves every .2 source', () => {
  const source = sourceBundle(), original = structuredClone(source), bundle = prepareOwnershipPrivacyBundle(source);
  assert.equal(validateOwnershipPrivacyBundle(bundle, source), bundle);
  assert.deepEqual(source, original);
  assertOwnershipTranslations(bundle.review); assertOwnershipTranslations(bundle.staging_test);
  for (const document of bundle.review) {
    const previous = source.review.find(row => row.document_id === document.document_id && row.language === document.language);
    const staged = bundle.staging_test.find(row => row.language === document.language);
    assert.equal(document.version, ownershipPrivacyVersion);
    assert.equal(document.content, previous.content + '\n\n' + ownershipPrivacySections[document.language]);
    assert.equal(document.source_version, previous.version); assert.equal(document.source_content_hash, previous.content_hash);
    assert.equal(document.content_hash, legalContentHash(document.content));
    assert.equal(staged.version, ownershipStagingPrivacyVersion);
    assert.equal(staged.content, b5StagingTestIntroduction[document.language] + '\n\n' + document.content);
    assert.equal(staged.source_version, '2026-11-11.2-staging-test');
    assert.equal(staged.source_content_hash, source.staging_test.find(row => row.document_id === document.document_id && row.language === document.language).content_hash);
    assert.match(ownershipPrivacySections[document.language], /30/); assert.match(ownershipPrivacySections[document.language], /Mailjet/);
  }
});

test('ownership validation refuses incomplete locales, changes outside the section, mixed sources and school-agreement additions', () => {
  for (const mutate of [
    value => value.review.pop(),
    value => { value.review[0].content = 'Replaced original'; value.review[0].content_hash = legalContentHash(value.review[0].content); },
    value => { value.review[0].source_version = '2026-11-11.1'; },
    value => { value.review[0].document_id = 'mywaveplan.school-processing'; },
    value => { value.review[0].language = 'de'; },
    value => { value.staging_test[0].content = value.review[0].content; },
    value => { value.staging_test[0].source_content_hash = '0'.repeat(64); },
    value => { value.review[0].status = 'published'; },
  ]) {
    const source = sourceBundle(), bundle = prepareOwnershipPrivacyBundle(source); mutate(bundle);
    assert.throws(() => validateOwnershipPrivacyBundle(bundle, source));
  }
});

test('publisher defaults to rollback and requires exact fingerprint and production approval for apply', () => {
  assert.deepEqual(ownershipPublicationOptions(['staging']), { environment: 'staging', action: '--rehearse', reviewedHash: undefined });
  const hash = 'a'.repeat(64);
  assert.equal(ownershipPublicationOptions(['staging', '--apply', '--reviewed-bundle-sha=' + hash]).reviewedHash, hash);
  for (const args of [[], ['rehearsal'], ['staging', '--apply'], ['staging', '--drop'],
    ['production', '--apply', '--reviewed-bundle-sha=' + hash],
    ['staging', '--apply', '--reviewed-bundle-sha=' + hash, '--reviewed-bundle-sha=' + 'b'.repeat(64)],
    ['staging', '--rehearse', '--unknown']]) assert.throws(() => ownershipPublicationOptions(args));
});

test('privacy advancement rejects agreement, readiness, provider approval, or unrelated policy changes', () => {
  const before = { singleton: true, enabled: false, provider_reviewed_at: null,
    required_privacy_version: '2026-11-11.2-staging-test', required_agreement_version: '2026-11-11.2-staging-test' };
  const after = { ...before, required_privacy_version: ownershipStagingPrivacyVersion };
  assert.doesNotThrow(() => assertOwnershipPolicyAdvance(before, after, 'staging'));
  assert.doesNotThrow(() => assertOwnershipPolicyAdvance(after, after, 'staging'));
  for (const modified of [{ ...after, enabled: true }, { ...after, provider_reviewed_at: new Date() },
    { ...after, required_agreement_version: ownershipStagingPrivacyVersion },
    { ...after, ready: true }, { ...after, required_privacy_version: ownershipPrivacyVersion }])
    assert.throws(() => assertOwnershipPolicyAdvance(before, modified, 'staging'));
  assert.throws(() => assertOwnershipPolicyAdvance({ ...before, required_privacy_version: 'unexpected' }, after, 'staging'));
  assert.throws(() => assertOwnershipPolicyAdvance(before, after, 'production'));
});

test('source/destination verification requires exact effective published body, environment and metadata', () => {
  const expected = prepareOwnershipPrivacyBundle(sourceBundle()).review[0];
  const published = { ...expected, status: 'published', environment: 'production', effective: true };
  assert.doesNotThrow(() => assertOwnershipPublishedDocument(published, expected, 'production'));
  for (const modified of [null, { ...published, content: 'Changed' }, { ...published, content_hash: '0'.repeat(64) },
    { ...published, version: '2026-11-11.2' }, { ...published, status: 'staging_preview' },
    { ...published, environment: 'staging' }, { ...published, effective: false }, { ...published, title: 'Changed' }])
    assert.throws(() => assertOwnershipPublishedDocument(modified, expected, 'production'));
});

test('browser-storage .1 and .2 records retain their exact pre-amendment fingerprints', () => {
  const hashes = {
    '2026-11-11.1': ['d8a37075dd239e6ec82be042842de270ab1fb153b2f88e7920300905d17ef906', '1f8b7a1ae139b73fd49a27bc47ada99786bf995e7cf92b9e62917183272423d3', 'fd2e39ce9d2abe405d03c6f26566c8910ec0e05ecf0e6b17e2ea3f476d3e5ffa', '3c6e64df0528d8c7797d769a0e696d7f7aea0850b9877fd4572ccdc1ec0bb229'],
    '2026-11-11.2': ['a8408bbe79c2cb503b33a52e38115b827b30b9440acb746d67087961f67ab5fd', 'f875b4e12c680cc755e53a8f063fa1d4f521cf8eed5bb8367a8c69b136fbea5c', '71369ca6c761c9803ffb1bec54f6041a290df5001d0e85d790b68a084402f860', '7e669d05341ac18d105bd9ec596f7d12c1af2086e40c2cbbc1f365673565f549'],
  };
  for (const [version, translations] of Object.entries(hashes)) ownershipLegalLocales.forEach((locale, index) => {
    const notice = getStorageNotice(version, locale);
    assert.equal(legalContentHash(JSON.stringify(notice)), translations[index]);
    assert.doesNotMatch(notice.content, /mywaveplan:ownership:v1/);
  });
});

test('new browser-storage disclosure has the separate key, bounded continuation and translated clearing/fallback rules', () => {
  const proof = {
    'en-GB': [/at most seven days/, /accept, decline or leave/, /invalid or expired/, /before navigation/, /reopen the original email/],
    'pt-PT': [/sete dias, no máximo/, /aceitar, recusar ou sair/, /inválido ou expirado/, /antes da navegação/, /volte a abrir o e-mail original/],
    es: [/siete días como máximo/, /aceptar, rechazar o salir/, /no válido o caducado/, /antes de navegar/, /vuelva a abrir el correo original/],
    fr: [/sept jours au maximum/, /acceptez, refusez ou quittez/, /non valide ou expiré/, /avant la navigation/, /rouvrez l’e-mail d’origine/],
  };
  for (const language of ownershipLegalLocales) {
    const current = getStorageNotice(undefined, language);
    assert.equal(current.version, ownershipStorageVersion);
    assert.equal(current.content, getStorageNotice('2026-11-11.2', language).content + '\n\n' + ownershipStorageSections[language]);
    assert.match(current.content, /mywaveplan:ownership:v1/);
    assert.match(current.content, /mywaveplan:invitation:v1/);
    for (const expression of proof[language]) assert.match(ownershipStorageSections[language], expression);
    assert.equal(getStorageNotice(ownershipStorageVersion, language).content, current.content);
    assert.equal(getStorageNotice(ownershipStorageVersion, language, { preview: true }).status, 'staging_preview');
  }
});
