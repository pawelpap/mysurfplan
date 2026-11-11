// Read-only source export and private candidate preparation. Never publishes.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { connect } from './membership-migration-support.mjs';
import { geoapifyLegalLocales } from '../lib/legal/geoapify-amendments.mjs';
import { prepareB5LegalDocument, prepareB5StagingTestDocument, legalContentHash } from '../lib/legal/b5-legal-preparation.mjs';
import { b5LegalVersion, b5StagingLegalVersion } from '../lib/legal/b5-school-sections.mjs';

assert.equal(process.argv.length, 2, 'This read-only command takes no environment or publication arguments.');
const directory = new URL('../docs/private/', import.meta.url);
const client = await connect('staging');
try {
  await client.query('BEGIN READ ONLY');
  assert.equal((await client.query('SELECT environment FROM job_environment WHERE singleton')).rows[0].environment, 'staging');
  const sources = (await client.query(`SELECT document_id,version,language,title,kind,content,content_hash,status,environment
    FROM legal_documents WHERE (document_id='mywaveplan.privacy' AND version='2026-11-11.1')
    OR (document_id='mywaveplan.school-processing' AND version='2026-11-04.2') ORDER BY document_id,language`)).rows;
  assert.equal(sources.length, 8, 'Expected all eight exact translated sources.');
  for (const id of ['mywaveplan.privacy', 'mywaveplan.school-processing'])
    assert.deepEqual(sources.filter(source => source.document_id === id).map(source => source.language).sort(), [...geoapifyLegalLocales].sort());
  await client.query('ROLLBACK');
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.writeFile(new URL('b5-legal-sources.json', directory), JSON.stringify(sources, null, 2) + '\n', { mode: 0o600 });
  const review = sources.map(prepareB5LegalDocument);
  const bundle = { schema: 1, prepared_at: new Date().toISOString(), review_version: b5LegalVersion,
    staging_test_version: b5StagingLegalVersion, review, staging_test: review.map(prepareB5StagingTestDocument) };
  const bytes = JSON.stringify(bundle, null, 2) + '\n';
  await fs.writeFile(new URL('b5-legal-candidates.json', directory), bytes, { mode: 0o600 });
  console.log(JSON.stringify({ prepared: true, reviewVersion: b5LegalVersion, stagingTestVersion: b5StagingLegalVersion,
    documentsPerEnvironment: review.length, languages: geoapifyLegalLocales, bundleSha256: legalContentHash(bytes), published: false }));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(JSON.stringify({ prepared: false, error: error.message }));
  process.exitCode = 1;
} finally { await client.end(); }
