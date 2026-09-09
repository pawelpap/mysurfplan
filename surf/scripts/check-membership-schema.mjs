// All normal scenarios roll back their fixtures. Concurrency fixtures are used
// only on rehearsal, recorded privately and removed by exact IDs in finally.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { connect, report } from './membership-migration-support.mjs';

const [environment, option] = process.argv.slice(2);
assert(!option || option === '--concurrency', 'Unknown option');
assert(!option || environment === 'rehearsal', 'Concurrency fixtures are restricted to rehearsal');
const client = await connect(environment);
const run = crypto.randomUUID();
let passed = 0;
const one = async (sql, values = []) => (await client.query(sql, values)).rows[0];
async function rejected(sql, values, code = '23514') {
  await client.query('SAVEPOINT expected_failure');
  try {
    await client.query(sql, values);
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    assert.fail('Invalid database operation was accepted');
  } catch (error) {
    assert.equal(error.code, code, error.message);
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_failure');
    await client.query('RELEASE SAVEPOINT expected_failure');
  }
}
async function check(name, body) {
  await client.query('SAVEPOINT scenario');
  try { await body(); passed++; console.log(`PASS ${environment}: ${name}`); }
  finally { await client.query('ROLLBACK TO SAVEPOINT scenario'); await client.query('RELEASE SAVEPOINT scenario'); }
}

try {
  const audit = await report(client);
  assert.equal(audit.authority, 'legacy_shadow');
  assert.equal(audit.shadowDifferences, 0);
  await client.query('BEGIN');
  await client.query("SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='5s'");
  const school = async label => one('INSERT INTO schools(name) VALUES($1) RETURNING *', [`B1 ${run} ${label}`]);
  const a = await school('A'), b = await school('B');
  const user = async (role, schoolId) => one(`INSERT INTO users(school_id,name,email,role)
    VALUES($1,'B1 fixture',$2,$3) RETURNING *`, [schoolId, `b1-${crypto.randomUUID()}@example.invalid`, role]);
  const admin = await user('school_admin', a.id), coach = await user('coach', a.id);
  const student = await user('student', a.id), platform = await user('platform_admin', null);
  const membership = async (userId, schoolId = a.id) => one('SELECT * FROM school_memberships WHERE user_id=$1 AND school_id=$2', [userId, schoolId]);
  const adminMembership = await membership(admin.id), coachMembership = await membership(coach.id);

  await check('legacy roles create exact staff/platform assignments; students gain no staff access', async () => {
    assert.equal(adminMembership.status, 'active');
    assert.equal(coachMembership.status, 'active');
    assert.equal(await membership(student.id), undefined);
    assert.equal(await membership(platform.id), undefined);
    assert.equal((await one('SELECT count(*)::int AS n FROM platform_role_assignments WHERE user_id=$1 AND revoked_at IS NULL', [platform.id])).n, 1);
    assert.equal((await one('SELECT role FROM membership_roles WHERE membership_id=$1 AND revoked_at IS NULL', [adminMembership.id])).role, 'school_admin');
  });
  await check('one account supports two school memberships and combined admin/instructor roles', async () => {
    await client.query('INSERT INTO membership_roles(membership_id,role) VALUES($1,$2)', [adminMembership.id, 'coach']);
    const other = await one('INSERT INTO school_memberships(school_id,user_id) VALUES($1,$2) RETURNING id', [b.id, admin.id]);
    await client.query('INSERT INTO membership_roles(membership_id,role) VALUES($1,$2)', [other.id, 'coach']);
    assert.equal((await one('SELECT count(*)::int AS n FROM membership_roles WHERE membership_id=$1', [adminMembership.id])).n, 2);
    assert.equal((await one('SELECT role::text FROM users WHERE id=$1', [admin.id])).role, 'school_admin');
    await rejected('INSERT INTO school_memberships(school_id,user_id) VALUES($1,$2)', [b.id, admin.id], '23505');
    await rejected('INSERT INTO membership_roles(membership_id,role) VALUES($1,$2)', [other.id, 'coach'], '23505');
  });
  await check('membership roles cannot grant platform authority or student-as-staff roles', async () => {
    for (const role of ['platform_admin', 'owner', 'student', 'unknown'])
      await rejected('INSERT INTO membership_roles(membership_id,role) VALUES($1,$2)', [adminMembership.id, role]);
    await rejected('INSERT INTO platform_role_assignments(user_id,role) VALUES($1,$2)', [student.id, 'coach']);
    await rejected('INSERT INTO school_memberships(school_id,user_id,status) VALUES($1,$2,$3)', [b.id, student.id, 'pending']);
  });
  await check('legacy role changes revoke the old role in the same transaction', async () => {
    await client.query("UPDATE users SET role='coach' WHERE id=$1", [admin.id]);
    const roles = (await client.query('SELECT role,revoked_at IS NULL AS active FROM membership_roles WHERE membership_id=$1 ORDER BY role', [adminMembership.id])).rows;
    assert.deepEqual(roles, [{ role: 'coach', active: true }, { role: 'school_admin', active: false }]);
    assert.equal((await membership(admin.id)).id, adminMembership.id);
  });
  await check('school transfer leaves the old membership and creates only the new proven assignment', async () => {
    await client.query('UPDATE users SET school_id=$1 WHERE id=$2', [b.id, admin.id]);
    assert.equal((await membership(admin.id)).status, 'left');
    assert.equal((await membership(admin.id, b.id)).status, 'active');
    assert.equal((await one('SELECT count(*)::int AS n FROM membership_roles WHERE membership_id=$1 AND revoked_at IS NULL', [adminMembership.id])).n, 0);
  });
  await check('staff-to-student, platform transfer and soft deletion remove mirrored grants', async () => {
    await client.query("UPDATE users SET role='student' WHERE id=$1", [coach.id]);
    assert.equal((await membership(coach.id)).status, 'left');
    await client.query("UPDATE users SET role='platform_admin',school_id=NULL WHERE id=$1", [admin.id]);
    assert.equal((await membership(admin.id)).status, 'left');
    await client.query('UPDATE users SET deleted_at=now() WHERE id=$1', [admin.id]);
    assert.equal((await one('SELECT count(*)::int AS n FROM platform_role_assignments WHERE user_id=$1 AND revoked_at IS NULL', [admin.id])).n, 0);
  });
  await check('restoring a legacy account reuses its membership ID and current legacy role', async () => {
    await client.query('UPDATE users SET deleted_at=now() WHERE id=$1', [admin.id]);
    assert.equal((await membership(admin.id)).status, 'left');
    await client.query('UPDATE users SET deleted_at=NULL WHERE id=$1', [admin.id]);
    assert.equal((await membership(admin.id)).id, adminMembership.id);
    assert.equal((await membership(admin.id)).status, 'active');
  });
  await check('profile, password epoch and global disable changes do not redefine membership', async () => {
    const before = await membership(admin.id);
    await client.query("UPDATE users SET name='Profile edit',role=role,disabled_at=now() WHERE id=$1", [admin.id]);
    assert.deepEqual(await membership(admin.id), before);
    assert.equal((await one('SELECT auth_version FROM users WHERE id=$1', [admin.id])).auth_version, admin.auth_version + 1);
  });
  await check('compatibility bridge never revives an explicitly suspended membership', async () => {
    await client.query("INSERT INTO school_memberships(school_id,user_id,status) VALUES($1,$2,'suspended')", [b.id, admin.id]);
    await client.query('UPDATE users SET school_id=$1 WHERE id=$2', [b.id, admin.id]);
    const m = await membership(admin.id, b.id);
    assert.equal(m.status, 'suspended');
    assert.equal((await one('SELECT count(*)::int AS n FROM membership_roles WHERE membership_id=$1', [m.id])).n, 0);
  });
  await check('emails never auto-claim instructor/customer records or verify accounts', async () => {
    const c = await one('INSERT INTO coaches(school_id,name,email) VALUES($1,$2,$3) RETURNING user_id', [a.id, 'Unclaimed', coach.email]);
    const s = await one('INSERT INTO students(school_id,name,email) VALUES($1,$2,$3) RETURNING user_id', [a.id, 'Unclaimed', student.email]);
    assert.equal(c.user_id, null); assert.equal(s.user_id, null);
    assert.equal((await one('SELECT email_verified_at FROM users WHERE id=$1', [student.id])).email_verified_at, null);
  });
  await check('inconsistent explicit links and ambiguous login identifiers are reported without relinking', async () => {
    const c = await one('INSERT INTO coaches(school_id,user_id,name) VALUES($1,$2,$3) RETURNING id', [b.id, coach.id, 'Cross-school fixture']);
    assert.equal((await one("SELECT issue FROM identity_reconciliation_issues WHERE subject_id=$1 AND issue='incompatible_coach_link'", [c.id])).issue, 'incompatible_coach_link');
    const differentCase = await user('student', b.id);
    await client.query('UPDATE users SET email=$1 WHERE id=$2', [` ${student.email} `, differentCase.id]);
    assert((await one("SELECT count(*)::int AS n FROM identity_reconciliation_issues WHERE issue='ambiguous_login_identifier' AND (subject_id=$1 OR related_id=$1)", [student.id])).n > 0);
    assert.equal((await one('SELECT user_id FROM coaches WHERE id=$1', [c.id])).user_id, coach.id);
  });
  await check('legacy schools have no inferred owner and self-service requires an owner', async () => {
    assert.equal(a.workspace_kind, 'legacy'); assert.equal(a.owner_membership_id, null);
    await rejected("UPDATE schools SET workspace_kind='self_service',workspace_status='active' WHERE id=$1", [a.id]);
  });
  await check('owner must belong to the same school', async () => {
    await rejected('UPDATE schools SET owner_membership_id=$1 WHERE id=$2', [adminMembership.id, b.id], '23503');
  });
  const activate = () => client.query("UPDATE schools SET workspace_kind='self_service',workspace_status='active',owner_membership_id=$1 WHERE id=$2", [adminMembership.id, a.id]);
  await check('active self-service ownership cannot reference a suspended or removed membership', async () => {
    await activate();
    for (const status of ['suspended', 'left'])
      await rejected('UPDATE school_memberships SET status=$1 WHERE id=$2', [status, adminMembership.id], '23503');
    await rejected('DELETE FROM school_memberships WHERE id=$1', [adminMembership.id], '23503');
  });
  await check('ownership transfer and old-owner suspension can commit atomically', async () => {
    await activate();
    await client.query('UPDATE schools SET owner_membership_id=$1 WHERE id=$2', [coachMembership.id, a.id]);
    await client.query("UPDATE school_memberships SET status='left' WHERE id=$1", [adminMembership.id]);
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    assert.equal((await one('SELECT owner_membership_id FROM schools WHERE id=$1', [a.id])).owner_membership_id, coachMembership.id);
  });
  await check('closing a self-service school permits historical inactive ownership', async () => {
    await activate();
    await client.query("UPDATE schools SET workspace_status='closed' WHERE id=$1", [a.id]);
    await client.query("UPDATE school_memberships SET status='left' WHERE id=$1", [adminMembership.id]);
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    assert.equal((await one('SELECT count(*)::int AS n FROM users WHERE id=$1', [admin.id])).n, 1);
  });
  await check('membership removal preserves personal customer IDs and booking history', async () => {
    const m = await one('INSERT INTO school_memberships(school_id,user_id) VALUES($1,$2) RETURNING id', [a.id, student.id]);
    const s = await one('INSERT INTO students(school_id,user_id,email) VALUES($1,$2,$3) RETURNING id', [a.id, student.id, student.email]);
    const spot = await one('SELECT id FROM surf_spots WHERE active LIMIT 1');
    const lesson = await one("INSERT INTO lessons(school_id,start_at,spot_id) VALUES($1,now()+interval '1 day',$2) RETURNING id", [a.id, spot.id]);
    const booking = await one('INSERT INTO bookings(lesson_id,student_id) VALUES($1,$2) RETURNING id', [lesson.id, s.id]);
    await client.query("UPDATE school_memberships SET status='left' WHERE id=$1", [m.id]);
    assert.equal((await one('SELECT student_id FROM bookings WHERE id=$1', [booking.id])).student_id, s.id);
    assert.equal((await one('SELECT user_id FROM students WHERE id=$1', [s.id])).user_id, student.id);
  });
  const invitation = async (roles = ['coach'], extra = {}) => one(`INSERT INTO school_invitations
    (school_id,invited_email,requested_roles,invited_by,token_hash,expires_at,legacy_coach_id)
    VALUES($1,$2,$3,$4,$5,now()+interval '1 day',$6) RETURNING *`,
  [a.id, extra.email || `invite-${crypto.randomUUID()}@example.invalid`, roles, admin.id, crypto.randomBytes(32).toString('hex'), extra.coachId || null]);
  await check('invitations support fixed school roles without granting membership', async () => {
    const before = (await one('SELECT count(*)::int AS n FROM school_memberships')).n;
    await invitation(['school_admin', 'coach']);
    assert.equal((await one('SELECT count(*)::int AS n FROM school_memberships')).n, before);
    for (const roles of [[], ['platform_admin'], ['coach', 'coach'], ['coach', null]]) {
      await rejected(`INSERT INTO school_invitations(school_id,invited_email,requested_roles,token_hash,expires_at)
        VALUES($1,$2,$3,$4,now()+interval '1 day')`, [a.id, 'invalid@example.invalid', roles, crypto.randomBytes(32).toString('hex')]);
    }
  });
  await check('invitation token, email, expiry and pending uniqueness constraints reject invalid data', async () => {
    const i = await invitation();
    await rejected('UPDATE school_invitations SET token_hash=$1 WHERE id=$2', ['raw-token', i.id]);
    await rejected('UPDATE school_invitations SET invited_email=$1 WHERE id=$2', [' NotNormalised@Example.invalid ', i.id]);
    await rejected('UPDATE school_invitations SET expires_at=created_at WHERE id=$1', [i.id]);
    await rejected(`INSERT INTO school_invitations(school_id,invited_email,requested_roles,token_hash,expires_at)
      VALUES($1,$2,$3,$4,now()+interval '1 day')`, [a.id, i.invited_email, ['coach'], crypto.randomBytes(32).toString('hex')], '23505');
  });
  await check('invitation record claims must refer to the invited school', async () => {
    const c = await one('INSERT INTO coaches(school_id,name) VALUES($1,$2) RETURNING id', [b.id, 'Other school']);
    const i = await invitation();
    await rejected('UPDATE school_invitations SET legacy_coach_id=$1 WHERE id=$2', [c.id, i.id], '23503');
    const s = await one('INSERT INTO students(school_id,email) VALUES($1,$2) RETURNING id', [b.id, 'foreign-customer@example.invalid']);
    await rejected('UPDATE school_invitations SET legacy_student_id=$1 WHERE id=$2', [s.id, i.id], '23503');
  });
  await check('invitation acceptance needs consistent identity and time; revoked states cannot look accepted', async () => {
    const i = await invitation();
    await rejected("UPDATE school_invitations SET status='accepted' WHERE id=$1", [i.id]);
    await rejected("UPDATE school_invitations SET status='accepted',accepted_by_user_id=$1,accepted_at=expires_at WHERE id=$2", [student.id, i.id]);
    await client.query("UPDATE school_invitations SET status='accepted',accepted_by_user_id=$1,accepted_at=now() WHERE id=$2", [student.id, i.id]);
    await rejected("UPDATE school_invitations SET status='revoked',revoked_at=now() WHERE id=$1", [i.id]);
    assert.equal(await membership(student.id), undefined);
  });
  await check('retiring the bridge stops it writing new grants without changing legacy rows', async () => {
    await client.query("UPDATE identity_migration_state SET authority='memberships' WHERE singleton");
    await client.query("UPDATE users SET role='coach' WHERE id=$1", [student.id]);
    assert.equal(await membership(student.id), undefined);
  });
  await client.query('ROLLBACK');
  assert.equal((await report(client)).shadowDifferences, 0);
  console.log(`${environment}: ${passed} schema/compatibility scenarios passed; all transaction fixtures rolled back`);

  if (option === '--concurrency') {
    const statePath = `/private/tmp/mwp-b1-race-${run}.json`;
    const fixture = { schoolId: crypto.randomUUID(), userIds: [crypto.randomUUID(), crypto.randomUUID()], run };
    await fs.writeFile(statePath, JSON.stringify(fixture), { mode: 0o600 });
    const competing = await connect(environment);
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO schools(id,name) VALUES($1,$2)', [fixture.schoolId, `B1 race ${run}`]);
      for (const id of fixture.userIds) await client.query("INSERT INTO users(id,school_id,name,email,role) VALUES($1,$2,'B1 race',$3,'school_admin')", [id, fixture.schoolId, `b1-${id}@example.invalid`]);
      const memberships = (await client.query('SELECT id,user_id FROM school_memberships WHERE school_id=$1 ORDER BY user_id', [fixture.schoolId])).rows;
      const [first, second] = memberships;
      await client.query("UPDATE schools SET workspace_kind='self_service',workspace_status='active',owner_membership_id=$1 WHERE id=$2", [first.id, fixture.schoolId]);
      await client.query('COMMIT');

      await client.query('BEGIN');
      await client.query('UPDATE schools SET owner_membership_id=$1 WHERE id=$2', [second.id, fixture.schoolId]);
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
      await competing.query("BEGIN; SET LOCAL statement_timeout='10s'");
      const suspension = (async () => {
        try {
          await competing.query("UPDATE school_memberships SET status='suspended' WHERE id=$1", [second.id]);
          await competing.query('COMMIT');
          return 'committed';
        } catch (error) { await competing.query('ROLLBACK'); return error.code; }
      })();
      await new Promise(resolve => setTimeout(resolve, 150));
      await client.query('COMMIT');
      assert.equal(await suspension, '23503');
      assert.equal((await one('SELECT status FROM school_memberships WHERE id=$1', [second.id])).status, 'active');
      passed++; console.log('PASS rehearsal: concurrent transfer blocks suspension of the new owner');

      await client.query('BEGIN');
      await client.query("UPDATE school_memberships SET status='suspended' WHERE id=$1", [first.id]);
      await competing.query("BEGIN; SET LOCAL statement_timeout='10s'");
      const transfer = (async () => {
        try {
          await competing.query('UPDATE schools SET owner_membership_id=$1 WHERE id=$2', [first.id, fixture.schoolId]);
          await competing.query('COMMIT');
          return 'committed';
        } catch (error) { await competing.query('ROLLBACK'); return error.code; }
      })();
      await new Promise(resolve => setTimeout(resolve, 150));
      await client.query('COMMIT');
      assert.equal(await transfer, '23503');
      assert.equal((await one('SELECT owner_membership_id FROM schools WHERE id=$1', [fixture.schoolId])).owner_membership_id, second.id);
      passed++; console.log('PASS rehearsal: concurrent suspension blocks transfer to an inactive owner');
    } finally {
      await competing.query('ROLLBACK').catch(() => {});
      await competing.end();
      await client.query('ROLLBACK');
      await client.query('BEGIN');
      await client.query('DELETE FROM schools WHERE id=$1 AND name=$2', [fixture.schoolId, `B1 race ${run}`]);
      assert.equal((await one('SELECT count(*)::int AS n FROM users WHERE id=ANY($1::uuid[])', [fixture.userIds])).n, 0);
      await client.query('COMMIT');
      await fs.unlink(statePath);
    }
    console.log('rehearsal: exact concurrency fixtures removed');
  }
  console.log(JSON.stringify({ environment, passed, shadowDifferences: (await report(client)).shadowDifferences }));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('B1 schema verification failed:', error.message, error.code || '');
  process.exitCode = 1;
} finally {
  await client.end();
}
