import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { prepareGeoapifyAmendment, geoapifyLegalLocales, geoapifyPrivacySections, geoapifySchoolProcessingSections } from '../lib/legal/geoapify-amendments.mjs';
import { getStorageNotice } from '../lib/legal/storage-notice.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
function source(language, school = false) {
  const content = 'Existing reviewed document text.\nDo not replace this evidence.';
  return Object.freeze({
    document_id: school ? 'mywaveplan.school-processing' : 'mywaveplan.privacy',
    version: school ? '2026-11-04.2' : '2026-11-11.1', language,
    kind: school ? 'school_processing' : 'privacy_notice', title: 'Existing title',
    content, content_hash: hash(content), status: 'published', effective_at: '2026-11-11',
  });
}

test('Geoapify preparation preserves exact historical text and creates unpublished candidates in all supported languages', () => {
  for (const language of geoapifyLegalLocales) for (const school of [false, true]) {
    const original = source(language, school);
    const candidate = prepareGeoapifyAmendment(original, { version: '2026-11-11.2' });
    assert.equal(candidate.content.slice(0, original.content.length), original.content);
    assert.equal(candidate.source_content_hash, original.content_hash);
    assert.equal(candidate.source_version, original.version);
    assert.equal(candidate.content_hash, hash(candidate.content));
    assert.equal(candidate.language, language);
    assert.equal(candidate.document_id, original.document_id);
    assert.equal(candidate.title, original.title);
    assert.equal(candidate.status, undefined);
    assert.equal(candidate.effective_at, undefined);
    assert.notEqual(candidate.content_hash, original.content_hash);
    assert.equal(original.content_hash, hash(original.content));
    assert.doesNotMatch(candidate.content, /ppaplin@gmail\.com/);
  }
});

test('preparation rejects tampered, stale, unsupported and repeated sources', () => {
  const original = source('en-GB');
  for (const change of [
    { content: 'tampered' }, { content_hash: undefined }, { version: '2026-10-06.3' },
    { language: 'de' }, { document_id: 'mywaveplan.adult-pilot-terms' }, { kind: 'terms' },
  ]) assert.throws(() => prepareGeoapifyAmendment({ ...original, ...change }, { version: '2026-11-11.2' }));
  for (const version of [undefined, '', 'same', original.version])
    assert.throws(() => prepareGeoapifyAmendment(original, { version }));
  const content = original.content + '\nGeoapify already reviewed.';
  assert.throws(() => prepareGeoapifyAmendment({ ...original, content, content_hash: hash(content) }, { version: '2026-11-11.2' }));
});

test('B5 resource notice preserves historical invitation storage text', () => {
  for (const language of geoapifyLegalLocales) {
    const notice = getStorageNotice(undefined, language);
    assert.equal(notice.version, '2026-11-11.2');
    assert.doesNotMatch(notice.content, /Geoapify/);
    assert.match(getStorageNotice('2026-11-11.1', language).content, /mywaveplan:invitation:v1/);
  }
});

test('each translation carries the same recipient, retention, optionality and publication boundaries', () => {
  const localeProofs = {
    'en-GB': { manual: /Manual entry remains available/, publication: /A lookup does not publish the address/, exception: /two months/, school: /does not authorise sending staff or customer records/ },
    'pt-PT': { manual: /introduzir a localização manualmente/, publication: /Uma pesquisa não publica a morada/, exception: /dois meses/, school: /Não autoriza o envio de registos de trabalhadores ou clientes/ },
    es: { manual: /La introducción manual sigue disponible/, publication: /Una búsqueda no publica la dirección/, exception: /dos meses/, school: /No autoriza el envío de registros de personal o clientes/ },
    fr: { manual: /La saisie manuelle reste possible/, publication: /Une recherche ne publie pas l’adresse/, exception: /deux mois/, school: /n’autorise pas l’envoi de dossiers du personnel ou des clients/ },
  };
  for (const language of geoapifyLegalLocales) {
    const privacy = geoapifyPrivacySections[language];
    const school = geoapifySchoolProcessingSections[language];
    const proof = localeProofs[language];
    assert.match(privacy, /Geoapify \(KEPTAGO LTD,/);
    assert.match(school, /Geoapify \(KEPTAGO LTD,/);
    assert.match(privacy, /24/);
    assert.match(privacy, proof.exception);
    assert.match(privacy, proof.manual);
    assert.match(privacy, proof.publication);
    assert.match(school, proof.school);
    assert.match(privacy, /https:\/\/www\.geoapify\.com\/data-processing-agreement\//);
    assert.match(privacy, /https:\/\/www\.geoapify\.com\/privacy-policy\//);
    if (language !== 'en-GB') {
      assert.notEqual(privacy, geoapifyPrivacySections['en-GB']);
      assert.notEqual(school, geoapifySchoolProcessingSections['en-GB']);
      assert.doesNotMatch(privacy, /Optional school-address lookup/);
    }
  }
});
