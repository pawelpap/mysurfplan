import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { connect } from './membership-migration-support.mjs';

// Deliberately rehearsal-only. Requires the additive B4 migration to be applied.
// Fixtures must commit so independent connections can exercise real row locks.
assert(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === 'rehearsal'),
  'Usage: node scripts/check-staff-invitation-races.mjs [rehearsal]');
const clients = [], users = [], jobs = [], checks = [];
const prefix = `b4-race-${randomUUID()}`;
const hash = () => createHash('sha256').update(randomUUID()).digest('hex');
let school, environment, owner, admin;
const row = async (client, q, p = []) => (await client.query(q, p)).rows[0];
const scalar = async (client, q, p = []) => Object.values(await row(client, q, p))[0];
async function transaction(client, fn) {
  await client.query('BEGIN');
  try { const result = await fn(); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
}
async function user(client, label) {
  const id = randomUUID(), email = `${prefix}-${label}@example.invalid`;
  users.push(id);
  await client.query("INSERT INTO users(id,name,email,role,email_verified_at) VALUES($1,$2,$3,'student',now())", [id, label, email]);
  return { id, email };
}
const access = (client, roles) => client.query('SELECT set_school_access($1,$2,$3,$4,$5)', [owner.id, admin.id, school, roles, 'active']);
async function invitation(client, actor, recipient, roles = ['coach'], operation = 'invite', id = null) {
  const tokenHash = hash(), job = randomUUID(); jobs.push(job);
  return transaction(client, async () => {
    const queued = await scalar(client, 'SELECT manage_staff_invitation($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [actor.id, school, operation, id, recipient.email, roles, null, tokenHash, job, environment, hash(), '{}']);
    // These are inert, synthetic outbox records, never dispatchable test emails.
    if (queued) await client.query("UPDATE job_outbox SET due_at=now()+interval '6 days' WHERE id=$1", [queued]);
    const result = await row(client, 'SELECT id FROM school_invitations WHERE token_hash=$1', [tokenHash]);
    return { id: result?.id || null, tokenHash, job, queued };
  });
}
const accept = (client, person, invite) => scalar(client, 'SELECT accept_staff_invitation($1,$2)', [person.id, invite.tokenHash]);
async function expectCode(promise, code) {
  await assert.rejects(promise, error => error.code === code);
}

try {
  // Connect sequentially so even a partial connection failure can be cleaned up.
  for (let n = 0; n < 3; n++) {
    const client = await connect('rehearsal'); clients.push(client);
    await client.query("SET lock_timeout='12s'; SET statement_timeout='20s'; SET idle_in_transaction_session_timeout='30s'");
  }
  const [main, a, b] = clients;
  assert.equal(await scalar(main, "SELECT to_regprocedure('accept_staff_invitation(uuid,text)') IS NOT NULL"), true,
    'Apply the B4 migration on rehearsal before running committed race fixtures');
  environment = await scalar(main, 'SELECT environment FROM job_environment WHERE singleton');
  await transaction(main, async () => {
    school = randomUUID();
    await main.query("INSERT INTO schools(id,name,workspace_status) VALUES($1,$2,'active')", [school, prefix]);
    owner = await user(main, 'owner'); admin = await user(main, 'admin');
    const membership = await scalar(main, 'INSERT INTO school_memberships(school_id,user_id) VALUES($1,$2) RETURNING id', [school, owner.id]);
    await main.query('UPDATE schools SET owner_membership_id=$1 WHERE id=$2', [membership, school]);
    const adminMembership = await scalar(main, 'INSERT INTO school_memberships(school_id,user_id) VALUES($1,$2) RETURNING id', [school, admin.id]);
    await main.query("INSERT INTO membership_roles(membership_id,role,granted_by) VALUES($1,'school_admin',$2)", [adminMembership, owner.id]);
  });

  const recipient = await user(main, 'single-use');
  const first = await invitation(main, admin, recipient);
  const accepted = await Promise.all([accept(a, recipient, first), accept(b, recipient, first)]);
  assert.equal(accepted.filter(value => value === school).length, 1);
  assert.equal(accepted.filter(value => value === null).length, 1);
  assert.equal(await scalar(main, 'SELECT count(*)::int FROM school_memberships WHERE school_id=$1 AND user_id=$2', [school, recipient.id]), 1);
  assert.equal(await scalar(main, 'SELECT count(*)::int FROM coaches WHERE school_id=$1 AND user_id=$2', [school, recipient.id]), 1);
  assert.equal(await scalar(main, "SELECT count(*)::int FROM school_access_events WHERE invitation_id=$1 AND action='invitation_accepted'", [first.id]), 1);
  checks.push('concurrent same-token acceptance grants one membership, coach and audit event');

  const duplicateRecipient = await user(main, 'duplicate');
  const duplicates = await Promise.all([invitation(a, admin, duplicateRecipient), invitation(b, admin, duplicateRecipient)]);
  assert.equal(duplicates.filter(value => value.queued !== null).length, 1);
  assert.equal(await scalar(main, "SELECT count(*)::int FROM school_invitations WHERE school_id=$1 AND invited_email=$2 AND status='pending'", [school, duplicateRecipient.email]), 1);
  assert.equal(await scalar(main, 'SELECT count(*)::int FROM job_outbox WHERE id=ANY($1::uuid[])', [duplicates.map(value => value.job)]), 1);
  checks.push('concurrent duplicate creation queues exactly one invitation and email');

  const raceRecipient = await user(main, 'reissue');
  const original = await invitation(main, admin, raceRecipient);
  const outcomes = await Promise.allSettled([
    invitation(a, admin, raceRecipient, ['coach'], 'revoke', original.id),
    invitation(b, admin, raceRecipient, ['coach'], 'reissue', original.id),
  ]);
  assert.equal(outcomes[0].status, 'fulfilled');
  if (outcomes[1].status === 'rejected') assert.equal(outcomes[1].reason.code, '23514');
  assert.equal(await accept(main, raceRecipient, original), null);
  assert.deepEqual(await row(main, 'SELECT status,payload FROM job_outbox WHERE id=$1', [original.job]), { status: 'cancelled', payload: null });
  const pending = await scalar(main, "SELECT count(*)::int FROM school_invitations WHERE school_id=$1 AND invited_email=$2 AND status='pending'", [school, raceRecipient.email]);
  assert.equal(pending, outcomes[1].status === 'fulfilled' ? 1 : 0);
  checks.push('concurrent revoke and reissue invalidate the old token and outbox payload');

  const promoted = await user(main, 'stale-id');
  const stale = await invitation(main, admin, promoted);
  await invitation(main, owner, promoted, ['coach'], 'revoke', stale.id);
  const current = await invitation(main, owner, promoted, ['school_admin']);
  await Promise.all([
    invitation(a, admin, promoted, ['coach'], 'revoke', stale.id),
    expectCode(invitation(b, admin, promoted, ['coach'], 'reissue', stale.id), '23514'),
  ]);
  assert.deepEqual(await row(main, 'SELECT status,requested_roles FROM school_invitations WHERE id=$1', [current.id]), { status: 'pending', requested_roles: ['school_admin'] });
  assert.equal(await scalar(main, 'SELECT status FROM job_outbox WHERE id=$1', [current.job]), 'pending');
  assert.equal(await accept(main, promoted, stale), null);
  assert.equal(await accept(main, promoted, current), school);
  checks.push('stale coach invitation cannot revoke, replace or cancel a newer owner administrator invitation');

  // Exercise both serialisation orders deterministically, with a transaction
  // holding the school lock while the conflicting request starts on another client.
  const beforeRecipient = await user(main, 'accept-first');
  const before = await invitation(main, admin, beforeRecipient);
  await a.query('BEGIN');
  assert.equal(await accept(a, beforeRecipient, before), school);
  const revokeAfter = access(b, []);
  await a.query('COMMIT'); await revokeAfter;
  assert.equal(await scalar(main, 'SELECT account_manages_school($1,$2)', [admin.id, school]), false);
  assert.equal(await accept(main, beforeRecipient, before), null);
  await access(main, ['school_admin']);
  const afterRecipient = await user(main, 'revoke-first');
  const after = await invitation(main, admin, afterRecipient);
  await b.query('BEGIN'); await access(b, []);
  const acceptAfter = accept(a, afterRecipient, after);
  await b.query('COMMIT');
  assert.equal(await acceptAfter, null);
  assert.equal(await scalar(main, 'SELECT count(*)::int FROM school_memberships WHERE school_id=$1 AND user_id=$2', [school, afterRecipient.id]), 0);
  checks.push('issuer revocation serialises correctly in both deterministic lock orders');

  for (let n = 0; n < 4; n++) {
    await access(main, ['school_admin']);
    const who = await user(main, `issuer-race-${n}`), pendingInvite = await invitation(main, admin, who);
    const [result] = await Promise.all([accept(a, who, pendingInvite), access(b, [])]);
    assert(result === null || result === school);
    assert.equal(await accept(main, who, pendingInvite), null);
    assert.equal(await scalar(main, 'SELECT count(*)::int FROM school_memberships WHERE school_id=$1 AND user_id=$2', [school, who.id]), result === school ? 1 : 0);
    assert.equal(await scalar(main, 'SELECT status FROM school_invitations WHERE id=$1', [pendingInvite.id]), result === school ? 'accepted' : 'pending');
  }
  checks.push('four simultaneous issuer-revocation races grant only before revocation, never afterwards');
} catch (error) {
  console.error(JSON.stringify({ environment: 'rehearsal', check: 'staff-invitation-races', error: error.message, code: error.code }));
  process.exitCode = 1;
} finally {
  // Release any failed test transaction before taking cleanup locks.
  for (const client of clients) await client.query('ROLLBACK').catch(() => {});
  if (clients[0] && school) {
    try {
      await transaction(clients[0], async () => {
        const main = clients[0];
        await main.query('SET CONSTRAINTS ALL DEFERRED');
        await main.query('DELETE FROM school_access_events WHERE school_id=$1', [school]);
        await main.query('DELETE FROM school_invitations WHERE school_id=$1', [school]);
        await main.query('DELETE FROM job_outbox WHERE id=ANY($1::uuid[])', [jobs]);
        await main.query('DELETE FROM coaches WHERE school_id=$1', [school]);
        await main.query('DELETE FROM membership_roles WHERE membership_id IN(SELECT id FROM school_memberships WHERE school_id=$1)', [school]);
        await main.query('DELETE FROM school_memberships WHERE school_id=$1', [school]);
        await main.query('DELETE FROM schools WHERE id=$1', [school]);
        await main.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
        assert.equal(await scalar(main, 'SELECT count(*)::int FROM schools WHERE id=$1', [school]), 0);
        assert.equal(await scalar(main, 'SELECT count(*)::int FROM users WHERE id=ANY($1::uuid[])', [users]), 0);
        assert.equal(await scalar(main, 'SELECT count(*)::int FROM job_outbox WHERE id=ANY($1::uuid[])', [jobs]), 0);
      });
      console.log(JSON.stringify({ environment: 'rehearsal', check: 'staff-invitation-races', checks, exactFixturesRemoved: true, passed: !process.exitCode }));
    } catch (error) {
      // Exact random identifiers are safe and permit targeted recovery only.
      console.error(JSON.stringify({ error: 'fixture_cleanup_failed', code: error.code, school, users, jobs }));
      process.exitCode = 1;
    }
  }
  await Promise.allSettled(clients.map(client => client.end()));
}
