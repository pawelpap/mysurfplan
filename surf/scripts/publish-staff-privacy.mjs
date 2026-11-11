import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { connect } from './membership-migration-support.mjs';
const [environment, action = '--rehearse', ...flags] = process.argv.slice(2);
assert(['staging', 'production'].includes(environment));
assert(['--rehearse', '--apply'].includes(action));
assert(environment !== 'production' || flags.includes('--production-approved'), 'Production requires release approval');
const client = await connect(environment);
try {
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
  assert.equal((await client.query('SELECT environment FROM job_environment WHERE singleton')).rows[0].environment, environment);
  const before = (await client.query('SELECT count(*)::int AS count FROM legal_acceptances')).rows[0].count;
  const documents = [];
  for (const language of ['en-GB', 'pt-PT', 'es', 'fr']) {
    const draft = JSON.parse(await fs.readFile(new URL(`../docs/private/b4-privacy-${language}.json`, import.meta.url), 'utf8'));
    assert.equal(draft.document_id, 'mywaveplan.privacy');
    assert.equal(draft.kind, 'privacy_notice');
    assert.equal(draft.language, language);
    assert.equal(draft.version, '2026-11-11.1');
    if (environment === 'production') {
      const [source] = (await client.query("SELECT content_hash FROM legal_documents WHERE document_id=$1 AND version='2026-11-04.4' AND language=$2 AND status='published'", [draft.document_id, language])).rows;
      assert.equal(source?.content_hash, draft.content_hash, 'Published source changed; review the amendment again');
    }
    const hash = createHash('sha256').update(draft.content).digest('hex');
    const [existing] = (await client.query('SELECT content_hash FROM legal_documents WHERE document_id=$1 AND version=$2 AND language=$3', [draft.document_id, draft.version, language])).rows;
    if (existing) assert.equal(existing.content_hash, hash, 'Document versions are immutable');
    else await client.query(`INSERT INTO legal_documents(document_id,version,language,title,kind,content,content_hash,status,environment,effective_at,reviewed_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())`, [draft.document_id, draft.version, language, draft.title,
      draft.kind, draft.content, hash, environment === 'staging' ? 'staging_preview' : 'published', environment]);
    documents.push({ language, version: draft.version, hash });
  }
  assert.equal((await client.query('SELECT count(*)::int AS count FROM legal_acceptances')).rows[0].count, before);
  await client.query(action === '--apply' ? 'COMMIT' : 'ROLLBACK');
  console.log(JSON.stringify({ environment, action, documents, acceptanceRecordsUnchanged: true }));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(JSON.stringify({ environment, error: error.message, code: error.code }));
  process.exitCode = 1;
} finally { await client.end(); }
