import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Only synthetic data inside the caller's transaction; caller always rolls back.
export async function verifySchoolOnboarding(client) {
  const checks = [];
  const row = async (q, p = []) => (await client.query(q, p)).rows[0];
  const scalar = async (q, p = []) => Object.values(await row(q, p))[0];
  const prefix = `b5-${randomUUID()}`;
  async function user(label, verified = true) {
    return scalar("INSERT INTO users(name,email,role,email_verified_at) VALUES($1,$2,'student',CASE WHEN $3 THEN now() END) RETURNING id", [label, `${prefix}-${label}@example.invalid`, verified]);
  }
  async function denied(q, p, code = '42501') {
    await client.query('SAVEPOINT expected_denial');
    try { await client.query(q, p); assert.fail('Expected denial'); }
    catch (error) { assert.equal(error.code, code, error.message); }
    finally { await client.query('ROLLBACK TO SAVEPOINT expected_denial'); }
  }
  const owner = await user('owner'), stranger = await user('stranger'), unverified = await user('unverified', false), platform = await user('platform');
  await client.query('INSERT INTO platform_role_assignments(user_id) VALUES($1)', [platform]);
  const activeSpot = await scalar('SELECT id FROM surf_spots WHERE active ORDER BY id LIMIT 1');
  assert(activeSpot, 'An active spot is required for the rehearsal');
  const settings = { name: prefix, description: 'Private setup', timezone: 'Europe/Lisbon', contactEmail: 'school@example.invalid',
    contactPhone: '+351 999 999 999', website: 'https://example.invalid/', socialLinks: ['https://example.invalid/surf'], operatingSpotIds: [activeSpot] };
  const createSql = 'SELECT create_draft_school($1,$2,$3::jsonb)';
  const updateSql = 'SELECT update_school_settings($1,$2,$3,$4::jsonb)';
  const requestId = randomUUID();
  const acceptancesBefore = await scalar('SELECT count(*)::int FROM legal_acceptances');
  const created = await scalar(createSql, [owner, requestId, settings]);
  const school = created.data.id;
  assert.equal(created.replayed, false);
  assert.equal(created.data.owner, true); assert.equal(created.data.canEdit, true);
  assert.equal(created.data.workspaceKind, 'self_service'); assert.equal(created.data.workspaceStatus, 'draft');
  assert.equal(created.data.listingStatus, 'unlisted'); assert.equal(created.data.pilotAccessStatus, 'pending');
  assert.deepEqual(created.data.operatingSpotIds, [activeSpot]);
  assert.deepEqual(await row(`SELECT m.user_id,m.status,m.origin,(SELECT count(*)::int FROM membership_roles WHERE membership_id=m.id) AS roles
    FROM schools s JOIN school_memberships m ON m.id=s.owner_membership_id AND m.school_id=s.id WHERE s.id=$1`, [school]),
    { user_id: owner, status: 'active', origin: 'explicit', roles: 0 });
  assert.equal(await scalar('SELECT count(*)::int FROM legal_acceptances'), acceptancesBefore);
  assert.equal(await scalar('SELECT school_open FROM account_school_access WHERE user_id=$1 AND school_id=$2', [owner, school]), false);
  for (const actor of [owner, platform]) assert.equal(await scalar('SELECT account_manages_school($1,$2)', [actor, school]), false);
  assert.equal(await scalar('SELECT school_is_operational(s) FROM schools s WHERE id=$1', [school]), false);
  checks.push('atomic private draft with one explicit active owner; no staff roles, operational access or legal acceptance');

  const replay = await scalar(createSql, [owner, requestId, settings]);
  assert.equal(replay.data.id, school); assert.equal(replay.replayed, true);
  await denied(createSql, [owner, requestId, { ...settings, description: 'changed retry' }], '23514');
  const otherActor = await scalar(createSql, [stranger, requestId, { ...settings, name: prefix + '-other' }]);
  assert.notEqual(otherActor.data.id, school);
  assert.equal(await scalar('SELECT count(*)::int FROM school_creation_requests WHERE actor_id=$1', [owner]), 1);
  checks.push('actor-scoped replay returns original school; mismatched fingerprint rejected');

  const beforeSchools = await scalar('SELECT count(*)::int FROM schools');
  const beforeMemberships = await scalar('SELECT count(*)::int FROM school_memberships');
  await denied(createSql, [unverified, randomUUID(), { ...settings, name: prefix + '-unverified' }]);
  await denied(createSql, [owner, randomUUID(), { ...settings, name: prefix + '-badspot', operatingSpotIds: [randomUUID()] }], '22023');
  await denied(createSql, [owner, randomUUID(), { ...settings, workspaceStatus: 'active' }], '22023');
  await denied(createSql, [owner, randomUUID(), settings], '23505');
  assert.equal(await scalar('SELECT count(*)::int FROM schools'), beforeSchools);
  assert.equal(await scalar('SELECT count(*)::int FROM school_memberships'), beforeMemberships);
  checks.push('unverified actor, forged lifecycle, missing spot and duplicate slug leave no partial school or owner');
  await client.query(`CREATE FUNCTION pg_temp.b5_fail_owner_setup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    RAISE EXCEPTION 'Synthetic post-school owner setup failure' USING ERRCODE='23514'; END $$`);
  await client.query('CREATE TRIGGER b5_synthetic_setup_failure BEFORE INSERT ON school_memberships FOR EACH ROW EXECUTE FUNCTION pg_temp.b5_fail_owner_setup()');
  await denied(createSql, [owner, randomUUID(), { ...settings, name: prefix + '-rollback' }], '23514');
  await client.query('DROP TRIGGER b5_synthetic_setup_failure ON school_memberships');
  assert.equal(await scalar('SELECT count(*)::int FROM schools'), beforeSchools);
  assert.equal(await scalar('SELECT count(*)::int FROM school_memberships'), beforeMemberships);
  checks.push('failure after school insert rolls back school, membership, request and audit event');


  for (const actor of [stranger, platform]) await denied(updateSql, [actor, school, 1, settings]);
  assert.equal(await scalar('SELECT account_reads_school_settings($1,$2)', [stranger, school]), false);
  const updated = await scalar(updateSql, [owner, school, 1, { ...settings, description: 'Updated', operatingSpotIds: [] }]);
  assert.equal(updated.data.revision, 2); assert.equal(updated.data.description, 'Updated'); assert.deepEqual(updated.data.operatingSpotIds, []);
  await denied(updateSql, [owner, school, 1, settings], '40001');
  await denied(updateSql, [owner, school, 2, { ...settings, owner: stranger }], '22023');
  assert.equal(await scalar('SELECT settings_revision FROM schools WHERE id=$1', [school]), 2);
  checks.push('cross-school and platform draft edits denied; optimistic revision and forged-owner protection');

  const legacy = await scalar('INSERT INTO schools(name) VALUES($1) RETURNING id', [prefix + '-legacy']);
  assert.equal(await scalar('SELECT account_manages_school($1,$2)', [platform, legacy]), true);
  assert.equal(await scalar('SELECT school_is_operational(s) FROM schools s WHERE id=$1', [legacy]), true);
  await client.query("UPDATE schools SET workspace_status='active' WHERE id=$1", [school]);
  assert.equal(await scalar('SELECT school_is_operational(s) FROM schools s WHERE id=$1', [school]), false);
  await client.query("UPDATE schools SET workspace_status='draft',pilot_access_status='approved' WHERE id=$1", [school]);
  assert.equal(await scalar('SELECT school_is_operational(s) FROM schools s WHERE id=$1', [school]), false);
  await client.query("UPDATE schools SET workspace_status='draft',pilot_access_status='pending' WHERE id=$1", [school]);
  const lesson = await scalar(`INSERT INTO lessons(school_id,start_at,duration_min,difficulty,place,spot_id)
    VALUES($1,now()+interval '10 days',90,'Beginner','Test',$2) RETURNING id`, [school, activeSpot]);
  await denied('SELECT reserve_lesson($1,$2,false,NULL,NULL)', [platform, lesson], '23514');
  await denied('SELECT set_school_access($1,$2,$3,$4,$5)', [platform, stranger, school, ['coach'], 'active']);
  await denied('SELECT create_global_account($1,$2::jsonb,$3,$4,$5,false)', [platform, {name:'Blocked',familyName:'Student',email:prefix+'-blocked@example.invalid'}, 'hash', school, []]);
  checks.push('legacy operations preserved; draft lessons, staff grants and incomplete activation denied');

  await client.query("UPDATE users SET password_hash='b5-check',auth_version=1 WHERE id=$1", [owner]);
  const closure = await row('SELECT * FROM complete_account_closure($1,$2,$3)', [owner, 'b5-check', 1]);
  assert.equal(closure.outcome, 'support');
  const closed = await user('closed');
  await client.query("UPDATE users SET deleted_at=now(),self_closed_at=now() WHERE id=$1", [closed]);
  await denied(createSql, [closed, randomUUID(), { ...settings, name: prefix + '-closed' }]);
  await client.query('UPDATE users SET disabled_at=now() WHERE id=$1', [owner]);
  await denied(createSql, [owner, requestId, settings]);
  await denied(updateSql, [owner, school, 2, settings]);
  checks.push('owner closure requires support; closed or disabled identities cannot create, replay or update');
  return checks;
}
