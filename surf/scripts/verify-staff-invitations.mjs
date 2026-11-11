import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';

// All fixtures belong to the caller's transaction and must be rolled back.
export async function verifyStaffInvitations(client, { selfService = false } = {}) {
  const checks = [];
  const row = async (q, p = []) => (await client.query(q, p)).rows[0];
  const scalar = async (q, p = []) => Object.values(await row(q, p))[0];
  const hash = () => createHash('sha256').update(randomUUID()).digest('hex');
  const environment = await scalar('SELECT environment FROM job_environment WHERE singleton');
  const prefix = 'b4-' + randomUUID().slice(0, 8);
  async function user(label, verified = true) {
    const email = `${prefix}-${label}@example.invalid`;
    const { id } = await row(`INSERT INTO users(name,email,role,email_verified_at) VALUES($1,$2,'student',CASE WHEN $3 THEN now() END) RETURNING id`, [label, email, verified]);
    return { id, email };
  }
  async function member(person, school, roles, status = 'active') {
    const { id } = await row(`INSERT INTO school_memberships(user_id,school_id,status) VALUES($1,$2,$3) RETURNING id`, [person.id, school, status]);
    for (const role of roles) await client.query('INSERT INTO membership_roles(membership_id,role) VALUES($1,$2)', [id, role]);
    return id;
  }
  async function denied(q, p, code = '42501') {
    await client.query('SAVEPOINT expected_denial');
    try { await client.query(q, p); assert.fail('Expected denial'); }
    catch (e) { assert.equal(e.code, code, e.message); }
    finally { await client.query('ROLLBACK TO SAVEPOINT expected_denial'); }
  }
  const owner = await user('owner'), admin = await user('admin'), person = await user('recipient');
  const wrong = await user('wrong'), unverified = await user('unverified', false);
  const school = await scalar('INSERT INTO schools(name,workspace_status) VALUES($1,\'active\') RETURNING id', [prefix]);
  const other = await scalar('INSERT INTO schools(name,workspace_status) VALUES($1,\'active\') RETURNING id', [prefix + '-other']);
  const ownerMember = await member(owner, school, []);
  await client.query('UPDATE schools SET owner_membership_id=$1 WHERE id=$2', [ownerMember, school]);
  // Optional B5 regression fixture: explicitly approved operational self-service.
  if (selfService) await client.query("UPDATE schools SET workspace_kind='self_service',pilot_access_status='approved' WHERE id=$1", [school]);
  const adminMember = await member(admin, school, ['school_admin']);
  const access = 'SELECT set_school_access($1,$2,$3,$4,$5)';
  await client.query(access, [owner.id, owner.id, school, ['coach'], 'active']);
  await denied(access, [admin.id, person.id, school, ['school_admin'], 'active']);
  await denied(access, [admin.id, owner.id, school, ['coach'], 'suspended']);
  await denied(access, [admin.id, person.id, other, ['coach'], 'active']);
  checks.push('owner teaching remains independent; administrator and cross-school changes denied');

  async function invite(actor, recipient, roles = ['coach'], coach = null, operation = 'invite', id = null) {
    const tokenHash = hash(), job = randomUUID();
    await client.query(`SELECT manage_staff_invitation($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [actor.id, school, operation, id, recipient.email, roles, coach, tokenHash, job, environment, hash(), '{}']);
    return { tokenHash, job, ...(await row('SELECT id FROM school_invitations WHERE token_hash=$1', [tokenHash])) };
  }
  const accept = (who, i) => scalar('SELECT accept_staff_invitation($1,$2)', [who.id, i.tokenHash]);
  const first = await invite(admin, person);
  assert.equal(await accept(wrong, first), null);
  assert.equal(await accept(person, first), school);
  assert.equal(await accept(person, first), null);
  assert.equal(await scalar('SELECT count(*)::int FROM school_memberships WHERE user_id=$1 AND school_id=$2', [person.id, school]), 1);
  checks.push('matching verified identity; one-time acceptance and unique membership');
  const unverifiedInvite = await invite(admin, unverified);
  assert.equal(await accept(unverified, unverifiedInvite), null);
  const expired = await invite(admin, wrong);
  await client.query("UPDATE school_invitations SET created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE id=$1", [expired.id]);
  assert.equal(await accept(wrong, expired), null);
  checks.push('unverified identity and expired invitations denied');

  const resend = await invite(admin, wrong);
  const fresh = await invite(admin, wrong, ['coach'], null, 'reissue', resend.id);
  assert.equal(await accept(wrong, resend), null);
  assert.deepEqual(await row('SELECT status,payload FROM job_outbox WHERE id=$1', [resend.job]), { status: 'cancelled', payload: null });
  await invite(admin, wrong, ['coach'], null, 'revoke', fresh.id);
  assert.equal(await accept(wrong, fresh), null);
  checks.push('reissue and revoke invalidate tokens and queued payloads');

  const revokedInviter = await invite(admin, wrong);
  await client.query("UPDATE membership_roles SET revoked_at=now() WHERE membership_id=$1 AND role='school_admin'", [adminMember]);
  assert.equal(await accept(wrong, revokedInviter), null);
  await client.query("UPDATE membership_roles SET revoked_at=NULL WHERE membership_id=$1 AND role='school_admin'", [adminMember]);
  await invite(owner, wrong, ['coach'], null, 'revoke', revokedInviter.id);
  checks.push('inviter authority rechecked at acceptance');

  await client.query(access, [owner.id, person.id, school, ['coach'], 'suspended']);
  await denied(access, [admin.id, person.id, school, ['coach'], 'left']);
  const suspended = await invite(owner, person);
  assert.equal(await accept(person, suspended), null);
  await invite(owner, person, ['coach'], null, 'revoke', suspended.id);
  await client.query(access, [owner.id, person.id, school, ['school_admin', 'coach'], 'left']);
  await denied(access, [admin.id, person.id, school, ['coach'], 'active']);
  await denied(access, [owner.id, person.id, school, ['coach'], 'active']);
  await denied(access, [owner.id, person.id, school, ['coach'], 'suspended']);
  await denied(access, [admin.id, person.id, school, ['coach'], 'suspended']);
  const formerInstructor = await user('former-instructor');
  await member(formerInstructor, school, ['coach'], 'left');
  for (const actor of [admin, owner]) {
    await denied(access, [actor.id, formerInstructor.id, school, ['coach'], 'active']);
    await denied(access, [actor.id, formerInstructor.id, school, ['coach'], 'suspended']);
  }
  const restored = await invite(admin, person);
  assert.equal(await accept(person, restored), school);
  const roles = await scalar(`SELECT array_agg(r.role ORDER BY r.role) FROM membership_roles r JOIN school_memberships m ON m.id=r.membership_id WHERE m.user_id=$1 AND m.school_id=$2 AND r.revoked_at IS NULL`, [person.id, school]);
  assert.deepEqual(roles, ['coach']);
  checks.push('suspension cannot be laundered; removed membership restores only invited roles');

  const addAdmin = await invite(owner, person, ['school_admin']);
  assert.equal(await accept(person, addAdmin), school);
  assert.deepEqual(await scalar(`SELECT array_agg(r.role ORDER BY r.role) FROM membership_roles r JOIN school_memberships m ON m.id=r.membership_id WHERE m.user_id=$1 AND m.school_id=$2 AND r.revoked_at IS NULL`, [person.id, school]), ['coach', 'school_admin']);
  await denied(access, [admin.id, person.id, school, ['coach'], 'active']);
  checks.push('active roles preserved; ordinary admin cannot change administrator membership');

  const legacy = await user('legacy');
  const coach = await scalar('INSERT INTO coaches(school_id,name,email) VALUES($1,$2,$3) RETURNING id', [school, 'Historical instructor', legacy.email]);
  const implicit = await invite(admin, legacy);
  assert.equal(await accept(legacy, implicit), null);
  await invite(owner, legacy, ['coach'], null, 'revoke', implicit.id);
  const explicit = await invite(admin, legacy, ['coach'], coach);
  assert.equal(await accept(legacy, explicit), school);
  assert.equal(await scalar('SELECT user_id FROM coaches WHERE id=$1', [coach]), legacy.id);
  assert.equal(await scalar('SELECT count(*)::int FROM coaches WHERE school_id=$1 AND user_id=$2', [school, legacy.id]), 1);
  checks.push('historical instructor requires explicit verified claim and retains record ID');

  const closedInvite = await invite(owner, wrong);
  await client.query("UPDATE schools SET workspace_status='closed' WHERE id=$1", [school]);
  assert.equal(await accept(wrong, closedInvite), null);
  await client.query("UPDATE schools SET workspace_status='active' WHERE id=$1", [school]);
  await client.query('UPDATE users SET disabled_at=now() WHERE id=$1', [wrong.id]);
  assert.equal(await accept(wrong, closedInvite), null);
  checks.push('closed school and disabled recipient denied');
  assert.equal(await scalar('SELECT count(*)::int FROM school_access_events WHERE school_id=$1', [school]) > 0, true);
  return checks;
}
