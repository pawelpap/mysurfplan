import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createSessionCodec } from "../lib/auth-session.mjs";

const secret = "test-only-session-key-with-at-least-32-bytes";
process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = secret;
let user = {
  id: "user-id",
  role: "school_admin",
  school_id: "school-a",
  email: "test@example.invalid",
};
let calls = 0,
  fail = false;
globalThis.__authTestSql = async (parts, ...values) => {
  calls++;
  if (fail) throw new Error("database unavailable");
  if (parts.join("").includes("UPDATE users SET preferred_locale")) {
    const [locale, id] = values;
    assert.equal(id, user.id);
    user.preferred_locale = locale;
    return [{ preferred_locale: locale }];
  }
  return user
    ? [
        {
          ...user,
          authority: "memberships",
          platform: false,
          school_access: [
            {
              school_id: user.school_id,
              name: "School",
              slug: user.school_id,
              status: "active",
              roles: user.role === "school_admin" ? ["school_admin"] : [],
              school_open: true,
              is_owner: false,
            },
          ],
        },
      ]
    : [];
};
const source = (
  await fs.readFile(new URL("../lib/auth.js", import.meta.url), "utf8")
)
  .replace(
    /import \{ sql \} from ["']\.\/db["'];/,
    "const sql = globalThis.__authTestSql;",
  )
  .replace(/["']\.\/([a-z/-]+\.mjs)["']/g, (_, name) =>
    JSON.stringify(new URL("../lib/" + name, import.meta.url).href),
  );
const auth = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);
const codec = createSessionCodec({ secret, production: false });
const req = (payload = { sid: "x".repeat(43) }) => ({
  headers: { cookie: codec.issue(payload) },
});
const res = () => ({
  headers: {},
  setHeader(k, v) {
    this.headers[k] = v;
  },
  status(s) {
    this.statusCode = s;
    return this;
  },
  json(j) {
    this.body = j;
    return this;
  },
});

test("legacy stateless cookies cannot authenticate even with a signed admin role", async () => {
  const before = calls;
  assert.equal(
    await auth.getAuthSession(
      req({ role: "platform_admin", userId: "user-id" }),
    ),
    null,
  );
  assert.equal(calls, before);
});
test("only a single request shares a lookup; the next request reads current permissions", async () => {
  const before = calls,
    request = req();
  await auth.getAuthSession(request);
  await auth.getAuthSession(request);
  assert.equal(calls, before + 1);
  user = { ...user, role: "student", school_id: "school-b" };
  const current = await auth.getAuthSession(req());
  assert.equal(current.role, "student");
  assert.equal(current.schoolId, "school-b");
  const denied = res();
  assert.equal(
    await auth.requireAuth(req(), denied, { roles: ["school_admin"] }),
    null,
  );
  assert.equal(denied.statusCode, 403);
  const wrongSchool = res();
  assert.equal(
    await auth.requireAuth(req(), wrongSchool, { schoolId: "school-a" }),
    null,
  );
  assert.equal(wrongSchool.statusCode, 403);
});
test("invalidated sessions and database failures never fall back to cookie privileges", async () => {
  user = null;
  const unauth = res();
  assert.equal(await auth.requireAuth(req(), unauth), null);
  assert.equal(unauth.statusCode, 401);
  fail = true;
  const unavailable = res();
  assert.equal(await auth.requireAuth(req(), unavailable), null);
  assert.equal(unavailable.statusCode, 503);
  assert.match(unavailable.headers["Cache-Control"], /no-store/);
  assert.doesNotMatch(JSON.stringify(unavailable.body), /database unavailable/);
  const logout = res();
  await assert.rejects(auth.clearAuthSession(req(), logout));
  assert.equal(logout.headers["Set-Cookie"], undefined);
  fail = false;
});
test("every API authentication call awaits the database check", async () => {
  const root = new URL("../pages/api/", import.meta.url);
  for (const file of await fs.readdir(root, { recursive: true })) {
    if (!file.endsWith(".js")) continue;
    const text = await fs.readFile(new URL(file, root), "utf8");
    for (const match of text.matchAll(
      /\b(requireAuth|getAuthSession|setUserAuthSession|clearAuthSession)\s*\(/g,
    )) {
      assert.match(
        text.slice(Math.max(0, match.index - 10), match.index),
        /await\s+$/,
        `${file}: ${match[1]} must be awaited`,
      );
    }
  }
});
test("demo sessions have student rights, cannot write, and cannot log out other visitors", async () => {
  user = { id: "demo", role: "student", school_id: "school-demo", is_demo: true };
  const current = await auth.getAuthSession(req());
  assert.equal(current.demo, true);
  assert.equal(current.role, "student");
  assert.equal((await auth.requireAuth({ ...req(), method: "GET" }, res())).demo, true);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const request = req(); request.method = method; request.headers["x-mywaveplan-request"] = "1";
    const denied = res();
    assert.equal(await auth.requireAuth(request, denied), null);
    assert.equal(denied.statusCode, 403);
  }
  const denied = res();
  assert.equal(await auth.requireAuth(req(), denied, { roles: ["platform_admin"] }), null);
  assert.equal(denied.statusCode, 403);
  await assert.rejects(auth.clearAuthSession(req(), res(), { all: true }), e => e.statusCode === 403);
  await auth.clearAuthSession(req(), res());
});

test("language updates are private, limited to the current account and reversible", async () => {
  const handlerSource = (
    await fs.readFile(new URL("../pages/api/auth/locale.js", import.meta.url), "utf8")
  )
    .replace('import { requireAuth } from "../../../lib/auth";', "const { requireAuth } = globalThis.__authForLocaleTest;")
    .replace('import { sql } from "../../../lib/db";', "const sql = globalThis.__authTestSql;")
    .replace('"../../../lib/locale/preferences.mjs"', JSON.stringify(new URL("../lib/locale/preferences.mjs", import.meta.url).href));
  globalThis.__authForLocaleTest = auth;
  const { default: handler } = await import(
    `data:text/javascript;base64,${Buffer.from(handlerSource).toString("base64")}`
  );
  user = { id: "personal-account", role: "student", school_id: "school-a" };

  async function patch(body, headers = {}, signed = true) {
    const response = res();
    const request = signed ? req() : { headers: {} };
    request.method = "PATCH";
    request.body = body;
    Object.assign(request.headers, { "x-mywaveplan-request": "1", ...headers });
    await handler(request, response);
    return response;
  }

  assert.equal((await patch({ locale: "pt-PT" }, {}, false)).statusCode, 401);
  assert.equal((await patch({ locale: "pt-PT" }, { "sec-fetch-site": "cross-site" })).statusCode, 403);
  assert.equal((await patch({ locale: "pt-BR" })).statusCode, 400);
  assert.equal((await patch({})).statusCode, 400);
  assert.equal((await auth.getAuthSession(req())).preferredLocale, null);

  const saved = await patch({ locale: "pt-PT", userId: "another-account" });
  assert.equal(saved.statusCode, 200);
  assert.match(saved.headers["Cache-Control"], /no-store/);
  assert.equal((await auth.getAuthSession(req())).preferredLocale, "pt-PT");

  user.is_demo = true;
  assert.equal((await patch({ locale: "es" })).statusCode, 403);
  assert.equal((await auth.getAuthSession(req())).preferredLocale, null);
  user.is_demo = false;
  assert.equal((await auth.getAuthSession(req())).preferredLocale, "pt-PT");
  assert.equal((await patch({ locale: null })).statusCode, 200);
  assert.equal((await auth.getAuthSession(req())).preferredLocale, null);
});
