import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationContinuation, invitationLifetime, invitationNext, invitationStorageKey, clearInvitation } from '../lib/invitation-continuation.mjs';
import { accountNext } from '../lib/account-flow.mjs';
const token = 'A'.repeat(43);
function memory() { const data = new Map(); return { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) }; }
test('invitation continuation survives same-tab login without extending its seven-day expiry', () => {
  const storage = memory();
  assert.deepEqual(invitationContinuation('#' + token, storage, 100), { token, stored: true });
  assert.equal(invitationContinuation('', storage, 200).token, token);
  assert.equal(JSON.parse(storage.getItem(invitationStorageKey)).expires, 100 + invitationLifetime);
  assert.equal(invitationContinuation('', storage, 100 + invitationLifetime).token, '');
  assert.equal(storage.getItem(invitationStorageKey), undefined);
});
test('invalid new link clears a previous invitation and corrupted or overlong retention is rejected', () => {
  const storage = memory();
  invitationContinuation('#' + token, storage, 100);
  assert.equal(invitationContinuation('#invalid', storage, 200).token, '');
  assert.equal(invitationContinuation('', storage, 300).token, '');
  storage.setItem(invitationStorageKey, JSON.stringify({token, expires: invitationLifetime + 999}));
  assert.equal(invitationContinuation('', storage, 100).token, '');
});
test('storage failure preserves only the current in-memory token and clearing is safe', () => {
  const denied = { getItem(){throw Error();}, setItem(){throw Error();}, removeItem(){throw Error();} };
  assert.deepEqual(invitationContinuation('#' + token, denied), {token, stored:false});
  assert.equal(invitationContinuation('', denied).token, '');
  assert.doesNotThrow(() => clearInvitation(denied));
});
test('login and signup destinations contain only the allowed locale and pass the existing return validator', () => {
  for (const locale of ['en-GB','pt-PT','es','fr',token,'https://example.com']) {
    const next = invitationNext(locale);
    assert.equal(accountNext(next), next);
    assert.equal(next.includes(token), false);
    assert.equal(next.includes('#'), false);
  }
});

test('all enabled invitation languages provide the same complete messages and interpolation fields', async () => {
  const { invitationMessages } = await import('../lib/locale/invitation-messages.mjs');
  const { createLocale } = await import('../lib/locale/index.mjs');
  const english = invitationMessages['en-GB'];
  const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const locale of ['en-GB','pt-PT','es','fr']) {
    const messages = invitationMessages[locale];
    assert.deepEqual(Object.keys(messages), Object.keys(english));
    for (const [key,value] of Object.entries(messages)) {
      assert.equal(typeof value, 'string', locale + ':' + key);
      assert.notEqual(value.trim(), '', locale + ':' + key);
      assert.deepEqual(placeholders(value), placeholders(english[key]), locale + ':' + key);
      assert.notEqual(createLocale(locale).t(key), key);
    }
  }
});


test('reopening the same invitation does not renew its stored deadline', () => {
  const storage = memory();
  invitationContinuation('#' + token, storage, 100);
  assert.equal(invitationContinuation('#' + token, storage, 500).token, token);
  assert.equal(JSON.parse(storage.getItem(invitationStorageKey)).expires, 100 + invitationLifetime);
  assert.equal(invitationContinuation('#' + token, storage, 100 + invitationLifetime).token, '');
  assert.equal(storage.getItem(invitationStorageKey), undefined);
});
