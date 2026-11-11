import assert from 'node:assert/strict';
import { connect } from './membership-migration-support.mjs';
import { verifyStaffInvitations } from './verify-staff-invitations.mjs';
import { verifyInvitationRetention } from './verify-invitation-retention.mjs';

assert(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === 'rehearsal'),
  'Usage: node scripts/check-school-onboarding-regressions.mjs [rehearsal]');
const client = await connect('rehearsal');
const tables = ['users','schools','school_memberships','membership_roles','platform_role_assignments','coaches','students',
  'lessons','bookings','school_invitations','school_access_events','job_outbox','legal_acceptances','school_creation_requests','school_operating_spots'];
const fingerprint = async () => (await client.query(tables.map(table => `SELECT '${table}' AS name,count(*)::int AS count,
  md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb)::text) AS digest FROM ${table} t`).join(' UNION ALL '))).rows;
try {
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'");
  const before = await fingerprint();
  const results = [];
  for (const selfService of [false, true]) {
    await client.query('SAVEPOINT regression');
    const checks = await verifyStaffInvitations(client, { selfService });
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    await client.query('ROLLBACK TO SAVEPOINT regression');
    results.push({ kind: selfService ? 'approved_active_self_service' : 'legacy', checks });
  }
  await client.query('SAVEPOINT retention');
  const checks = await verifyInvitationRetention(client);
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('ROLLBACK TO SAVEPOINT retention');
  results.push({ kind: 'retention', checks });
  assert.deepEqual(await fingerprint(), before, 'Regression fixtures changed existing data');
  await client.query('ROLLBACK');
  console.log(JSON.stringify({ environment:'rehearsal', existingDataUnchanged:true, results }));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally { await client.end(); }
