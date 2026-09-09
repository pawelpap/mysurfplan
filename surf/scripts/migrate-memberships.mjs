// Defaults to a read-only audit. No implicit .env loading or production fallback.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { connect, environments, fingerprint, migrationId, report, sourceTables } from './membership-migration-support.mjs';

const [environment, action = '--audit'] = process.argv.slice(2);
assert(['--audit', '--rehearse', '--apply'].includes(action), 'Use --audit, --rehearse or --apply');
assert(action !== '--rehearse' || environment === 'rehearsal', 'Rollback rehearsal is restricted to the isolated branch');
const client = await connect(environment);
try {
  if (action === '--audit') {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    console.log(JSON.stringify({ environment, ...environments[environment], ...(await report(client)) }, null, 2));
    await client.query('COMMIT');
  } else {
    const sql = await fs.readFile(new URL(`../db/migrations/${migrationId}.sql`, import.meta.url), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '45s'");
    await client.query('SELECT pg_advisory_xact_lock(90490901)');
    await client.query(`CREATE TABLE IF NOT EXISTS identity_schema_migrations (
      id text PRIMARY KEY, checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
      applied_at timestamptz NOT NULL DEFAULT now())`);
    const prior = (await client.query('SELECT checksum FROM identity_schema_migrations WHERE id=$1', [migrationId])).rows[0];
    if (prior) {
      assert.equal(prior.checksum, checksum, 'Applied migration differs from this file; add a new migration instead of editing history');
      const audit = await report(client);
      assert.equal(audit.authority, 'legacy_shadow', 'B2 authority cutover has occurred; do not run B1 tooling');
      assert.equal(audit.shadowDifferences, 0, 'Legacy/shadow assignments have diverged');
      await client.query('ROLLBACK');
      console.log(JSON.stringify({ environment, migrationId, result: 'already applied; checksum and assignments verified' }));
    } else {
      // Prevent changes to source records between the fingerprint and backfill.
      // Existing schema modifications require stronger locks, acquired by ALTER.
      await client.query(`LOCK TABLE ${sourceTables.join(',')} IN SHARE ROW EXCLUSIVE MODE`);
      const before = await fingerprint(client);
      await client.query(sql);
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
      assert.deepEqual(await fingerprint(client), before, 'Migration must not change any existing source data');
      const audit = await report(client);
      assert.equal(audit.shadowDifferences, 0, 'Backfilled assignments do not match legacy roles');
      await client.query('INSERT INTO identity_schema_migrations(id,checksum) VALUES($1,$2)', [migrationId, checksum]);
      if (action === '--rehearse') {
        await client.query('ROLLBACK');
        assert.deepEqual(await fingerprint(client), before, 'Rollback changed source records');
        assert.equal((await client.query("SELECT to_regclass('public.school_memberships') AS name")).rows[0].name, null);
        console.log(JSON.stringify({ environment, migrationId, result: 'migration, backfill and full DDL rollback passed', sourceDataUnchanged: true, audit }, null, 2));
      } else {
        await client.query('COMMIT');
        console.log(JSON.stringify({ environment, migrationId, checksum, result: 'applied', sourceDataUnchanged: true, audit }, null, 2));
      }
    }
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Membership migration failed:', error.message, error.code || '');
  process.exitCode = 1;
} finally {
  await client.end();
}
