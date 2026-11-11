// Root release integration only. Rolls back by default. Never backfills evidence.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { connect } from './membership-migration-support.mjs';
import { legalContentHash } from '../lib/legal/b5-legal-preparation.mjs';
import { ownershipSourceBundleHash, validateOwnershipPrivacyBundle } from '../lib/legal/b5-ownership-amendments.mjs';
import { ownershipPublicationOptions, ownershipPolicyVersions, assertOwnershipPublishedDocument,
  assertOwnershipPolicyAdvance, assertOwnershipTranslations } from '../lib/legal/b5-ownership-publication.mjs';

const { environment, action, reviewedHash } = ownershipPublicationOptions(process.argv.slice(2));
async function privateBytes(name) {
  const file = new URL(`../docs/private/${name}`, import.meta.url);
  assert.equal((await fs.stat(file)).mode & 0o077, 0, 'Legal bundle must be private.');
  return fs.readFile(file, 'utf8');
}
const sourceBytes = await privateBytes('b5-legal-candidates.json');
assert.equal(legalContentHash(sourceBytes), ownershipSourceBundleHash, 'Reviewed .2 source bundle changed.');
const sourceBundle = JSON.parse(sourceBytes);
const bytes = await privateBytes('b5-ownership-privacy-candidates.json');
const bundleHash = legalContentHash(bytes);
if (reviewedHash) assert.equal(reviewedHash, bundleHash, 'Private ownership bundle fingerprint differs.');
const bundle = validateOwnershipPrivacyBundle(JSON.parse(bytes), sourceBundle);
const documents = environment === 'staging' ? bundle.staging_test : bundle.review;
const sources = environment === 'staging' ? sourceBundle.staging_test : sourceBundle.review;
assertOwnershipTranslations(documents);
const versions = ownershipPolicyVersions(environment);
const client = await connect(environment);
const selectDocument = async document => (await client.query(`SELECT *,effective_at<=now() AS effective FROM legal_documents
  WHERE document_id=$1 AND version=$2 AND language=$3`, [document.document_id,document.version,document.language])).rows[0];
async function evidenceFingerprint() {
  const tables = ['legal_acceptances', 'privacy_notice_deliveries', 'optional_preference_events', 'school_ownership_acceptances'];
  const result = [];
  for (const table of tables) {
    if (!(await client.query('SELECT to_regclass($1) AS name', ['public.' + table])).rows[0].name) continue;
    result.push({ table, ...(await client.query(`SELECT count(*)::int AS count,
      md5(COALESCE(jsonb_agg(row ORDER BY row::text),'[]'::jsonb)::text) AS digest
      FROM (SELECT to_jsonb(t) AS row FROM ${table} t) rows`)).rows[0] });
  }
  return result;
}
try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
  assert.equal((await client.query('SELECT environment FROM job_environment WHERE singleton FOR SHARE')).rows[0]?.environment, environment, 'Database environment mismatch.');
  const evidenceBefore = await evidenceFingerprint();
  const originalDocuments = (await client.query(`SELECT document_id,version,language,md5(to_jsonb(d)::text) AS fingerprint
    FROM legal_documents d ORDER BY document_id,version,language`)).rows;
  // Lock only the two known singleton policies; preserve readiness/provider approval and agreement pointers.
  const policies = [];
  for (const table of ['school_geocoding_policy', 'school_onboarding_policy']) {
    const before = (await client.query(`SELECT * FROM ${table} WHERE singleton FOR UPDATE`)).rows[0];
    assert(before, 'Required singleton policy absent.');
    assertOwnershipPolicyAdvance(before, { ...before, required_privacy_version: versions.privacy }, environment);
    policies.push({ table, before });
  }
  // Exact .2 published privacy sources AND unchanged .2 school agreement must already exist.
  for (const source of sources) assertOwnershipPublishedDocument(await selectDocument(source), source, environment);
  for (const document of documents) {
    const existing = await selectDocument(document);
    if (existing) assertOwnershipPublishedDocument(existing, document, environment);
    else await client.query(`INSERT INTO legal_documents(document_id,version,language,title,kind,content,content_hash,status,environment,effective_at,reviewed_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,'published',$8,now(),now())`,
    [document.document_id,document.version,document.language,document.title,document.kind,document.content,document.content_hash,environment]);
  }
  // The four exact effective published rows must exist before either privacy pointer moves.
  for (const document of documents) assertOwnershipPublishedDocument(await selectDocument(document), document, environment);
  for (const { table, before } of policies) {
    const updated = await client.query(`UPDATE ${table} SET required_privacy_version=$1 WHERE singleton RETURNING *`, [versions.privacy]);
    assert.equal(updated.rowCount, 1, 'Expected one policy row.');
    assertOwnershipPolicyAdvance(before, updated.rows[0], environment);
  }
  const afterDocuments = (await client.query(`SELECT document_id,version,language,md5(to_jsonb(d)::text) AS fingerprint
    FROM legal_documents d ORDER BY document_id,version,language`)).rows;
  const key = row => JSON.stringify([row.document_id,row.version,row.language]);
  const afterMap = new Map(afterDocuments.map(row => [key(row), row.fingerprint]));
  assert(originalDocuments.every(row => afterMap.get(key(row)) === row.fingerprint), 'Historical document evidence changed.');
  const originalKeys = new Set(originalDocuments.map(key));
  const inserted = afterDocuments.filter(row => !originalKeys.has(key(row)));
  assert(inserted.length <= 4 && inserted.every(row => documents.some(document => key(document) === key(row))), 'Unexpected document insertion.');
  assert.deepEqual(await evidenceFingerprint(), evidenceBefore, 'Historical acceptance, choice or delivery evidence changed.');
  await client.query(action === '--apply' ? 'COMMIT' : 'ROLLBACK');
  console.log(JSON.stringify({ environment, action, bundleSha256: bundleHash, sourceBundleSha256: ownershipSourceBundleHash,
    documents: documents.map(({document_id,version,language,content_hash}) => ({document_id,version,language,content_hash})),
    requiredPrivacyVersion: versions.privacy, requiredAgreementVersion: versions.agreement,
    historicalDocumentsPreserved: true, evidenceUnchanged: true, otherPolicyFieldsUnchanged: true,
    stagingNonBindingTestCopies: environment === 'staging' }));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(JSON.stringify({ environment, action, error: error.message, code: error.code }));
  process.exitCode = 1;
} finally { await client.end(); }
