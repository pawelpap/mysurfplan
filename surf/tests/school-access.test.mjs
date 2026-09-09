import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { permitsSchoolFilter, isPlatformAdmin } from '../lib/school-access.mjs';

const schoolId = 'a15914fc-0cdb-4604-804d-322c8d6dedb5';
test('school context comes from the session; supplied filters cannot grant access', () => {
  const session = { role: 'school_admin', schoolId, schoolSlug: 'school-a' };
  for (const value of [undefined, '', schoolId, schoolId.toUpperCase(), 'school-a'])
    assert.equal(permitsSchoolFilter(session, value), true);
  for (const value of ['school-b', null, ['school-a'], {}, 'a15914fc-0cdb-4604-804d-322c8d6dedb6'])
    assert.equal(permitsSchoolFilter(session, value), false);
  assert.equal(permitsSchoolFilter({ role: 'student' }, 'school-a'), false);
  assert.equal(isPlatformAdmin({ role: 'school_admin' }), false);
  assert.equal(isPlatformAdmin({ role: 'admin' }), true);
  assert.equal(isPlatformAdmin({ role: 'platform_admin' }), true);
});

// Execute the real handlers with database failures and deliberately over-complete rows.
// The deployed integration script separately verifies the SQL against PostgreSQL.
async function loadHandler(path, sql, role = 'student') {
  const key = '__privacyHandler' + crypto.randomUUID().replaceAll('-', '');
  globalThis[key] = { sql, requireAuth: async () => ({ role, schoolId }), requireMutation: () => true };
  let source = await fs.readFile(new URL('../pages/api/' + path, import.meta.url), 'utf8');
  source = source.replace(/import \{ sql \} from [^;]+;/, `const { sql } = globalThis.${key};`)
    .replace(/import \{ requireAuth \} from [^;]+;/, `const { requireAuth } = globalThis.${key};`)
    .replace(/import \{ requireMutation \} from [^;]+;/, `const { requireMutation } = globalThis.${key};`)
    .replace(/(['"])(?:\.\.\/)+lib\/school-access\.mjs\1/g, JSON.stringify(new URL('../lib/school-access.mjs', import.meta.url).href));
  const module = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  delete globalThis[key];
  return module.default;
}
function response() {
  return { statusCode: 200, setHeader() {}, status(n) { this.statusCode = n; return this; }, json(value) { this.body = value; return this; } };
}

test('student and instructor directory responses omit private instructor fields', async () => {
  for (const role of ['student', 'coach', 'school_admin', 'platform_admin']) {
    const row = { id: schoolId, name: 'Instructor', email: 'private@example.invalid', created_at: '2026-01-01' };
    const handler = await loadHandler('coaches/index.js', async () => [row], role);
    const res = response();
    await handler({ method: 'GET', query: { school: 'school-a' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, ['student', 'coach'].includes(role) ? [{ id: schoolId, name: 'Instructor' }] : [row]);
  }
});

test('public lessons validate filters before querying and retain valid level filters', async () => {
  let calls = 0;
  const handler = await loadHandler('public/lessons.js', async () => { calls++; return []; });
  for (const query of [{ from: '2026-02-30' }, { to: 'bad' }, { difficulty: ['Beginner'] }]) {
    const res = response();
    await handler({ method: 'GET', query: { school: 'school-a', ...query } }, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(calls, 0);
  const res = response();
  await handler({ method: 'GET', query: { school: 'school-a', difficulty: 'Beginner', from: '2026-09-01' } }, res);
  assert.equal(res.statusCode, 404); // A valid filter reaches the school lookup.
  assert.equal(calls, 1);
});

test('database failures never expose database messages or details in public or directory responses', async () => {
  const error = Object.assign(new Error('connection string and SQL contain private@example.invalid'), { detail: 'private database details' });
  for (const path of ['coaches/index.js', 'schools/index.js', 'public/lessons.js', 'health.js']) {
    const handler = await loadHandler(path, async () => { throw error; });
    const res = response();
    await handler({ method: 'GET', query: { school: 'school-a' } }, res);
    assert.equal(res.statusCode, 500, path);
    assert.doesNotMatch(JSON.stringify(res.body), /private@example|connection string|database details|detail/);
  }
});
