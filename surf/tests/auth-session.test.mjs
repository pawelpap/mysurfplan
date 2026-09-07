import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createSessionCodec, SESSION_TTL_SECONDS } from '../lib/auth-session.mjs';

const secret = 'test-only-session-key-with-at-least-32-bytes';
const time = 1788782400;
const payload = { role: 'student', userId: 'existing-user', schoolId: 'existing-school', iat: time };
const codec = (seconds = time, options = {}) => createSessionCodec({ secret, now: () => seconds * 1000, ...options });
// Independent legacy signer verifies compatibility, not just round trips through the new code.
function legacy(value, key = secret) {
  const encoded = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
  return `${encoded}.${crypto.createHmac('sha256', key).update(encoded).digest('base64url')}`;
}
const header = (token) => `msp_session=${token}`;

test('existing signed sessions stay valid until the exact seven-day boundary', () => {
  const cookie = header(legacy(payload));
  assert.deepEqual(codec().read(cookie), payload);
  assert.deepEqual(codec(time + SESSION_TTL_SECONDS - 1).read(cookie), payload);
  assert.equal(codec(time + SESSION_TTL_SECONDS).read(cookie), null);
  assert.equal(codec(time + SESSION_TTL_SECONDS + 1).read(cookie), null);
});

test('missing, invalid, ancient and future issue times cannot bypass expiry', () => {
  for (const iat of [undefined, null, '1788782400', 0, -1, 1.5, time + 61, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(codec().read(header(legacy({ ...payload, iat }))), null, String(iat));
  }
  assert.notEqual(codec().read(header(legacy({ ...payload, iat: time + 60 }))), null);
  assert.equal(codec().read(header(legacy({ ...payload, iat: time - SESSION_TTL_SECONDS, exp: time + 9999999 }))), null);
});

test('tampering, wrong keys and malformed encodings are rejected without exceptions', () => {
  const token = legacy(payload);
  const [encoded, signature] = token.split('.');
  const changed = Buffer.from(JSON.stringify({ ...payload, role: 'platform_admin' })).toString('base64url');
  for (const raw of ['', '.', token + '.extra', `${changed}.${signature}`, legacy(payload, 'wrong-key'),
    `${encoded}.${'A'.repeat(43)}`, `${encoded}.short`, `${encoded}.${signature}=`, '%', '%E0%A4%A',
    `${encoded}.💩`, 'a'.repeat(8193), legacy('not-json'), legacy('null'), legacy('[]'), legacy('true')]) {
    assert.equal(codec().read(header(raw)), null);
  }
});

test('cookie parsing isolates the session and rejects ambiguous duplicates', () => {
  const cookie = header(legacy(payload));
  assert.deepEqual(codec().read(`broken=%E0%A4%A; ${cookie}; another=value`), payload);
  assert.deepEqual(codec().read(`  ${cookie}  `), payload);
  assert.equal(codec().read(`${cookie}; ${cookie}`), null);
  assert.equal(codec().read(`${cookie}; msp_session=%`), null);
  assert.equal(codec().read(`__proto__=x; other_${cookie}`), null);
  for (const value of [undefined, null, '', [], {}]) assert.equal(codec().read(value), null);
});

test('issuing replaces caller timestamps and uses matching secure login/logout attributes', () => {
  const c = codec();
  const issued = c.issue({ ...payload, iat: 1 });
  assert.deepEqual(c.read(issued), payload);
  for (const value of [issued, c.clear()]) {
    assert.match(value, /; Path=\//);
    assert.match(value, /; HttpOnly/);
    assert.match(value, /; SameSite=Lax/);
    assert.match(value, /; Secure/);
    assert.doesNotMatch(value, /Domain=/);
  }
  assert.match(issued, /; Max-Age=604800$/);
  assert.match(c.clear(), /^msp_session=;.*Max-Age=0$/);
  assert.equal(c.read(c.clear()), null);
  assert.doesNotMatch(codec(time, { production: false }).issue(payload), /; Secure/);
});

test('production refuses absent, short, blank and development signing secrets', () => {
  for (const value of [undefined, null, '', 'short', ' '.repeat(40), 'dev-insecure-session-secret']) {
    assert.throws(() => codec(time, { secret: value }), /SESSION_SECRET/);
  }
  assert.doesNotThrow(() => codec());
  assert.doesNotThrow(() => codec(time, { production: false, secret: undefined }));
  const dev = codec(time, { production: false, secret: undefined });
  assert.equal(codec().read(dev.issue(payload)), null);
});
