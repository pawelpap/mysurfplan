import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { connect, fingerprint } from './membership-migration-support.mjs';
import { verifySchoolOnboarding } from './verify-school-onboarding.mjs';

const [environment, action = '--audit', ...flags] = process.argv.slice(2);
assert(['rehearsal', 'staging', 'production'].includes(environment), 'Specify the target environment');
assert(['--audit', '--rehearse', '--apply'].includes(action), 'Specify audit, rehearse or apply');
assert(action !== '--apply' || environment === 'rehearsal' || flags.includes(`--${environment}-approved`), 'Applying to staging or production requires explicit release approval');
const id = '20261111_school_onboarding';
const client = await connect(environment);
const additions = ['description', 'timezone', 'contact_phone', 'website', 'social_links', 'settings_revision', 'pilot_access_status'];
async function sourceFingerprint() {
  const values = await fingerprint(client);
  const schools = (await client.query(`SELECT 'schools' AS name,count(*)::int AS count,
    md5(COALESCE(jsonb_agg(row ORDER BY row::text),'[]'::jsonb)::text) AS digest
    FROM (SELECT to_jsonb(s)-$1::text[] AS row FROM schools s) q`, [additions])).rows[0];
  return values.map(value => value.name === 'schools' ? schools : value);
}
try {
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'");
  await client.query('SELECT pg_advisory_xact_lock(20261111)');
  await client.query('SELECT assert_membership_authority()');
  assert.equal((await client.query("SELECT count(*)::int AS n FROM identity_schema_migrations WHERE id=ANY($1::text[])",
    [['20261111_staff_invitations', '20261111_invitation_retention', '20261111_invitation_reissue']])).rows[0].n, 3,
    'Apply and verify the released B4 baseline before B5');
  const before = await sourceFingerprint();
  const ddl = await fs.readFile(new URL(`../db/migrations/${id}.sql`, import.meta.url), 'utf8');
  const checksum = createHash('sha256').update(ddl).digest('hex');
  const prior = (await client.query('SELECT checksum FROM identity_schema_migrations WHERE id=$1', [id])).rows[0];
  if (prior) assert.equal(prior.checksum, checksum, 'Migration checksum mismatch');
  if (!prior && action !== '--audit') {
    await client.query(ddl);
    await client.query('INSERT INTO identity_schema_migrations(id,checksum) VALUES($1,$2)', [id, checksum]);
  }
  let checks = [];
  if (action !== '--audit') {
    await client.query('SAVEPOINT synthetic_checks');
    checks = await verifySchoolOnboarding(client);
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    await client.query('ROLLBACK TO SAVEPOINT synthetic_checks');
    assert.deepEqual(await sourceFingerprint(), before, 'Existing application data changed');
  }
  await client.query(action === '--apply' ? 'COMMIT' : 'ROLLBACK');
  console.log(JSON.stringify({ environment, migration: id, action, previouslyInstalled: Boolean(prior), checks,
    existingDataUnchanged: action === '--audit' ? null : true }));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(JSON.stringify({ environment, migration: id, error: error.message, code: error.code }));
  process.exitCode = 1;
} finally { await client.end(); }
