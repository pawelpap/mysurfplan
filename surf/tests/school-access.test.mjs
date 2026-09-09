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
  const loaded = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  delete globalThis[key];
  return loaded.default;
}
function response() {
  return { statusCode: 200, setHeader() {}, status(n) { this.statusCode = n; return this; }, json(value) { this.body = value; return this; } };
}

test('public lesson filters use the Neon parameterised query API', async () => {
  const sql = async () => [{ id: schoolId }];
  let queried = false;
  sql.query = async (text, values) => {
    queried = true;
    assert.deepEqual(values, [schoolId, '2026-10-01', '2026-10-02T23:59:59', 'Beginner']);
    assert.match(text, /l\.difficulty = \$4/);
    assert.doesNotMatch(text, /2026-10|Beginner/);
    return [];
  };
  const handler = await loadHandler('public/lessons.js', sql);
  const res = response();
  await handler({ method: 'GET', query: { school: schoolId, from: '2026-10-01', to: '2026-10-02', difficulty: 'Beginner' } }, res);
  assert.equal(res.statusCode, 200);
  assert(queried);
});

test('school edits bind arbitrary text as values through the Neon query API', async () => {
  const name = "O'Brien's school; SELECT 'example'";
  const sql = async () => { throw new Error('Expected the parameterised query API'); };
  sql.query = async (text, values) => {
    assert.deepEqual(values, [name, 'school@example.invalid', schoolId]);
    assert.match(text, /name = \$1, contact_email = \$2/);
    assert.doesNotMatch(text, /O'Brien|school@example/);
    return [{ id: schoolId, name }];
  };
  const handler = await loadHandler('schools/[id].js', sql, 'platform_admin');
  const res = response();
  await handler({ method: 'PATCH', query: { id: schoolId }, body: { name, contactEmail: 'school@example.invalid' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.name, name);
});

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
