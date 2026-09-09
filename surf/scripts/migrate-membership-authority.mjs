import fs from "node:fs/promises";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {
  connect,
  fingerprint,
  report,
  sourceTables,
} from "./membership-migration-support.mjs";
const [environment, phase, action = "--audit"] = process.argv.slice(2);
assert(["prepare", "activate"].includes(phase));
assert(["--audit", "--rehearse", "--apply"].includes(action));
assert(action !== "--rehearse" || environment === "rehearsal");
const id =
  phase === "prepare"
    ? "20260909_membership_runtime"
    : "20260909_membership_authority";
const client = await connect(environment);
try {
  await client.query("BEGIN");
  await client.query(
    "SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='45s'",
  );
  if (action === "--audit") {
    console.log(JSON.stringify(await report(client)));
    await client.query("ROLLBACK");
  } else {
    await client.query("SELECT pg_advisory_xact_lock(90490901)");
    const source = await fs.readFile(
      new URL(`../db/migrations/${id}.sql`, import.meta.url),
      "utf8",
    );
    const checksum = crypto.createHash("sha256").update(source).digest("hex");
    const prior = (
      await client.query(
        "SELECT checksum FROM identity_schema_migrations WHERE id=$1",
        [id],
      )
    ).rows[0];
    if (prior) {
      assert.equal(prior.checksum, checksum);
      await client.query("ROLLBACK");
      console.log({
        environment,
        id,
        result: "already applied; checksum verified",
      });
    } else {
      await client.query(
        `LOCK TABLE ${sourceTables.join(",")},school_memberships,membership_roles,platform_role_assignments IN SHARE ROW EXCLUSIVE MODE`,
      );
      const before = await fingerprint(client);
      if (phase === "activate") {
        assert.equal((await report(client)).authority, "legacy_shadow");
        await client.query(
          "SELECT sync_legacy_user_memberships(id) FROM users ORDER BY id",
        );
        assert.equal((await report(client)).shadowDifferences, 0);
      }
      await client.query(source);
      await client.query("SET CONSTRAINTS ALL IMMEDIATE");
      assert.deepEqual(
        await fingerprint(client),
        before,
        "Source records changed",
      );
      await client.query(
        "INSERT INTO identity_schema_migrations(id,checksum) VALUES($1,$2)",
        [id, checksum],
      );
      const authority = (
        await client.query(
          "SELECT authority FROM identity_migration_state WHERE singleton",
        )
      ).rows[0].authority;
      await client.query(action === "--rehearse" ? "ROLLBACK" : "COMMIT");
      if (action === "--rehearse")
        assert.deepEqual(await fingerprint(client), before);
      console.log({
        environment,
        id,
        checksum,
        authority,
        result: action === "--rehearse" ? "full rollback passed" : "applied",
        sourceDataUnchanged: true,
      });
    }
  }
} catch (e) {
  await client.query("ROLLBACK");
  console.error(e.message, e.code || "");
  process.exitCode = 1;
} finally {
  await client.end();
}
