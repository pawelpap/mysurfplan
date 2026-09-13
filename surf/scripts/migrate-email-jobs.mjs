import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { connect } from './membership-migration-support.mjs';

const [environment, action = '--audit'] = process.argv.slice(2);
assert(['--audit','--apply','--rehearse'].includes(action));
assert(action !== '--rehearse' || environment === 'rehearsal');
const id = '20260913_email_outbox';
const client = await connect(environment);
try {
  const sql = await fs.readFile(new URL(`../db/migrations/${id}.sql`, import.meta.url), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='45s'");
  await client.query('SELECT pg_advisory_xact_lock(90490901)');
  const prior = (await client.query('SELECT checksum FROM identity_schema_migrations WHERE id=$1', [id])).rows[0];
  if (prior) {
    assert.equal(prior.checksum, checksum, 'Applied migration checksum mismatch');
    const [{ environment: actual }] = (await client.query('SELECT environment FROM job_environment')).rows;
    assert.equal(actual, environment === 'production' ? 'production' : 'staging');
  } else if (action !== '--audit') {
    await client.query(sql);
    await client.query('INSERT INTO job_environment(environment) VALUES($1)', [environment === 'production' ? 'production' : 'staging']);
    await client.query('INSERT INTO identity_schema_migrations(id,checksum) VALUES($1,$2)', [id, checksum]);
  }
  await client.query(action === '--apply' ? 'COMMIT' : 'ROLLBACK');
  console.log(JSON.stringify({ environment, id, checksum, state: prior ? 'already_applied' : action === '--apply' ? 'applied' : action === '--rehearse' ? 'ddl_rollback_verified' : 'not_applied' }));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Email migration failed', error.code || 'validation_failed');
  process.exitCode = 1;
} finally { await client.end(); }
