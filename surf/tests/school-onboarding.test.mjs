import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { schoolSettingsInput } from '../lib/school-onboarding.mjs';
import { schoolOnboardingHandler } from '../lib/school-onboarding-server.mjs';
const userId = randomUUID(), requestId = randomUUID(), id = randomUUID(), spot = randomUUID();
const input = { requestId, name: 'Test school', timezone: 'Europe/Lisbon' };
const response = () => ({ statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } });
const auth = async () => ({ userId, demo: false });

test('school input canonicalises optional settings and unordered lists for stable retries', () => {
  const value = schoolSettingsInput({ ...input, name: '  Test school ', contactEmail: ' SCHOOL@Example.com ',
    website: 'https://example.com', operatingSpotIds: [spot.toUpperCase(), spot], socialLinks: ['https://example.com/b','https://example.com/a','https://example.com/b'] }, 'create');
  assert.equal(value.name, 'Test school'); assert.equal(value.contactEmail, 'school@example.com');
  assert.equal(value.description, ''); assert.equal(value.website, 'https://example.com/');
  assert.deepEqual(schoolSettingsInput({...input,socialLinks:['https://example.com/@surf']}, 'create').socialLinks, ['https://example.com/@surf']);
  assert.deepEqual(value.operatingSpotIds, [spot]); assert.deepEqual(value.socialLinks, ['https://example.com/a','https://example.com/b']);
});
test('school creation rejects forged authority, lifecycle, ownership, access and malformed settings', () => {
  for (const key of ['owner','ownerId','ownerMembershipId','workspaceKind','workspaceStatus','listingStatus','pilotAccessStatus','roles','schoolId','userId','revision','accepted'])
    assert.throws(() => schoolSettingsInput({ ...input, [key]: 'forged' }, 'create'));
  for (const changes of [
    {requestId: 'bad'}, {name: ''}, {name: 'X'.repeat(161)}, {name: '---'}, {timezone: 'Invalid/Time'},
    {description: 'x'.repeat(5001)}, {contactEmail: 'not-an-email'}, {contactPhone: '<script>'},
    {website: 'javascript:alert(1)'}, {website: 'http://example.com'}, {website: 'https://user:secret@example.com'},
    {socialLinks: Array(6).fill('https://example.com')}, {socialLinks: ['']}, {socialLinks: [42]},
    {operatingSpotIds: [null]}, {operatingSpotIds: Array(31).fill(spot)}, {description: '\u0001'}
  ]) assert.throws(() => schoolSettingsInput({ ...input, ...changes }, 'create'));
});
test('settings update requires an exact bounded optimistic revision and ID', () => {
  const update = { name: input.name, timezone: input.timezone, id, revision: 1 };
  assert.equal(schoolSettingsInput(update, 'update').name, input.name);
  for (const revision of [0, -1, '1', 1.1, null, undefined, Number.MAX_SAFE_INTEGER, 2147483648])
    assert.throws(() => schoolSettingsInput({ ...update, revision }, 'update'));
  assert.throws(() => schoolSettingsInput({ ...update, requestId }, 'update'));
});
test('authenticated actor is the sole SQL actor; create is one atomic call and retries return 200', async () => {
  for (const replayed of [false, true]) {
    let calls = 0;
    const handler = schoolOnboardingHandler({ requireAuth: auth, sql: async (strings, ...values) => {
      calls++; assert(strings.join('?').includes('create_draft_school'));
      assert.equal(values[0], userId); assert.equal(values[1], requestId);
      const settings = JSON.parse(values[2]); assert.equal(settings.name, input.name); assert(!('requestId' in settings));
      return [{ result: { data: { id }, replayed } }];
    }});
    const res = response(); await handler({ method: 'POST', body: input }, res);
    assert.equal(calls, 1); assert.equal(res.statusCode, replayed ? 200 : 201); assert.equal(res.body.data.id, id);
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
  }
});
test('malformed, anonymous and demo requests never reach SQL', async () => {
  for (const [requireAuth, body, status] of [
    [async () => null, input, 200], [async () => ({ userId, demo: true }), input, 403],
    [auth, { ...input, owner: userId }, 400],
  ]) {
    const res = response(); let calls = 0;
    await schoolOnboardingHandler({ requireAuth, sql: async () => { calls++; } })({ method: 'POST', body }, res);
    assert.equal(calls, 0); assert.equal(res.statusCode, status);
  }
});
test('database denial, stale revision and duplicate slug expose safe error keys', async () => {
  for (const [code, status] of [['42501',403],['40001',409],['23505',409],['22023',400],['unknown',503]]) {
    const res = response();
    await schoolOnboardingHandler({ requireAuth: auth, sql: async () => { throw Object.assign(new Error('private database information'), { code }); } })({ method: 'POST', body: input }, res);
    assert.equal(res.statusCode, status); assert(!JSON.stringify(res.body).includes('private database'));
  }
});
test('private list asks the database for current settings authority', async () => {
  const res = response();
  await schoolOnboardingHandler({ requireAuth: auth, sql: async (strings, ...values) => {
    assert(strings.join('?').includes('account_reads_school_settings')); assert(values.every(value => value === userId));
    return [{ data: { id, canEdit: false } }];
  } })({ method: 'GET' }, res);
  assert.deepEqual(res.body.data, [{ id, canEdit: false }]);
});

async function legacyHandler(file, sql, requireAuth) {
  const fs = await import('node:fs/promises');
  const key = '__b5Legacy' + randomUUID().replaceAll('-', '');
  globalThis[key] = { sql, requireAuth, requireMutation: () => true };
  let source = await fs.readFile(new URL('../pages/api/schools/' + file, import.meta.url), 'utf8');
  for (const name of ['sql','requireAuth','requireMutation']) source = source.replace(new RegExp(`import \\{ ${name} \\} from [^;]+;`), `const { ${name} }=globalThis.${key};`);
  const loadedHandler = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  delete globalThis[key];
  return loadedHandler.default;
}
test('school directory requires authentication unless explicitly public and the public query excludes private drafts', async () => {
  let calls = 0, authCalls = 0;
  const handler = await legacyHandler('index.js', async strings => {
    calls++; const query = strings.join('?');
    assert(query.includes('school_is_operational(s)')); assert(query.includes("listing_status='published'"));
    assert(!query.includes('contact_email')); return [{ id, name: 'Visible', slug: 'visible' }];
  }, async () => { authCalls++; return null; });
  const privateRes = response(); await handler({method:'GET',query:{}}, privateRes);
  assert.equal(authCalls, 1); assert.equal(calls, 0);
  const publicRes = response(); await handler({method:'GET',query:{public:'1'}}, publicRes);
  assert.equal(authCalls, 1); assert.equal(calls, 1); assert.equal(publicRes.body.data[0].id, id);
});
test('old school creation rejects a disguised lifecycle or owner field', async () => {
  const handler = await legacyHandler('index.js', async () => assert.fail('No school should be written'), auth);
  for (const field of ['owner_membership_id','workspace_kind','workspace_status','listing_status','pilot_access_status']) {
    const res = response(); await handler({method:'POST',query:{},body:{name:'Forged',[field]:'forged'}},res);
    assert.equal(res.statusCode,400);
  }
});
test('old school mutation targets legacy only and advances revision', async () => {
  const sql = Object.assign(async strings => { assert(strings.join('?').includes("workspace_kind='legacy'")); return []; }, {
    query: async query => { assert(query.includes("workspace_kind='legacy'")); assert(query.includes('settings_revision=settings_revision+1')); return []; },
  });
  const handler = await legacyHandler('[id].js', sql, auth);
  for (const method of ['PATCH','DELETE']) {
    const res = response(); await handler({method,query:{id},body:{name:'Change'}},res);
    assert.equal(res.statusCode,404);
  }
});
