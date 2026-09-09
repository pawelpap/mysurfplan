import fs from "node:fs/promises";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { connect, fingerprint } from "./membership-migration-support.mjs";
const [env, mode] = process.argv.slice(2);
const c = await connect(env);
let passed = 0;
async function check(name, fn) {
  await fn();
  console.log(`PASS ${env}: ${name}`);
  passed++;
}
async function rejects(query, args, code) {
  await c.query("SAVEPOINT expected_error");
  let error;
  try {
    await c.query(query, args);
  } catch (e) {
    error = e;
  }
  await c.query("ROLLBACK TO expected_error");
  assert.equal(error?.code, code, error?.message || "Expected a rejection");
}
try {
  await c.query("BEGIN");
  const before = await fingerprint(c);
  if (mode === "--rehearse-all") {
    assert.equal(env, "rehearsal");
    for (const name of [
      "20260909_membership_runtime",
      "20260909_membership_authority",
    ])
      await c.query(
        await fs.readFile(
          new URL(`../db/migrations/${name}.sql`, import.meta.url),
          "utf8",
        ),
      );
  }
  assert.equal(
    (
      await c.query(
        "SELECT authority FROM identity_migration_state WHERE singleton",
      )
    ).rows[0].authority,
    "memberships",
  );
  const school = async () =>
    (
      await c.query("INSERT INTO schools(name) VALUES($1) RETURNING id", [
        "B2 " + crypto.randomUUID(),
      ])
    ).rows[0].id;
  const user = async () =>
    (
      await c.query(
        "INSERT INTO users(name,family_name,email,role) VALUES('B2','Fixture',$1,'student') RETURNING id",
        [crypto.randomUUID() + "@example.invalid"],
      )
    ).rows[0].id;
  const a = await school(),
    b = await school(),
    p = await user(),
    u = await user(),
    v = await user();
  await c.query("INSERT INTO platform_role_assignments(user_id) VALUES($1)", [
    p,
  ]);
  await check(
    "no-school users and multiple independent memberships",
    async () => {
      await c.query(
        "SELECT set_school_access($1,$2,$3,ARRAY['coach','school_admin'],'active')",
        [p, u, a],
      );
      await c.query(
        "SELECT set_school_access($1,$2,$3,ARRAY['coach'],'active')",
        [p, u, b],
      );
      const rows = (
        await c.query(
          "SELECT school_id,roles FROM account_school_access WHERE user_id=$1 ORDER BY school_id",
          [u],
        )
      ).rows;
      assert.equal(rows.length, 2);
      assert.equal(rows.find((r) => r.school_id === a).roles.length, 2);
      assert.equal(
        (
          await c.query(
            "SELECT account_manages_school($1,$2) AS yes,account_manages_school($1,$3) AS no",
            [u, a, b],
          )
        ).rows[0].no,
        false,
      );
      assert.equal(
        (
          await c.query(
            "SELECT count(*)::int AS n FROM coaches WHERE user_id=$1",
            [u],
          )
        ).rows[0].n,
        2,
      );
    },
  );
  await check(
    "students may have independent records in two schools",
    async () => {
      for (const id of [a, b])
        await c.query(
          "INSERT INTO students(school_id,user_id,name,email) SELECT $1,id,name,email FROM users WHERE id=$2",
          [id, v],
        );
      assert.equal(
        (
          await c.query(
            "SELECT count(*)::int AS n FROM students WHERE user_id=$1",
            [v],
          )
        ).rows[0].n,
        2,
      );
    },
  );
  await check(
    "staff cannot control global accounts or create unaccepted affiliations",
    async () => {
      await rejects(
        "SELECT update_global_account($1,$2,$3::jsonb)",
        [u, v, JSON.stringify({ disabled: true })],
        "42501",
      );
      await rejects(
        "SELECT set_school_access($1,$2,$3,ARRAY['coach'],'active')",
        [u, v, a],
        "42501",
      );
      await rejects(
        "SELECT set_school_access($1,$2,$3,ARRAY['platform_admin'],'active')",
        [p, u, a],
        "22023",
      );
    },
  );
  await check(
    "membership suspension does not disable the global account or another school",
    async () => {
      await c.query(
        "SELECT set_school_access($1,$2,$3,ARRAY['coach','school_admin'],'suspended')",
        [p, u, a],
      );
      assert.equal(
        (await c.query("SELECT account_manages_school($1,$2) AS yes", [u, a]))
          .rows[0].yes,
        false,
      );
      assert.equal(
        (await c.query("SELECT disabled_at FROM users WHERE id=$1", [u]))
          .rows[0].disabled_at,
        null,
      );
      assert.equal(
        (
          await c.query(
            "SELECT status FROM account_school_access WHERE user_id=$1 AND school_id=$2",
            [u, b],
          )
        ).rows[0].status,
        "active",
      );
    },
  );
  await check(
    "ownership cannot be suspended or assigned across school boundaries",
    async () => {
      await c.query(
        "SELECT set_school_access($1,$2,$3,ARRAY['school_admin'],'active')",
        [p, u, a],
      );
      const m = (
        await c.query(
          "SELECT id FROM school_memberships WHERE school_id=$1 AND user_id=$2",
          [a, u],
        )
      ).rows[0].id;
      await c.query("UPDATE schools SET owner_membership_id=$1 WHERE id=$2", [
        m,
        a,
      ]);
      await rejects(
        "SELECT set_school_access($1,$2,$3,ARRAY['school_admin'],'suspended')",
        [p, u, a],
        "23514",
      );
      await rejects(
        "SELECT update_global_account($1,$2,$3::jsonb)",
        [p, u, JSON.stringify({ disabled: true })],
        "23514",
      );
    },
  );
  await check(
    "closed and deleted schools preserve personal accounts and other memberships",
    async () => {
      await c.query(
        "UPDATE schools SET workspace_status='closed' WHERE id=$1",
        [a],
      );
      assert.equal(
        (await c.query("SELECT account_manages_school($1,$2) AS yes", [u, a]))
          .rows[0].yes,
        false,
      );
      await c.query("DELETE FROM schools WHERE id=$1", [a]);
      assert.equal(
        (await c.query("SELECT id FROM users WHERE id=$1", [u])).rowCount,
        1,
      );
      assert.equal(
        (
          await c.query(
            "SELECT status FROM school_memberships WHERE user_id=$1 AND school_id=$2",
            [u, b],
          )
        ).rowCount,
        1,
      );
    },
  );
  await check(
    "retired role/school columns cannot receive new authority",
    async () => {
      await rejects(
        "UPDATE users SET role='platform_admin' WHERE id=$1",
        [v],
        "55000",
      );
      assert.equal(
        (await c.query("SELECT account_is_platform($1) AS yes", [v])).rows[0]
          .yes,
        false,
      );
    },
  );
  await check(
    "identity bookings survive email changes, stay idempotent and enforce capacity",
    async () => {
      const spot = (
        await c.query("SELECT id FROM surf_spots WHERE active LIMIT 1")
      ).rows[0].id;
      const lesson = (
        await c.query(
          "INSERT INTO lessons(school_id,start_at,spot_id,capacity) VALUES($1,now()+interval '2 days',$2,1) RETURNING id",
          [b, spot],
        )
      ).rows[0].id;
      const old = (
        await c.query(
          "SELECT id FROM students WHERE school_id=$1 AND user_id=$2",
          [b, v],
        )
      ).rows[0].id;
      await c.query("UPDATE users SET email=$1 WHERE id=$2", [
        crypto.randomUUID() + "@example.invalid",
        v,
      ]);
      assert.equal(
        (
          await c.query("SELECT * FROM reserve_lesson($1,$2,false,'','')", [
            v,
            lesson,
          ])
        ).rows[0].student_id,
        old,
      );
      assert.equal(
        (
          await c.query("SELECT * FROM reserve_lesson($1,$2,false,'','')", [
            v,
            lesson,
          ])
        ).rows[0].outcome,
        "already_booked",
      );
      await rejects(
        "SELECT * FROM reserve_lesson($1,$2,false,'','')",
        [u, lesson],
        "P0003",
      );
      assert.equal(
        (
          await c.query(
            "SELECT count(*)::int AS n FROM bookings WHERE lesson_id=$1",
            [lesson],
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await check(
    "platform operator creates and edits a global account transactionally",
    async () => {
      const details = {
        name: "B2",
        familyName: "Fixture",
        email: crypto.randomUUID() + "@example.invalid",
      };
      const id = (
        await c.query(
          "SELECT create_global_account($1,$2::jsonb,'test-hash',NULL,ARRAY[]::text[],false) AS id",
          [p, JSON.stringify(details)],
        )
      ).rows[0].id;
      await c.query("SELECT update_global_account($1,$2,$3::jsonb)", [
        p,
        id,
        JSON.stringify({ disabled: true }),
      ]);
      assert(
        (await c.query("SELECT disabled_at FROM users WHERE id=$1", [id]))
          .rows[0].disabled_at,
      );
    },
  );
  await c.query("SET CONSTRAINTS ALL IMMEDIATE");
  await c.query("ROLLBACK");
  assert.deepEqual(await fingerprint(c), before);
  console.log({ env, passed, rolledBack: true, sourceDataUnchanged: true });
} catch (e) {
  await c.query("ROLLBACK");
  console.error(e.message, e.code || "");
  process.exitCode = 1;
} finally {
  await c.end();
}
