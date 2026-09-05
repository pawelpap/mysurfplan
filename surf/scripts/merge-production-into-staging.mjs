// Add production-only records to staging without replacing existing staging rows.
// Credentials stay in memory; only aggregate counts are logged. Default: rollback.
import fs from "node:fs";
import pg from "pg";

const args = process.argv.slice(2);
const argument = (name) => args[args.indexOf(name) + 1];
if (
  !args.includes("--source-env") ||
  !args.includes("--target-env") ||
  !args.includes("--target-host")
)
  throw new Error(
    "Supply --source-env, --target-env and --target-host. Add --apply to commit.",
  );
function connection(file) {
  const values = Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line) => {
        const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
        if (!match) return [];
        return [
          [
            match[1],
            match[2].startsWith('"') ? JSON.parse(match[2]) : match[2],
          ],
        ];
      }),
  );
  const url = new URL(values.DATABASE_URL || values.POSTGRES_URL);
  url.hostname = url.hostname.replace("-pooler", "");
  url.searchParams.set("sslmode", "verify-full");
  return url;
}
const sourceUrl = connection(argument("--source-env"));
const targetUrl = connection(argument("--target-env"));
const productionHost = "ep-young-morning-adnwtqiz.c-2.us-east-1.aws.neon.tech";
if (
  sourceUrl.hostname !== productionHost ||
  targetUrl.hostname === productionHost ||
  targetUrl.hostname !== argument("--target-host")
)
  throw new Error(
    "Source must be production; target must be the explicitly verified staging or rehearsal endpoint.",
  );
const source = new pg.Client({ connectionString: sourceUrl.toString() });
const target = new pg.Client({ connectionString: targetUrl.toString() });
const tables = [
  "schools",
  "users",
  "coaches",
  "students",
  "lessons",
  "lesson_coaches",
  "bookings",
  "surf_lessons",
  "surf_bookings",
];
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
const added = {},
  skipped = {};
const userIds = new Map();
let copiedLogins = 0,
  mappedLessons = 0;
try {
  await source.connect();
  await target.connect();
  await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await target.query("BEGIN");
  await target.query("SET LOCAL lock_timeout = '10s'");
  await target.query(
    fs.readFileSync(
      new URL(
        "../db/migrations/20260905_preserve_legacy_tables.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const spots = new Map(
    (await target.query("SELECT slug,id FROM surf_spots")).rows.map((s) => [
      s.slug,
      s.id,
    ]),
  );
  const placeSlugs = {
    "Sao Pedro": "sao-pedro-estoril",
    "Sao Pedo": "sao-pedro-estoril",
    Carcavelos: "carcavelos",
  };
  for (const table of tables) {
    const expression =
      table === "users" ? "to_jsonb(t)-'password_hash'" : "to_jsonb(t)";
    const rows = (
      await source.query(
        `SELECT ${expression} AS row FROM public.${quote(table)} t`,
      )
    ).rows.map((r) => r.row);
    const existing = (
      await target.query(
        `SELECT ${expression} AS row FROM public.${quote(table)} t`,
      )
    ).rows.map((r) => r.row);
    const columns = new Set(
      (
        await target.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND is_generated='NEVER'",
          [table],
        )
      ).rows.map((c) => c.column_name),
    );
    added[table] = 0;
    skipped[table] = 0;
    for (const original of rows) {
      const row = { ...original };
      const match = existing.find((e) =>
        table === "surf_bookings"
          ? e.lesson_id === row.lesson_id && e.email === row.email
          : e.id === row.id ||
            (table === "users" &&
              e.email?.toLowerCase() === row.email?.toLowerCase()),
      );
      if (match) {
        if (table === "users") {
          if (match.role !== row.role || match.school_id !== row.school_id)
            throw new Error("Conflicting account scope");
          userIds.set(row.id, match.id);
        }
        skipped[table]++;
        continue;
      }
      if (row.user_id) {
        if (!userIds.has(row.user_id))
          throw new Error("Missing account mapping");
        row.user_id = userIds.get(row.user_id);
      }
      if (table === "lessons" && !row.spot_id && placeSlugs[row.place]) {
        row.spot_id = spots.get(placeSlugs[row.place]);
        if (!row.spot_id) throw new Error("Missing reviewed surf spot");
        mappedLessons++;
      }
      if (table === "users" && args.includes("--include-login-credentials")) {
        // Copy only this missing account's existing credential directly to the
        // verified target. Never export or log passwords or password hashes.
        const credential = await source.query(
          "SELECT password_hash FROM users WHERE id=$1",
          [row.id],
        );
        row.password_hash = credential.rows[0].password_hash;
        copiedLogins += row.password_hash ? 1 : 0;
      }
      const names = Object.keys(row).filter((name) => columns.has(name));
      await target.query(
        `INSERT INTO public.${quote(table)} (${names.map(quote).join(",")}) VALUES (${names.map((_, i) => "$" + (i + 1)).join(",")})`,
        names.map((name) => row[name]),
      );
      delete row.password_hash;
      if (table === "users") userIds.set(row.id, row.id);
      existing.push(row);
      added[table]++;
    }
  }
  const counts = {};
  for (const table of tables)
    counts[table] = Number(
      (await target.query(`SELECT count(*) AS n FROM public.${quote(table)}`))
        .rows[0].n,
    );
  await target.query(args.includes("--apply") ? "COMMIT" : "ROLLBACK");
  await source.query("COMMIT");
  console.log(
    JSON.stringify({
      committed: args.includes("--apply"),
      targetHost: targetUrl.hostname,
      added,
      skipped,
      counts,
      copiedLogins,
      mappedLessons,
    }),
  );
} catch (error) {
  await target.query("ROLLBACK").catch(() => {});
  await source.query("ROLLBACK").catch(() => {});
  // Database errors can contain row values. Do not print their detail or values.
  console.error(
    JSON.stringify({
      failed: true,
      code: error.code || "MERGE_FAILED",
      constraint: error.constraint || null,
    }),
  );
  process.exitCode = 1;
} finally {
  await Promise.allSettled([source.end(), target.end()]);
}
