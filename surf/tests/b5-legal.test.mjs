import test from 'node:test';
import assert from 'node:assert/strict';
import { b5LegalVersion, b5StagingLegalVersion, b5OldResourceSentence, b5StagingTestIntroduction } from '../lib/legal/b5-school-sections.mjs';
import { geoapifyLegalLocales } from '../lib/legal/geoapify-amendments.mjs';
import { prepareB5LegalDocument, prepareB5StagingTestDocument, validateB5LegalBundle, legalContentHash } from '../lib/legal/b5-legal-preparation.mjs';
import { getStorageNotice } from '../lib/legal/storage-notice.mjs';

function source(language, school) {
  const content = 'Existing reviewed content.\n\n' + (school ? 'Vercel, Neon, Zoho.' : b5OldResourceSentence[language]);
  return { document_id: school ? 'mywaveplan.school-processing' : 'mywaveplan.privacy',
    kind: school ? 'school_processing' : 'privacy_notice', version: school ? '2026-11-04.2' : '2026-11-11.1',
    language, title: 'Existing title', content, content_hash: legalContentHash(content) };
}
function bundle() {
  const review = geoapifyLegalLocales.flatMap(language => [false,true].map(school => prepareB5LegalDocument(source(language,school))));
  return { schema:1,review_version:b5LegalVersion,staging_test_version:b5StagingLegalVersion,review,staging_test:review.map(prepareB5StagingTestDocument) };
}

test('B5 creates complete new review texts and separately labelled non-binding staging copies in all four languages', () => {
  const prepared = bundle();
  assert.equal(validateB5LegalBundle(prepared), prepared);
  for (const row of prepared.review) {
    assert.match(row.content,/Geoapify/); assert.match(row.content,/Vercel Blob/);
    assert.match(row.content,/24/); assert.match(row.content,/30/);
    assert.equal(row.content_hash,legalContentHash(row.content));
    assert.doesNotMatch(row.content,/Staging test document|Documento de teste em staging|Documento de prueba en staging|Document de test en staging/);
    const staged = prepared.staging_test.find(testRow => testRow.document_id===row.document_id&&testRow.language===row.language);
    assert.equal(staged.version,b5StagingLegalVersion);
    assert.equal(staged.review_content_hash,row.content_hash);
    assert.equal(staged.content,b5StagingTestIntroduction[row.language]+'\n\n'+row.content);
    if (row.kind==='privacy_notice') assert.doesNotMatch(row.content,new RegExp(b5OldResourceSentence[row.language].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    else assert.match(row.content,/Mailjet/);
  }
});

test('B5 rejects partial or mixed translations, wrong test prefixes, tampering and accidental publication metadata', () => {
  for (const mutate of [
    value=>value.review.pop(),
    value=>{value.review[1]=value.review[0];},
    value=>{value.review[0].content+='tampered';},
    value=>{value.review[0].status='published';},
    value=>{value.review[0].environment='production';},
    value=>{value.staging_test[0].content=value.review[0].content;},
    value=>{value.staging_test[0].language='de';},
    value=>{value.staging_test[0].review_content_hash='0'.repeat(64);},
  ]) { const value=bundle();mutate(value);assert.throws(()=>validateB5LegalBundle(value)); }
});

test('new storage notices disclose explicit map loading, browser cache, private media and delayed cleanup without rewriting old versions', () => {
  const proofs = {
    'en-GB': [/only after you choose to load it/,/does not request your device's GPS/,/HTTP cache/,/does not instantly erase/,/live reference/],
    'pt-PT': [/depois de escolher carregá-lo/,/não pede a localização GPS/,/cache HTTP/,/não apaga imediatamente/,/referência ativa/],
    es: [/después de que elija cargarlo/,/no solicita la ubicación GPS/,/caché HTTP/,/no borra inmediatamente/,/referencia activa/],
    fr: [/après votre choix de la charger/,/ne demande pas la position GPS/,/cache HTTP/,/n’efface pas immédiatement/,/référence active/],
  };
  for (const language of geoapifyLegalLocales) {
    const current=getStorageNotice(b5LegalVersion,language),old=getStorageNotice('2026-11-11.1',language);
    assert.equal(current.version,b5LegalVersion);assert.equal(current.language,language);
    assert.match(current.content,/Vercel Blob/);assert.match(current.content,/24/);assert.match(current.content,/30/);
    for(const proof of proofs[language])assert.match(current.content,proof);
    assert.match(current.content,/https:\/\/osmfoundation.org\/wiki\/Privacy_Policy/);
    assert.equal(old.version,'2026-11-11.1');assert.doesNotMatch(old.content,/Vercel Blob/);
    assert.match(old.content,/mywaveplan:invitation:v1/);
    assert.equal(getStorageNotice(b5LegalVersion,language).content,current.content);
  }
});
