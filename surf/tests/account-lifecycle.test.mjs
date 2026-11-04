import test from 'node:test';
import assert from 'node:assert/strict';
import { accountLifecycleHandler } from '../lib/account-lifecycle.mjs';
import { hashPassword } from '../lib/passwords.mjs';

const id = '638fae52-bacf-47ab-9017-710a707276ce';
const requestId = '8c4ee5a6-be78-4878-9929-de29cf2628b4';
const originalPassword = 'synthetic current password';
const initialHash = await hashPassword(originalPassword);
const user = { userId: id, role: 'student' };
const secret = { SESSION_SECRET: 'testing-key-'.repeat(4) };

function fixture(session = user, { limit = true, changed = true, closure = 'support' } = {}) {
  const calls = [];
  let cleared = false;
  const sql = async (parts, ...values) => {
    const query = parts.join('?');
    calls.push({ query, values });
    if (query.includes('auth_login_limits')) return [{ allowed: limit, retry_seconds: 20 }];
    if (query.includes('SELECT password_hash,auth_version')) return [{ password_hash: initialHash, auth_version: 7 }];
    if (query.includes('WITH changed AS')) return [{ changed }];
    if (query.includes('complete_account_closure')) return closure === 'support'
      ? [{ outcome: closure, id: requestId, requestedAt: '2026-11-04' }]
      : closure === 'closed' ? [{ outcome: closure }] : [];
    throw Error('Unexpected fixture query');
  };
  const handler = accountLifecycleHandler({
    sql,
    requireAuth: async (_req, res) => {
      if (!session) res.status(401).json({ ok: false });
      return session;
    },
    clearCookie: () => { cleared = true; },
    env: secret,
  });
  return {
    calls,
    async call(method, body, query) {
      const res = { code: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; },
        status(code) { this.code = code; return this; }, json(data) { this.data = data; } };
      await handler({ method, body, query, socket: { remoteAddress: '127.0.0.1' } }, res);
      return { ...res, cleared };
    },
  };
}

test('unauthenticated and demo accounts cannot use security settings', async () => {
  for (const [session, expected] of [[null, 401], [{ ...user, demo: true }, 403]]) {
    const f = fixture(session);
    assert.equal((await f.call('POST', { action: 'closure', confirm: true })).code, expected);
    assert.equal(f.calls.length, 0);
  }
});

test('school and personal accounts cannot read or acknowledge the platform closure queue', async () => {
  for (const role of ['student','school_admin']) {
    const f = fixture({ ...user, role });
    assert.equal((await f.call('GET', null, { review: '1' })).code, 403);
    assert.equal((await f.call('PATCH', { id: requestId })).code, 403);
    assert.equal(f.calls.length, 0);
  }
});

test('an exhausted account limit blocks password verification and account mutation', async () => {
  const f = fixture(user, { limit: false });
  const response = await f.call('POST', { action: 'password', currentPassword: originalPassword, newPassword: 'synthetic new password' });
  assert.equal(response.code, 429);
  assert.equal(response.headers['Retry-After'], '20');
  assert.equal(f.calls.length, 1);
});

test('a wrong current password cannot change a password or lodge a closure request', async () => {
  const f = fixture();
  assert.equal((await f.call('POST', { action: 'closure', currentPassword: 'wrong', confirm: true })).code, 400);
  assert.equal(f.calls.some(({ query }) => query.includes('complete_account_closure')), false);
});

test('a password-change conflict never clears the current cookie as if the operation succeeded', async () => {
  const body = { action: 'password', currentPassword: originalPassword, newPassword: 'synthetic new password' };
  for (const changed of [false, true]) {
    const f = fixture(user, { changed });
    const response = await f.call('POST', body);
    assert.equal(response.code, changed ? 200 : 409);
    assert.equal(response.cleared, changed);
    const mutation = f.calls.at(-1);
    assert(mutation.values.includes(initialHash));
    assert(mutation.values.includes(7));
  }
});

test('closure uses the signed-in account and returns a receipt without clearing its session', async () => {
  const f = fixture();
  const result = await f.call('POST', { action: 'closure', currentPassword: originalPassword, confirm: true,
    userId: 'fake-account' });
  assert.equal(result.code, 200);
  assert.equal(result.data.data.outcome, 'support');
  assert.equal(result.data.data.id, requestId);
  assert.equal(result.cleared, false);
  assert.equal(f.calls.at(-1).values[0], id);
});

test('only completed direct closure clears the signed-in session cookie', async () => {
  for (const [closure, code] of [['closed', 200], [null, 409]]) {
    const f = fixture(user, { closure });
    const response = await f.call('POST', { action: 'closure', currentPassword: originalPassword, confirm: true });
    assert.equal(response.code, code);
    assert.equal(response.cleared, closure === 'closed');
    if (closure) assert.deepEqual(response.data.data, { outcome: closure });
  }
});

test('closure requires explicit confirmation before checking credentials', async () => {
  const f = fixture();
  const response = await f.call('POST', { action: 'closure', currentPassword: originalPassword });
  assert.equal(response.data.error, 'account.closureConfirm');
  assert.equal(f.calls.length, 0);
});

test('platform review requires a support case reference before writing the handoff', async () => {
  const f = fixture({ ...user, role: 'platform_admin' });
  const result = await f.call('PATCH', { id: requestId, supportCase: '' });
  assert.equal(result.code, 400);
  assert.equal(result.data.error, 'account.invalidSupportCase');
  assert.equal(f.calls.length, 0);
});
