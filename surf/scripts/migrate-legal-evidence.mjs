import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { connect, fingerprint } from './membership-migration-support.mjs';
import { verifyLegalSchema } from './verify-legal-schema.mjs';

const [environment, action = '--audit', ...flags] = process.argv.slice(2);
assert(['--audit','--apply','--rehearse'].includes(action));
assert(action !== '--rehearse' || environment === 'rehearsal');
assert(environment !== 'production' || flags.includes('--production-approved'), 'Production needs separate owner approval');
assert(!flags.includes('--staging-content') || environment === 'staging');
const id = '20261006_legal_evidence';
const client = await connect(environment);
try {
  const ddl = await fs.readFile(new URL(`../db/migrations/${id}.sql`,import.meta.url),'utf8');
  const checksum = createHash('sha256').update(ddl).digest('hex');
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='45s'");
  await client.query('SELECT pg_advisory_xact_lock(90491006)');
  const before = await fingerprint(client);
  const [prior] = (await client.query('SELECT checksum FROM identity_schema_migrations WHERE id=$1',[id])).rows;
  if (prior) assert.equal(prior.checksum,checksum,'Applied migration checksum mismatch');
  else if (action !== '--audit') {
    await client.query(ddl);
    await client.query('INSERT INTO identity_schema_migrations(id,checksum) VALUES($1,$2)',[id,checksum]);
  }
  let verified = null;
  if (action !== '--audit') {
    await client.query('SAVEPOINT synthetic_checks');
    verified = await verifyLegalSchema(client);
    await client.query('ROLLBACK TO SAVEPOINT synthetic_checks');
  }
  if (flags.includes('--staging-content') && action === '--apply') {
    const [binding] = (await client.query('SELECT environment FROM job_environment')).rows;
    assert.equal(binding.environment,'staging');
    const docs = JSON.parse(await fs.readFile(new URL('../docs/private/legal-staging-documents.json',import.meta.url),'utf8'));
    assert.equal(docs.length,3);
    for (const d of docs) {
      const hash = createHash('sha256').update(d.content).digest('hex');
      const [existing] = (await client.query('SELECT content_hash FROM legal_documents WHERE document_id=$1 AND version=$2 AND language=$3',[d.id,d.version,d.language])).rows;
      if (existing) assert.equal(existing.content_hash,hash,'Use a new version for changed text');
      else await client.query(`INSERT INTO legal_documents(document_id,version,language,kind,title,content,content_hash,status,environment,effective_at,reviewed_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,'staging_preview','staging',$8,$8)`,[d.id,d.version,d.language,d.kind,d.title,d.content,hash,d.preparedAt]);
    }
  }
  assert.deepEqual(await fingerprint(client),before,'Existing application data changed');
  await client.query(action==='--apply'?'COMMIT':'ROLLBACK');
  console.log(JSON.stringify({environment,id,checksum,state:prior?'already_applied':action==='--apply'?'applied':action==='--rehearse'?'ddl_rollback_verified':'not_applied',syntheticChecks:verified,existingDataUnchanged:true,stagingDocuments:flags.includes('--staging-content')?3:0}));
} catch(error) {
  await client.query('ROLLBACK').catch(()=>{});
  console.error('Legal migration failed',error.code || error.message);
  process.exitCode=1;
} finally {await client.end();}
