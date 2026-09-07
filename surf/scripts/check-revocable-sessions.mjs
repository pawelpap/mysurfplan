// Explicit isolated-database check. Never defaults to an application connection.
// Usage: node scripts/check-revocable-sessions.mjs /absolute/path/to/connection-file
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createSessionStore, sessionTokenHash } from '../lib/auth-store.mjs';
if (!process.argv[2]) throw new Error('Supply an isolated branch connection file.');
const client = new pg.Client({ connectionString: (await fs.readFile(process.argv[2], 'utf8')).trim() });
await client.connect();
const sql = async (parts, ...values) => (await client.query(parts.reduce((q, p, i) => q + (i ? `$${i}` : '') + p, ''), values)).rows;
const store = createSessionStore(sql);
try {
  const before = (await client.query('SELECT count(*)::int AS count FROM users')).rows[0].count;
  const migration = await fs.readFile(new URL('../db/migrations/20260907_revocable_sessions.sql', import.meta.url), 'utf8');
  await client.query(migration);
  await client.query(migration);
  assert.equal((await client.query('SELECT count(*)::int AS count FROM users')).rows[0].count, before);
  await client.query('BEGIN');
  const school = (await sql`INSERT INTO schools(name) VALUES ('Revocation isolated check ' || gen_random_uuid()) RETURNING id`)[0].id;
  const user = (await sql`INSERT INTO users(school_id,name,family_name,email,role,password_hash) VALUES (${school},'Session','Check',gen_random_uuid() || '@example.invalid','school_admin','verified-hash') RETURNING id`)[0].id;
  const other = (await sql`INSERT INTO users(school_id,name,email,role,password_hash) VALUES (${school},'Other',gen_random_uuid() || '@example.invalid','student','verified-hash') RETURNING id`)[0].id;
  let count = 0;
  const check = async (name, fn) => { await fn(); count++; console.log(`PASS ${name}`); };
  let a, b, c;
  await check('session creation and hashed storage', async () => {
    a = await store.create(user, 'verified-hash'); b = await store.create(user, 'verified-hash'); c = await store.create(other, 'verified-hash');
    assert.match(a, /^[A-Za-z0-9_-]{43}$/); assert.notEqual(a,b);
    const rows = await sql`SELECT token_hash, expires_at > created_at AS valid FROM auth_sessions WHERE user_id=${user}`;
    assert(rows.every(r => r.valid && /^[0-9a-f]{64}$/.test(r.token_hash)));
    assert(rows.some(r => r.token_hash === sessionTokenHash(a)));
    assert.equal((await store.find(a)).id, user);
    assert.equal((await store.find(a)).password_hash, undefined);
  });
  await check('changed password between verification and issuance rejects login', async () => assert.equal(await store.create(user, 'old-hash'), null));
  await check('single logout rejects replay and preserves other sessions', async () => { await store.revoke(a); assert.equal(await store.find(a),null); assert.equal((await store.find(b)).id,user); });
  await check('role change applies to the next request without re-login', async () => { await sql`UPDATE users SET role='student' WHERE id=${user}`; assert.equal((await store.find(b)).role,'student'); });
  await check('global logout affects only the selected user', async () => { await store.revokeAll(user); assert.equal(await store.find(b),null); assert.equal((await store.find(c)).id,other); });
  await check('login after global logout works', async () => { b=await store.create(user,'verified-hash'); assert.equal((await store.find(b)).id,user); });
  await check('disable prevents access and new sessions', async () => { await sql`UPDATE users SET disabled_at=now() WHERE id=${user}`; assert.equal(await store.find(b),null); assert.equal(await store.create(user,'verified-hash'),null); });
  await check('re-enable never resurrects old sessions', async () => { await sql`UPDATE users SET disabled_at=null WHERE id=${user}`; assert.equal(await store.find(b),null); b=await store.create(user,'verified-hash'); assert(b); });
  await check('password change invalidates all sessions', async () => { await sql`UPDATE users SET password_hash='new-hash' WHERE id=${user}`; assert.equal(await store.find(b),null); assert.equal(await store.create(user,'verified-hash'),null); b=await store.create(user,'new-hash'); assert(b); });
  await check('soft deletion prevents access and new sessions', async () => { await sql`UPDATE users SET deleted_at=now() WHERE id=${user}`; assert.equal(await store.find(b),null); assert.equal(await store.create(user,'new-hash'),null); });
  await check('restoring a deleted user never restores an old session', async () => { await sql`UPDATE users SET deleted_at=null WHERE id=${user}`; assert.equal(await store.find(b),null); b=await store.create(user,'new-hash'); });
  await check('deleted school blocks member access', async () => { await sql`UPDATE schools SET deleted_at=now() WHERE id=${school}`; assert.equal(await store.find(b),null); assert.equal(await store.create(user,'new-hash'),null); await sql`UPDATE schools SET deleted_at=null WHERE id=${school}`; });
  await check('expired sessions and malformed tokens are rejected', async () => { await sql`UPDATE auth_sessions SET created_at=now()-interval '8 days',expires_at=now() WHERE token_hash=${sessionTokenHash(b)}`; assert.equal(await store.find(b),null); for (const token of [null,'',"'; DROP TABLE users;--",'x'.repeat(44)]) assert.equal(await store.find(token),null); });
  await client.query('ROLLBACK');
  assert.equal((await client.query('SELECT count(*)::int AS count FROM users')).rows[0].count, before);
  console.log(`${count} database checks passed; fixtures rolled back; migration idempotent.`);
} finally { await client.query('ROLLBACK').catch(()=>{}); await client.end(); }
