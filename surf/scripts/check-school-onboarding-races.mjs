import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { connect } from './membership-migration-support.mjs';

// Rehearsal only: committed exact-ID fixtures are required for real row locks.
assert(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === 'rehearsal'),
  'Usage: node scripts/check-school-onboarding-races.mjs [rehearsal]');
const clients = [], users = [], checks = [];
const prefix = `b5-race-${randomUUID()}`;
const row = async (client, q, values = []) => (await client.query(q, values)).rows[0];
const scalar = async (client, q, values = []) => Object.values(await row(client, q, values))[0];
const observe = promise => promise.then(value => ({ ok: true, value }), error => ({ ok: false, error }));
const settings = suffix => ({ name: `${prefix}-${suffix}`, description: '', timezone: 'Europe/Lisbon', contactEmail: '', contactPhone: '', website: '', socialLinks: [], operatingSpotIds: [] });
async function user(client, label) {
  const id = randomUUID(); users.push(id);
  await client.query("INSERT INTO users(id,name,email,role,email_verified_at,password_hash,auth_version) VALUES($1,$2,$3,'student',now(),'b5-race',1)", [id, label, `${prefix}-${label}@example.invalid`]);
  return id;
}
const create = (client, actor, request, payload) => scalar(client, 'SELECT create_draft_school($1,$2,$3::jsonb)', [actor, request, payload]);
const close = (client, actor) => row(client, 'SELECT * FROM complete_account_closure($1,$2,1)', [actor, 'b5-race']);
async function blockedBy(observer, waiter, holder) {
  const start = Date.now();
  while (Date.now() - start < 4000) {
    if (await scalar(observer, 'SELECT $1::int=ANY(pg_blocking_pids($2::int))', [holder.databasePid, waiter.databasePid])) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail('Expected the second transaction to wait on the account/school lock');
}
try {
  for (let n = 0; n < 3; n++) {
    const client = await connect('rehearsal'); clients.push(client);
    await client.query("SET lock_timeout='10s'; SET statement_timeout='20s'; SET idle_in_transaction_session_timeout='30s'");
    // Neon proxy cancellation PIDs differ from the database backend PID.
    client.databasePid = await scalar(client, 'SELECT pg_backend_pid()');
  }
  const [main, a, b] = clients;
  assert.equal(await scalar(main, "SELECT to_regprocedure('create_draft_school(uuid,uuid,jsonb)') IS NOT NULL"), true, 'Apply B5 to rehearsal before race checks');
  const owner = await user(main, 'owner'), request = randomUUID(), payload = settings('same');
  const same = await Promise.all([create(a, owner, request, payload), create(b, owner, request, payload)]);
  assert.equal(new Set(same.map(result => result.data.id)).size, 1);
  assert.equal(same.filter(result => !result.replayed).length, 1);
  const school = same[0].data.id;
  assert.equal(await scalar(main, 'SELECT count(*)::int FROM school_memberships WHERE school_id=$1', [school]), 1);
  assert.equal(await scalar(main, "SELECT count(*)::int FROM school_access_events WHERE school_id=$1 AND action='school_draft_created'", [school]), 1);
  checks.push('concurrent identical request creates one school, owner membership and event');

  const changedRequest = randomUUID();
  const mismatched = await Promise.all([observe(create(a, owner, changedRequest, settings('first'))), observe(create(b, owner, changedRequest, settings('second')))]);
  assert.equal(mismatched.filter(result => result.ok).length, 1);
  assert.equal(mismatched.find(result => !result.ok).error.code, '23514');
  checks.push('concurrent changed-payload reuse has one winner and one fingerprint conflict');

  const saves = await Promise.all([a, b].map((client, i) => observe(scalar(client, 'SELECT update_school_settings($1,$2,1,$3::jsonb)', [owner, school, { ...payload, description: `Save ${i}` }]))));
  assert.equal(saves.filter(result => result.ok).length, 1);
  assert.equal(saves.find(result => !result.ok).error.code, '40001');
  assert.equal(await scalar(main, 'SELECT settings_revision FROM schools WHERE id=$1', [school]), 2);
  checks.push('simultaneous settings writes save one revision and reject one stale revision');

  const createsFirst = await user(main, 'create-first');
  await a.query('BEGIN');
  const createdFirst = await create(a, createsFirst, randomUUID(), settings('create-first'));
  const closureWaits = observe(close(b, createsFirst));
  await blockedBy(main, b, a);
  await a.query('COMMIT');
  const closureAfter = await closureWaits;
  assert.equal(closureAfter.ok, true); assert.equal(closureAfter.value.outcome, 'support');
  assert.equal(await scalar(main, 'SELECT deleted_at IS NULL FROM users WHERE id=$1', [createsFirst]), true);
  assert.equal(await scalar(main, 'SELECT school_id FROM school_creation_requests WHERE actor_id=$1', [createsFirst]), createdFirst.data.id);
  checks.push('create first: account closure waits, then sees owner obligation and requires support');

  const closesFirst = await user(main, 'closure-first');
  await a.query('BEGIN');
  assert.equal((await close(a, closesFirst)).outcome, 'closed');
  const createWaits = observe(create(b, closesFirst, randomUUID(), settings('closure-first')));
  await blockedBy(main, b, a);
  await a.query('COMMIT');
  const createAfter = await createWaits;
  assert.equal(createAfter.ok, false); assert.equal(createAfter.error.code, '42501');
  assert.equal(await scalar(main, 'SELECT count(*)::int FROM school_creation_requests WHERE actor_id=$1', [closesFirst]), 0);
  assert.equal(await scalar(main, 'SELECT count(*)::int FROM school_memberships WHERE user_id=$1', [closesFirst]), 0);
  checks.push('closure first: create waits then refuses closed account without a school or membership');

  const disabled = await user(main, 'disable-first');
  await a.query('BEGIN');
  await a.query('UPDATE users SET disabled_at=now() WHERE id=$1', [disabled]);
  const disabledWaits = observe(create(b, disabled, randomUUID(), settings('disable-first')));
  await blockedBy(main, b, a); await a.query('COMMIT');
  const disabledAfter = await disabledWaits;
  assert.equal(disabledAfter.ok, false); assert.equal(disabledAfter.error.code, '42501');
  checks.push('concurrent administrative deactivation wins before draft creation and is rechecked');
  console.log(JSON.stringify({ environment: 'rehearsal', checks }));
} finally {
  for (const client of clients) await client.query('ROLLBACK').catch(() => {});
  const main = clients[0];
  if (main && users.length) {
    await main.query('BEGIN');
    try {
      // Discover only schools created by these recorded synthetic actor IDs.
      const schools = (await main.query('SELECT school_id FROM school_creation_requests WHERE actor_id=ANY($1::uuid[])', [users])).rows.map(value => value.school_id);
      await main.query('DELETE FROM school_access_events WHERE school_id=ANY($1::uuid[])', [schools]);
      await main.query('DELETE FROM schools WHERE id=ANY($1::uuid[])', [schools]);
      await main.query('DELETE FROM account_closure_requests WHERE user_id=ANY($1::uuid[])', [users]);
      await main.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
      assert.equal(await scalar(main, 'SELECT count(*)::int FROM users WHERE id=ANY($1::uuid[])', [users]), 0);
      assert.equal(await scalar(main, 'SELECT count(*)::int FROM schools WHERE id=ANY($1::uuid[])', [schools]), 0);
      await main.query('COMMIT');
      console.log(JSON.stringify({ cleanup: 'complete', users: users.length, schools: schools.length }));
    } catch (error) { await main.query('ROLLBACK'); throw error; }
  }
  for (const client of clients) await client.end();
}
