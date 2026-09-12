import assert from "node:assert/strict";
const base = process.argv[2];
assert(["https://staging.mywaveplan.com", "https://mywaveplan.com"].includes(base));
const sessions = new Set();
const checks = [];
async function call(path, { method = "GET", body, cookie, origin = base } = {}) {
  const response = await fetch(base + path, {
    method, redirect: "manual", signal: AbortSignal.timeout(60000),
    headers: { "Content-Type": "application/json", "X-MyWavePlan-Request": "1", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const setCookie = response.headers.get("set-cookie");
  const issued = setCookie?.split(";")[0];
  if (issued && !issued.endsWith("=")) sessions.add(issued);
  return { status: response.status, cookie: issued, headers: response.headers, json: await response.json() };
}
const mark = name => checks.push(name);
try {
  const empty = await call("/api/auth/login", { method: "POST", body: { email: "", password: "" } });
  assert.equal(empty.status, 200);assert(empty.cookie);assert.equal(empty.json.data.session.role, "student");assert.equal(empty.json.data.session.demo, true);
  assert(empty.json.data.session.schools.every(s => !s.owner && s.roles.length === 0));
  assert.match(empty.headers.get("set-cookie"), /HttpOnly/);assert.match(empty.headers.get("set-cookie"), /Secure/);assert.match(empty.headers.get("cache-control"), /no-store/);
  mark("Empty fields create a secure student demo session");
  const second = await call("/api/auth/login", { method: "POST", body: { email: "", password: "", role: "platform_admin", userId: "ignored" } });
  assert.equal(second.status, 200);assert.notEqual(second.cookie, empty.cookie);assert.equal(second.json.data.session.userId, empty.json.data.session.userId);assert.equal(second.json.data.session.role, "student");
  mark("Separate visitor sessions; caller cannot select another account or role");
  const spots = await call("/api/spots", { cookie: empty.cookie });assert.equal(spots.status, 200);assert.equal(spots.json.data.length, 17);
  const bico = spots.json.data.find(spot => spot.name.includes("Bico"));assert(bico);
  const conditions = await call(`/api/conditions?spot=${encodeURIComponent(bico.slug)}`, { cookie: empty.cookie });
  assert.equal(conditions.status, 200);assert.equal(conditions.json.data.days.length, 16);
  mark("Demo can read 17 spots and the 16-day forecast");
  for (const path of ["/api/users", "/api/calibration", "/api/memberships"]) assert.equal((await call(path, { cookie: empty.cookie })).status, 403);
  for (const path of ["/api/spots", "/api/schools", "/api/lessons/00000000-0000-4000-8000-000000000000/book"]) assert.equal((await call(path, { method: "POST", cookie: empty.cookie, body: {} })).status, 403);
  mark("Staff/private endpoints and mutations are denied");
  assert.equal((await call("/api/auth/session?all=1", { method: "DELETE", cookie: empty.cookie })).status, 403);
  assert.equal((await call("/api/auth/session", { cookie: second.cookie })).json.data.demo, true);
  assert.equal((await call("/api/auth/session", { method: "DELETE", cookie: empty.cookie })).status, 200);sessions.delete(empty.cookie);
  assert.equal((await call("/api/spots", { cookie: empty.cookie })).status, 401);
  assert.equal((await call("/api/auth/session", { cookie: second.cookie })).json.data.demo, true);
  mark("Logout revokes only this visitor; global demo logout is blocked");
  for (const body of [{}, { email: "teststudent", password: "" }, { email: "", password: "teststudent" }, { email: "teststudent", password: "incorrect-demo-check" }]) {
    const result = await call("/api/auth/login", { method: "POST", body });assert.equal(result.status, 401);assert(!result.cookie);
  }
  assert.equal((await call("/api/auth/login", { method: "POST", body: { email: "", password: "" }, origin: "https://example.invalid" })).status, 403);
  mark("Partial/wrong credentials and cross-origin submissions never grant demo access");
  const normal = await call("/api/auth/login", { method: "POST", body: { email: "teststudent", password: "teststudent" } });
  assert.equal(normal.status, 200);assert.equal(normal.json.data.session.demo, false);assert.equal(normal.json.data.session.role, "student");assert.notEqual(normal.json.data.session.userId, second.json.data.session.userId);
  mark("Existing teststudent password login remains separate and working");
  console.log(JSON.stringify({ base, checks, passed: checks.length }));
} finally {
  for (const cookie of sessions) {
    assert.equal((await call("/api/auth/session", { method: "DELETE", cookie })).status, 200);
  }
  console.log(JSON.stringify({ base, temporarySessionsRevoked: true }));
}
