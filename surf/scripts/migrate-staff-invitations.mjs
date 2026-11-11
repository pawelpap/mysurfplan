import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { connect, fingerprint } from './membership-migration-support.mjs';
import { verifyStaffInvitations } from './verify-staff-invitations.mjs';
import { verifyInvitationRetention } from './verify-invitation-retention.mjs';

const [environment, action = '--audit', ...flags] = process.argv.slice(2);
assert(['rehearsal', 'staging', 'production'].includes(environment), 'Specify the target environment');
assert(environment !== 'production' || flags.includes('--production-approved'), 'Production requires explicit release approval');
assert(['--audit', '--rehearse', '--apply'].includes(action));
const client = await connect(environment);
const id = '20261111_staff_invitations';
const prerequisites = ['20261006_legal_evidence', '20261104_preferred_locale', '20261104_french_locale',
  '20261104_account_registration', '20261104_account_lifecycle', '20261104_account_activity_notices'];
async function sourceFingerprint() {
  const data = await fingerprint(client);
  // Older rehearsal schema lacks these additive nullable account fields.
  const [users] = (await client.query(`SELECT 'users' AS name,count(*)::int AS count,
    md5(COALESCE(jsonb_agg(row ORDER BY row::text),'[]'::jsonb)::text) AS digest
    FROM (SELECT to_jsonb(u)-ARRAY['preferred_locale','adult_attested_at','self_closed_at'] AS row FROM users u) q`)).rows;
  return data.map(value => value.name === 'users' ? users : value);
}
try {
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'");
  await client.query('SELECT pg_advisory_xact_lock(20261111)');
  const before = await sourceFingerprint();
  for (const migration of [...prerequisites, id, '20261111_invitation_retention', '20261111_invitation_reissue']) {
    const ddl = await fs.readFile(new URL(`../db/migrations/${migration}.sql`, import.meta.url), 'utf8');
    const checksum = createHash('sha256').update(ddl).digest('hex');
    const [prior] = (await client.query('SELECT checksum FROM identity_schema_migrations WHERE id=$1', [migration])).rows;
    if (prior) { assert.equal(prior.checksum, checksum, `Checksum mismatch: ${migration}`); continue; }
    // The November locale rollout predates ledger entries for its two files.
    // Verify the deployed structure without replaying DDL or inventing history.
    if (environment !== 'rehearsal' && ['20261104_preferred_locale', '20261104_french_locale'].includes(migration)) {
      const [locale] = (await client.query(`SELECT EXISTS(SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' AND column_name='preferred_locale' AND data_type='text') AS column_ok,
        (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='users'::regclass
          AND conname='chk_users_preferred_locale') AS rule`)).rows;
      assert(locale.column_ok && ['en-GB', 'pt-PT', 'es', 'fr'].every(value => locale.rule?.includes("'" + value + "'")),
        'Locale prerequisite does not match the deployed four-language contract');
      continue;
    }
    assert(environment === 'rehearsal' || [id, '20261111_invitation_retention', '20261111_invitation_reissue'].includes(migration), `Missing staging prerequisite: ${migration}`);
    if (action === '--audit') continue;
    await client.query(ddl);
    await client.query('INSERT INTO identity_schema_migrations(id,checksum) VALUES($1,$2)', [migration, checksum]);
  }
  let checks = [];
  if (action !== '--audit') {
    await client.query('SAVEPOINT synthetic_checks');
    checks = [...await verifyStaffInvitations(client), ...await verifyInvitationRetention(client)];
    await client.query('ROLLBACK TO SAVEPOINT synthetic_checks');
    assert.deepEqual(await sourceFingerprint(), before, 'Existing application data changed');
  }
  await client.query(action === '--apply' ? 'COMMIT' : 'ROLLBACK');
  console.log(JSON.stringify({ environment, migration: id, action, existingDataUnchanged: true, checks }));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(JSON.stringify({ environment, migration: id, error: error.message, code: error.code }));
  process.exitCode = 1;
} finally { await client.end(); }
