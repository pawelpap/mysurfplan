import fs from "node:fs/promises";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { connect } from "./membership-migration-support.mjs";
import { createSessionStore } from "../lib/auth-store.mjs";

const [environment, action = "--rehearse"] = process.argv.slice(2);
assert(["staging", "production"].includes(environment));
assert(["--rehearse", "--apply"].includes(action));
const id = "20260912_public_demo";
const source = await fs.readFile(new URL(`../db/migrations/${id}.sql`, import.meta.url), "utf8");
const checksum = crypto.createHash("sha256").update(source).digest("hex");
const client = await connect(environment);
const sql = async (strings, ...values) => (await client.query(strings.reduce((s, part, i) => s + (i ? `$${i}` : "") + part, ""), values)).rows;
const store = createSessionStore(sql);
const fingerprints = async () => (await client.query(`
  SELECT 'users' AS kind, md5(COALESCE(jsonb_agg(to_jsonb(u)-'is_demo' ORDER BY u.id),'[]')::text) AS fingerprint
    FROM users u WHERE to_jsonb(u)->>'is_demo' IS DISTINCT FROM 'true'
  UNION ALL SELECT 'students', md5(COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]')::text)
    FROM students s WHERE email<>'demo-student@mywaveplan.invalid'
  UNION ALL SELECT 'spots', md5(COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]')::text) FROM surf_spots s
`)).rows;
try {
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='45s'");
  await client.query("SELECT pg_advisory_xact_lock(90491201)");
  const prior = (await client.query("SELECT checksum FROM identity_schema_migrations WHERE id=$1", [id])).rows[0];
  if (prior) {
    assert.equal(prior.checksum, checksum);
    console.log(JSON.stringify({ environment, id, checksum, result: "already applied" }));
    await client.query("ROLLBACK");
  } else {
    await client.query("LOCK TABLE users,students IN SHARE ROW EXCLUSIVE MODE");
    const before = await fingerprints();
    await client.query(source);
    const demo = (await client.query("SELECT id,role,password_hash FROM users WHERE is_demo")).rows[0];
    assert.equal(demo.role, "student");
    assert.equal(demo.password_hash, null);
    await client.query("SAVEPOINT verification");
    const token = await store.create(demo.id, null, { demo: true });
    assert(token);
    const session = await store.find(token);
    assert.equal(session.is_demo, true);
    assert.equal(session.platform, false);
    assert(session.school_access.every(s => !s.is_owner && s.roles.length === 0));
    assert.equal(await store.create(demo.id, null), null, "Demo cannot use password flow");
    const normal = (await client.query("SELECT id FROM users WHERE username='teststudent' AND deleted_at IS NULL")).rows[0];
    assert(normal);
    assert.equal(await store.create(normal.id, null, { demo: true }), null, "Demo cannot select a normal account");
    await client.query("SAVEPOINT access_change");
    await client.query("UPDATE users SET disabled_at=now() WHERE id=$1", [demo.id]);
    assert.equal(await store.find(token), null);
    assert.equal(await store.create(demo.id, null, { demo: true }), null);
    await client.query("ROLLBACK TO access_change");
    await client.query("INSERT INTO platform_role_assignments(user_id,origin) VALUES($1,'explicit')", [demo.id]);
    assert.equal(await store.find(token), null, "Platform promotion must invalidate demo access");
    assert.equal(await store.create(demo.id, null, { demo: true }), null);
    await client.query("ROLLBACK TO access_change");
    const school = session.school_access[0].school_id;
    const membership = (await client.query("INSERT INTO school_memberships(user_id,school_id,status,origin) VALUES($1,$2,'active','explicit') RETURNING id", [demo.id, school])).rows[0];
    await client.query("INSERT INTO membership_roles(membership_id,role,origin) VALUES($1,'coach','explicit')", [membership.id]);
    assert.equal(await store.find(token), null, "Staff promotion must invalidate demo access");
    assert.equal(await store.create(demo.id, null, { demo: true }), null);
    await client.query("ROLLBACK TO verification");
    assert.deepEqual(await fingerprints(), before, "Existing accounts, students and spot settings must stay unchanged");
    await client.query("INSERT INTO identity_schema_migrations(id,checksum) VALUES($1,$2)", [id, checksum]);
    await client.query(action === "--apply" ? "COMMIT" : "ROLLBACK");
    console.log(JSON.stringify({ environment, id, checksum, result: action === "--apply" ? "applied" : "rollback rehearsal passed", demoUserId: demo.id, studentOnly: true, protectedDataUnchanged: true, testSessionsRolledBack: true }));
  }
} catch (error) {
  await client.query("ROLLBACK");
  console.error(error.message, error.code || "");
  process.exitCode = 1;
} finally {
  await client.end();
}
