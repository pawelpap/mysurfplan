// Root release integration only. Defaults to rollback. No acceptance backfill.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { connect } from './membership-migration-support.mjs';
import { legalContentHash, validateB5LegalBundle } from '../lib/legal/b5-legal-preparation.mjs';

const [environment, action = '--rehearse', ...flags] = process.argv.slice(2);
assert(['staging', 'production'].includes(environment), 'Specify staging or production.');
assert(['--rehearse', '--apply'].includes(action), 'Specify --rehearse or --apply.');
assert(environment !== 'production' || flags.includes('--production-approved'), 'Production requires integrated owner approval.');
assert(flags.every(flag => flag === '--production-approved' || /^--reviewed-bundle-sha=[0-9a-f]{64}$/.test(flag)), 'Unexpected publication argument.');
const file = new URL('../docs/private/b5-legal-candidates.json', import.meta.url);
assert.equal((await fs.stat(file)).mode & 0o077, 0, 'Legal candidate file must be private.');
const bytes = await fs.readFile(file, 'utf8');
const bundleHash = legalContentHash(bytes);
if (action === '--apply') assert(flags.includes(`--reviewed-bundle-sha=${bundleHash}`), 'Apply requires the exact reviewed private bundle fingerprint.');
const bundle = validateB5LegalBundle(JSON.parse(bytes));
const documents = environment === 'staging' ? bundle.staging_test : bundle.review;
const client = await connect(environment);
async function evidenceFingerprint() {
  return (await client.query(`SELECT 'acceptances' AS name,count(*)::int AS count,
    md5(COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb)::text) AS digest FROM legal_acceptances a
    UNION ALL SELECT 'deliveries',count(*)::int,
    md5(COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.user_id,d.document_id,d.version,d.language,d.channel),'[]'::jsonb)::text) FROM privacy_notice_deliveries d`)).rows;
}
try {
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
  assert.equal((await client.query('SELECT environment FROM job_environment WHERE singleton')).rows[0].environment, environment, 'Database environment mismatch.');
  const before = await evidenceFingerprint();
  const originalDocuments = (await client.query('SELECT document_id,version,language,content_hash FROM legal_documents ORDER BY document_id,version,language')).rows;
  for (const document of documents) {
    const [source] = (await client.query(`SELECT content_hash FROM legal_documents WHERE document_id=$1 AND version=$2 AND language=$3`,
      [document.document_id, document.source_version, document.language])).rows;
    // A first production school agreement can have no earlier production record.
    // The explicit production approval covers the entire reviewed candidate.
    if (source) assert.equal(source.content_hash, document.source_content_hash, 'Legal source changed; prepare and review again.');
    else assert(environment === 'production' && document.document_id === 'mywaveplan.school-processing', 'Required legal source is absent.');
    const [existing] = (await client.query('SELECT content_hash,status,environment FROM legal_documents WHERE document_id=$1 AND version=$2 AND language=$3',
      [document.document_id, document.version, document.language])).rows;
    if (existing) {
      assert.equal(existing.content_hash, document.content_hash, 'Immutable destination differs.');
      assert.equal(existing.status, 'published', 'Destination publication state differs.');
      assert.equal(existing.environment, environment, 'Destination environment differs.');
    } else await client.query(`INSERT INTO legal_documents(document_id,version,language,title,kind,content,content_hash,status,environment,effective_at,reviewed_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,'published',$8,now(),now())`,
    [document.document_id,document.version,document.language,document.title,document.kind,document.content,document.content_hash,environment]);
  }
  const afterDocuments = (await client.query('SELECT document_id,version,language,content_hash FROM legal_documents ORDER BY document_id,version,language')).rows;
  const afterMap = new Map(afterDocuments.map(row => [[row.document_id,row.version,row.language].join(':'),row.content_hash]));
  assert(originalDocuments.every(row => afterMap.get([row.document_id,row.version,row.language].join(':')) === row.content_hash), 'Historical document evidence changed.');
  assert.deepEqual(await evidenceFingerprint(), before, 'Acceptance or privacy-delivery evidence changed.');
  await client.query(action === '--apply' ? 'COMMIT' : 'ROLLBACK');
  console.log(JSON.stringify({ environment, action, bundleSha256: bundleHash, documents: documents.map(({document_id,version,language,content_hash}) =>
    ({document_id,version,language,content_hash})), stagingNonBindingTestCopies: environment === 'staging', historicalDocumentsPreserved: true, evidenceUnchanged: true }));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(JSON.stringify({ environment, action, error: error.message, code: error.code }));
  process.exitCode = 1;
} finally { await client.end(); }
