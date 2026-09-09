// Creates only dedicated fixtures; removes them in finally, including after a failed check.
// Connection files are private and must be verified against the intended Neon branch first.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';

const [environment] = process.argv.slice(2);
const origins = { rehearsal: 'http://localhost:3100', staging: 'https://staging.mywaveplan.com', production: 'https://mywaveplan.com' };
const base = origins[environment];
assert(base, 'Specify rehearsal, staging or production');
const client = new pg.Client({ connectionString: (await fs.readFile(`/private/tmp/mwp-security-${environment}-url`, 'utf8')).trim().replace('sslmode=require', 'sslmode=verify-full') });
await client.connect();
const runId = crypto.randomUUID();
const schools = [], users = [];
const stateFile = `/private/tmp/mwp-school-access-${environment}-${runId}.json`;
const state = () => fs.writeFile(stateFile, JSON.stringify({ base, schools, users }), { mode: 0o600 });
const call = async (path, cookie, method = 'GET', body) => {
  const response = await fetch(base + path, { method, headers: { ...(cookie ? { cookie } : {}), 'X-MyWavePlan-Request': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(65000) });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, body: data, cookie: response.headers.get('set-cookie')?.split(';')[0], cache: response.headers.get('cache-control') };
};
let passed = 0;
async function check(name, run) { await run(); passed++; console.log(`PASS ${environment}: ${name}`); }
function expect(result, status) { assert.equal(result.status, status, JSON.stringify(result.body)); return result.body.data; }
async function makeUser(role, school) {
  const id = crypto.randomUUID(), email = `a1-${id}@example.invalid`, password = crypto.randomBytes(24).toString('base64url');
  const salt = crypto.randomBytes(16);
  const hash = ['msp-scrypt-v1', 16384, 8, 1, salt.toString('base64url'), crypto.scryptSync(password, salt, 64).toString('base64url')].join('$');
  users.push(id); await state();
  await client.query("INSERT INTO users(id,school_id,name,family_name,email,role,password_hash) VALUES($1,$2,'Access check','Fixture',$3,$4,$5)", [id, school?.id || null, email, role, hash]);
  const result = await call('/api/auth/login', null, 'POST', { email, password });
  expect(result, 200); assert(result.cookie);
  return { id, email, cookie: result.cookie, role };
}
try {
  const platform = await makeUser('platform_admin');
  for (const label of ['A', 'B']) {
    const school = expect(await call('/api/schools', platform.cookie, 'POST', { name: `Access check ${runId} ${label}`, contactEmail: `business-${label.toLowerCase()}@example.invalid` }), 201);
    schools.push(school); await state();
  }
  const [a, b] = schools;
  const admin = await makeUser('school_admin', a), otherAdmin = await makeUser('school_admin', b);
  const coach = await makeUser('coach', a), unassigned = await makeUser('coach', a);
  const student = await makeUser('student', a), peer = await makeUser('student', a), outsider = await makeUser('student', b);
  const teacher = expect(await call('/api/coaches', admin.cookie, 'POST', { school: a.id, name: 'Assigned instructor', email: coach.email }), 201);
  const foreignTeacher = expect(await call('/api/coaches', otherAdmin.cookie, 'POST', { school: b.id, name: 'Other school instructor', email: otherAdmin.email }), 201);
  await client.query('UPDATE coaches SET user_id=$1 WHERE id=$2 AND school_id=$3', [coach.id, teacher.id, a.id]);
  const spots = expect(await call('/api/spots', student.cookie), 200);
  const spot = spots.find(s => /bico/i.test(s.name)) || spots[0]; assert(spot);
  const lessonInput = { school: a.id, startAt: new Date(Date.now() + 86400000).toISOString(), durationMin: 90, difficulty: 'Beginner', place: 'Private access test meeting point', capacity: 4, spotId: spot.id, coachIds: [teacher.id] };
  const lesson = expect(await call('/api/lessons', admin.cookie, 'POST', lessonInput), 201);
  const otherLesson = expect(await call('/api/lessons', otherAdmin.cookie, 'POST', { ...lessonInput, school: b.id, coachIds: [foreignTeacher.id] }), 201);
  const lessonPath = `/api/lessons/${lesson.id}`;

  await check('anonymous access is denied before private school or lesson lookup', async () => {
    for (const path of [`/api/lessons?school=${a.id}`, `/api/coaches?school=${a.id}`, '/api/users', `/api/users/${student.id}`, lessonPath + '/conditions']) expect(await call(path), 401);
    expect(await call(lessonPath + '/book', null, 'POST', { email: student.email }), 401);
  });
  await check('school filters and foreign resource IDs cannot cross school boundaries', async () => {
    for (const user of [admin, coach, student]) {
      expect(await call(`/api/lessons?school=${b.id}`, user.cookie), 403);
      expect(await call(`/api/coaches?school=${b.slug}`, user.cookie), 403);
      expect(await call(`/api/lessons/${otherLesson.id}/conditions`, user.cookie), 403);
      expect(await call(`/api/lessons/${otherLesson.id}/book`, user.cookie, 'POST', { email: user.email, name: 'Forbidden' }), 403);
    }
    expect(await call('/api/users?school=' + b.id, admin.cookie), 403);
    expect(await call('/api/users/' + outsider.id, admin.cookie), 404);
    expect(await call('/api/users/' + outsider.id, admin.cookie, 'PATCH', { name: 'Forbidden' }), 404);
    expect(await call('/api/users/' + outsider.id, admin.cookie, 'DELETE', {}), 404);
    expect(await call('/api/users/' + student.id, admin.cookie, 'PATCH', { school: b.id }), 403);
    expect(await call('/api/users', admin.cookie, 'POST', { school: b.id }), 403);
    expect(await call(`/api/lessons/${otherLesson.id}`, admin.cookie, 'PUT', lessonInput), 403);
    expect(await call(`/api/lessons/${otherLesson.id}`, admin.cookie, 'DELETE', {}), 403);
    expect(await call(`/api/lessons/${otherLesson.id}/coaches`, admin.cookie, 'PUT', { coachIds: [] }), 403);
    expect(await call('/api/coaches', admin.cookie, 'DELETE', { id: foreignTeacher.id }), 403);
    assert.equal((await client.query('SELECT name FROM users WHERE id=$1', [outsider.id])).rows[0].name, 'Access check');
  });
  await check('only platform admins can manage schools, surf spots and calibration', async () => {
    for (const user of [admin, coach, student]) {
      for (const [path, method] of [['/api/schools', 'POST'], ['/api/schools/' + a.id, 'PATCH'], ['/api/spots', 'PUT'], ['/api/calibration', 'PUT']])
        expect(await call(path, user.cookie, method, { name: 'Forbidden' }), 403);
      expect(await call('/api/calibration', user.cookie), 403);
    }
    expect(await call('/api/users/' + student.id, admin.cookie, 'PATCH', { role: 'platform_admin' }), 403);
    expect(await call('/api/users/' + platform.id, admin.cookie, 'DELETE', {}), 404);
    expect(await call('/api/schools/' + b.id, platform.cookie), 200);
    expect(await call('/api/users?school=' + b.id, platform.cookie), 200);
  });
  await check('instructors see assigned lessons only; assignment rejects another school', async () => {
    const mine = expect(await call(`/api/lessons?school=${a.id}`, coach.cookie), 200);
    assert.deepEqual(mine.map(l => l.id), [lesson.id]);
    assert.deepEqual(expect(await call(`/api/lessons?school=${a.id}`, unassigned.cookie), 200), []);
    expect(await call(lessonPath + '/conditions', unassigned.cookie), 403);
    expect(await call(lessonPath + '/book', unassigned.cookie, 'POST', { email: peer.email }), 403);
    expect(await call(lessonPath + '/coaches', admin.cookie, 'PUT', { coachIds: [foreignTeacher.id] }), 400);
    expect(await call(lessonPath + '/coaches', student.cookie, 'PUT', { coachIds: [] }), 403);
    expect(await call(lessonPath + '/coaches', admin.cookie, 'PUT', { coachIds: [teacher.id] }), 200);
  });
  await check('students book themselves and cannot add or cancel another student', async () => {
    expect(await call(lessonPath + '/book', student.cookie, 'POST', { email: peer.email }), 403);
    for (const person of [student, peer]) expect(await call(lessonPath + '/book', person.cookie, 'POST', { email: person.email, name: 'Forged profile name' }), 200);
    expect(await call(lessonPath + '/book', student.cookie, 'DELETE', { email: peer.email }), 403);
    assert.equal((await client.query('SELECT name FROM students WHERE school_id=$1 AND email=$2', [a.id, student.email])).rows[0].name, 'Access check Fixture');
  });
  await check('student responses contain only their own booking and no instructor email', async () => {
    for (const person of [student, peer]) {
      const result = await call(`/api/lessons?school=${a.id}`, person.cookie);
      const [row] = expect(result, 200); assert.match(result.cache, /private.*no-store/);
      assert.equal(row.bookedCount, 2); assert.deepEqual(row.attendees.map(s => s.email), [person.email]);
      assert.deepEqual(row.coaches, [{ id: teacher.id, name: 'Assigned instructor' }]);
      const instructors = expect(await call(`/api/coaches?school=${a.id}`, person.cookie), 200);
      assert.deepEqual(instructors, [{ id: teacher.id, name: 'Assigned instructor' }]);
    }
    for (const person of [admin, coach]) assert.equal(expect(await call(`/api/lessons?school=${a.id}`, person.cookie), 200)[0].attendees.length, 2);
  });
  await check('inconsistent legacy links cannot expose another school or claim another user', async () => {
    const foreignStudent = (await client.query("INSERT INTO students(school_id,name,email,user_id) VALUES($1,'Private other-school person',$2,$3) RETURNING id", [b.id, outsider.email, outsider.id])).rows[0];
    await client.query("INSERT INTO bookings(lesson_id,student_id,status) VALUES($1,$2,'booked')", [lesson.id, foreignStudent.id]);
    await client.query('INSERT INTO lesson_coaches(lesson_id,coach_id) VALUES($1,$2)', [lesson.id, foreignTeacher.id]);
    try {
      const [row] = expect(await call(`/api/lessons?school=${a.id}`, admin.cookie), 200);
      assert.equal(row.attendees.length, 2); assert.deepEqual(row.coaches.map(c => c.id), [teacher.id]);
      const [publicRow] = expect(await call(`/api/public/lessons?school=${a.id}`), 200);
      assert.deepEqual(publicRow.coaches.map(c => c.id), [teacher.id]);
    } finally {
      await client.query('DELETE FROM bookings WHERE lesson_id=$1 AND student_id=$2', [lesson.id, foreignStudent.id]);
      await client.query('DELETE FROM lesson_coaches WHERE lesson_id=$1 AND coach_id=$2', [lesson.id, foreignTeacher.id]);
    }
    await client.query('UPDATE students SET user_id=$1 WHERE school_id=$2 AND email=$3', [peer.id, a.id, student.email]);
    try {
      assert.equal(expect(await call(`/api/lessons?school=${a.id}`, student.cookie), 200)[0].attendees.length, 0);
      expect(await call(lessonPath + '/book', student.cookie, 'POST', { email: student.email }), 409);
      expect(await call(lessonPath + '/book', student.cookie, 'DELETE', { email: student.email }), 404);
    } finally {
      await client.query('UPDATE students SET user_id=NULL WHERE school_id=$1 AND email=$2', [a.id, student.email]);
    }
  });
  await check('public schedules retain business contact, instructor names and availability only', async () => {
    const school = expect(await call('/api/schools'), 200).find(s => s.id === a.id);
    assert.equal(school.contact_email, 'business-a@example.invalid');
    assert.deepEqual(Object.keys(school).sort(), ['contact_email', 'id', 'name', 'slug']);
    const [row] = expect(await call(`/api/public/lessons?school=${a.slug}&difficulty=Beginner`), 200);
    assert.equal(row.id, lesson.id); assert.equal(row.spotsLeft, 2);
    assert.equal(row.attendees, undefined); assert.equal(row.schoolId, undefined);
    assert.deepEqual(row.coaches, [{ id: teacher.id, name: 'Assigned instructor' }]);
    assert.doesNotMatch(JSON.stringify(row), /example.invalid/);
    expect(await call(`/api/public/lessons?school=${a.id}&from=invalid`), 400);
  });
  await check('malformed identifiers produce safe validation responses', async () => {
    for (const [path, method, body] of [['/api/users/invalid', 'PATCH', {}], ['/api/lessons/invalid/book', 'POST', {}], [lessonPath + '/coaches', 'PUT', { coachIds: ['invalid'] }], ['/api/coaches', 'DELETE', { id: 'invalid' }]]) {
      const result = await call(path, admin.cookie, method, body); expect(result, 400); assert.equal(result.body.detail, undefined);
    }
  });
  await check('lesson edit, cancellation and rebooking still work', async () => {
    expect(await call(lessonPath, admin.cookie, 'PUT', { ...lessonInput, capacity: 3 }), 200);
    expect(await call(lessonPath + '/book', student.cookie, 'DELETE', { email: student.email }), 200);
    assert.equal(expect(await call(`/api/lessons?school=${a.id}`, student.cookie), 200)[0].attendees.length, 0);
    expect(await call(lessonPath + '/book', student.cookie, 'POST', { email: student.email }), 200);
    assert.equal(expect(await call(`/api/lessons?school=${a.id}`, student.cookie), 200)[0].bookedCount, 2);
  });
  await check('shared demo student remains isolated and receives the full forecast', async () => {
    const demo = await call('/api/auth/login', null, 'POST', { email: 'teststudent', password: 'teststudent' });
    const session = expect(demo, 200).session; assert.equal(session.role, 'student');
    expect(await call('/api/users', demo.cookie), 403);
    expect(await call('/api/lessons?school=' + a.id, demo.cookie), 403);
    expect(await call('/api/coaches?school=' + b.id, demo.cookie), 403);
    expect(await call('/api/spots', demo.cookie, 'POST', {}), 403);
    const forecast = expect(await call('/api/conditions?spot=' + spot.id, demo.cookie), 200);
    assert(forecast.hours.length >= 24); assert.equal(forecast.dates.length, 16);
    const lessonForecast = expect(await call(lessonPath + '/conditions', coach.cookie), 200);
    assert(lessonForecast.window); assert.equal(lessonForecast.hours, undefined);
    expect(await call('/api/auth/session', demo.cookie, 'DELETE'), 200);
  });
  await check('removed test pages are 404; health and login still load', async () => {
    for (const path of ['/test/schools', '/test/coaches', '/test/lessons']) expect(await call(path), 404);
    expect(await call('/login'), 200);
    const health = await call('/api/health'); expect(health, 200); assert.equal(health.body.db, true); assert.equal(health.body.env, undefined);
  });
  console.log(JSON.stringify({ environment, passed, fixtureRun: runId }));
} finally {
  // Exact IDs plus the unique run name prevent cleanup from selecting customer schools.
  await client.query('BEGIN');
  try {
    for (const school of schools) {
      assert.equal((await client.query('SELECT id FROM schools WHERE id=$1 AND name=$2 FOR UPDATE', [school.id, school.name])).rowCount, 1);
      await client.query('DELETE FROM schools WHERE id=$1', [school.id]);
    }
    await client.query("DELETE FROM users WHERE id=ANY($1::uuid[]) AND name='Access check' AND email LIKE 'a1-%@example.invalid'", [users]);
    assert.equal((await client.query('SELECT id FROM users WHERE id=ANY($1::uuid[])', [users])).rowCount, 0);
    await client.query('COMMIT');
    await fs.unlink(stateFile).catch(e => { if (e.code !== 'ENOENT') throw e; });
    console.log(`${environment}: dedicated test schools, accounts, lessons and bookings removed`);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { await client.end(); }
}
