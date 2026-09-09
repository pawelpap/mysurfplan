// Creates only dedicated fixtures; removes them in finally, including after a failed check.
// Connection files are private and must be verified against the intended Neon branch first.
import fs from "node:fs/promises";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { connect } from "./membership-migration-support.mjs";

const [environment] = process.argv.slice(2);
const origins = {
  rehearsal: "http://localhost:3100",
  staging: "https://staging.mywaveplan.com",
  production: "https://mywaveplan.com",
};
const base = origins[environment];
assert(base, "Specify rehearsal, staging or production");
const client = await connect(environment);
const runId = crypto.randomUUID();
const schools = [],
  users = [];
const stateFile = `/private/tmp/mwp-b2-access-${environment}-${runId}.json`;
const state = () =>
  fs.writeFile(stateFile, JSON.stringify({ base, schools, users }), {
    mode: 0o600,
  });
const call = async (path, cookie, method = "GET", body) => {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      "X-MyWavePlan-Request": "1",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(65000),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return {
    status: response.status,
    body: data,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
    cache: response.headers.get("cache-control"),
  };
};
const ownDemoCookies = [];
let fixturePlatform;
let passed = 0;
async function check(name, run) {
  if (
    process.argv.includes("--browser-only") &&
    !/^(students book themselves|lesson edit|dual roles|self-booking|suspension immediately|bookings from two|school closure)/.test(
      name,
    )
  )
    return;
  await run();
  passed++;
  console.log(`PASS ${environment}: ${name}`);
}
function expect(result, status) {
  assert.equal(result.status, status, JSON.stringify(result.body));
  return result.body.data;
}
async function makeUser(role, school) {
  const id = crypto.randomUUID(),
    email = `b2-${id}@example.invalid`,
    password = crypto.randomBytes(24).toString("base64url");
  const salt = crypto.randomBytes(16);
  const hash = [
    "msp-scrypt-v1",
    16384,
    8,
    1,
    salt.toString("base64url"),
    crypto.scryptSync(password, salt, 64).toString("base64url"),
  ].join("$");
  users.push(id);
  await state();
  await client.query(
    "INSERT INTO users(id,school_id,name,family_name,email,role,password_hash) VALUES($1,NULL,'Access check','Fixture',$2,'student',$3)",
    [id, email, hash],
  );
  if (role === "platform_admin") {
    await client.query(
      "INSERT INTO platform_role_assignments(user_id) VALUES($1)",
      [id],
    );
    fixturePlatform = id;
  } else if (["school_admin", "coach"].includes(role))
    await client.query(
      "SELECT set_school_access($1,$2,$3,ARRAY[$4]::text[],'active')",
      [fixturePlatform, id, school.id, role],
    );
  else if (school)
    await client.query(
      "INSERT INTO students(school_id,user_id,name,email) VALUES($1,$2,'Access check Fixture',$3)",
      [school.id, id, email],
    );
  const result = await call("/api/auth/login", null, "POST", {
    email,
    password,
  });
  expect(result, 200);
  assert(result.cookie);
  return { id, email, cookie: result.cookie, role };
}
try {
  const platform = await makeUser("platform_admin");
  for (const label of ["A", "B"]) {
    const school = expect(
      await call("/api/schools", platform.cookie, "POST", {
        name: `Access check ${runId} ${label}`,
        contactEmail: `business-${label.toLowerCase()}@example.invalid`,
      }),
      201,
    );
    schools.push(school);
    await state();
  }
  const [a, b] = schools;
  await check(
    "platform school edits preserve parameterised values",
    async () => {
      const name = `Access check ${runId} O'Brien`;
      const updated = expect(
        await call("/api/schools/" + a.id, platform.cookie, "PATCH", {
          name,
          contactEmail: "updated@example.invalid",
        }),
        200,
      );
      assert.equal(updated.name, name);
      assert.equal(updated.contact_email, "updated@example.invalid");
      Object.assign(a, updated);
      await state();
      const stored = expect(
        await call("/api/schools/" + a.id, platform.cookie),
        200,
      );
      assert.equal(stored.name, name);
    },
  );
  const admin = await makeUser("school_admin", a),
    otherAdmin = await makeUser("school_admin", b);
  const coach = await makeUser("coach", a),
    unassigned = await makeUser("coach", a);
  const student = await makeUser("student", a),
    peer = await makeUser("student", a),
    outsider = await makeUser("student", b);
  const teacher = (
    await client.query(
      "UPDATE coaches SET name='Assigned instructor' WHERE user_id=$1 AND school_id=$2 RETURNING id,name",
      [coach.id, a.id],
    )
  ).rows[0];
  const foreignTeacher = expect(
    await call("/api/coaches", otherAdmin.cookie, "POST", {
      school: b.id,
      name: "Other school instructor",
      email: otherAdmin.email,
    }),
    201,
  );
  await client.query(
    "UPDATE coaches SET user_id=$1 WHERE id=$2 AND school_id=$3",
    [coach.id, teacher.id, a.id],
  );
  const spots = expect(await call("/api/spots", student.cookie), 200);
  const spot = spots.find((s) => /bico/i.test(s.name)) || spots[0];
  assert(spot);
  const lessonInput = {
    school: a.id,
    startAt: new Date(Date.now() + 86400000).toISOString(),
    durationMin: 90,
    difficulty: "Beginner",
    place: "Private access test meeting point",
    capacity: 4,
    spotId: spot.id,
    coachIds: [teacher.id],
  };
  const lesson = expect(
    await call("/api/lessons", admin.cookie, "POST", lessonInput),
    201,
  );
  const otherLesson = expect(
    await call("/api/lessons", otherAdmin.cookie, "POST", {
      ...lessonInput,
      school: b.id,
      coachIds: [foreignTeacher.id],
    }),
    201,
  );
  const lessonPath = `/api/lessons/${lesson.id}`;

  await check(
    "anonymous access is denied before private school or lesson lookup",
    async () => {
      for (const path of [
        `/api/lessons?school=${a.id}`,
        `/api/coaches?school=${a.id}`,
        "/api/users",
        `/api/users/${student.id}`,
        lessonPath + "/conditions",
      ])
        expect(await call(path), 401);
      expect(
        await call(lessonPath + "/book", null, "POST", {
          email: student.email,
        }),
        401,
      );
    },
  );
  await check(
    "school filters and foreign resource IDs cannot cross school boundaries",
    async () => {
      for (const user of [admin, coach, student]) {
        expect(await call(`/api/lessons?school=${b.id}`, user.cookie), 403);
        expect(await call(`/api/coaches?school=${b.slug}`, user.cookie), 403);
        expect(
          await call(`/api/lessons/${otherLesson.id}/conditions`, user.cookie),
          403,
        );
        expect(
          await call(
            `/api/lessons/${otherLesson.id}/book`,
            user.cookie,
            "POST",
            { email: user.email, name: "Forbidden" },
          ),
          403,
        );
      }
      expect(await call("/api/users?school=" + b.id, admin.cookie), 403);
      expect(await call("/api/users/" + outsider.id, admin.cookie), 403);
      expect(
        await call("/api/users/" + outsider.id, admin.cookie, "PATCH", {
          name: "Forbidden",
        }),
        403,
      );
      expect(
        await call("/api/users/" + outsider.id, admin.cookie, "DELETE", {}),
        403,
      );
      expect(
        await call("/api/users/" + student.id, admin.cookie, "PATCH", {
          school: b.id,
        }),
        403,
      );
      expect(
        await call("/api/users", admin.cookie, "POST", { school: b.id }),
        403,
      );
      expect(
        await call(
          `/api/lessons/${otherLesson.id}`,
          admin.cookie,
          "PUT",
          lessonInput,
        ),
        403,
      );
      expect(
        await call(
          `/api/lessons/${otherLesson.id}`,
          admin.cookie,
          "DELETE",
          {},
        ),
        403,
      );
      expect(
        await call(
          `/api/lessons/${otherLesson.id}/coaches`,
          admin.cookie,
          "PUT",
          { coachIds: [] },
        ),
        403,
      );
      expect(
        await call("/api/coaches", admin.cookie, "DELETE", {
          id: foreignTeacher.id,
        }),
        403,
      );
      assert.equal(
        (
          await client.query("SELECT name FROM users WHERE id=$1", [
            outsider.id,
          ])
        ).rows[0].name,
        "Access check",
      );
    },
  );
  await check(
    "only platform admins can manage schools, surf spots and calibration",
    async () => {
      for (const user of [admin, coach, student]) {
        for (const [path, method] of [
          ["/api/schools", "POST"],
          ["/api/schools/" + a.id, "PATCH"],
          ["/api/spots", "PUT"],
          ["/api/calibration", "PUT"],
        ])
          expect(
            await call(path, user.cookie, method, { name: "Forbidden" }),
            403,
          );
        expect(await call("/api/calibration", user.cookie), 403);
      }
      expect(
        await call("/api/users/" + student.id, admin.cookie, "PATCH", {
          role: "platform_admin",
        }),
        403,
      );
      expect(
        await call("/api/users/" + platform.id, admin.cookie, "DELETE", {}),
        403,
      );
      expect(await call("/api/schools/" + b.id, platform.cookie), 200);
      expect(await call("/api/users?school=" + b.id, platform.cookie), 200);
    },
  );
  await check(
    "instructors see assigned lessons only; assignment rejects another school",
    async () => {
      const mine = expect(
        await call(`/api/lessons?school=${a.id}`, coach.cookie),
        200,
      );
      assert.deepEqual(
        mine.map((l) => l.id),
        [lesson.id],
      );
      assert.deepEqual(
        expect(
          await call(`/api/lessons?school=${a.id}`, unassigned.cookie),
          200,
        ),
        [],
      );
      expect(await call(lessonPath + "/conditions", unassigned.cookie), 403);
      expect(
        await call(lessonPath + "/book", unassigned.cookie, "POST", {
          email: peer.email,
        }),
        403,
      );
      expect(
        await call(lessonPath + "/coaches", admin.cookie, "PUT", {
          coachIds: [foreignTeacher.id],
        }),
        400,
      );
      expect(
        await call(lessonPath + "/coaches", student.cookie, "PUT", {
          coachIds: [],
        }),
        403,
      );
      expect(
        await call(lessonPath + "/coaches", admin.cookie, "PUT", {
          coachIds: [teacher.id],
        }),
        200,
      );
    },
  );
  await check(
    "students book themselves and cannot add or cancel another student",
    async () => {
      expect(
        await call(lessonPath + "/book", student.cookie, "POST", {
          email: peer.email,
        }),
        403,
      );
      for (const person of [student, peer])
        expect(
          await call(lessonPath + "/book", person.cookie, "POST", {
            email: person.email,
            name: "Forged profile name",
          }),
          200,
        );
      expect(
        await call(lessonPath + "/book", student.cookie, "DELETE", {
          email: peer.email,
        }),
        403,
      );
      assert.equal(
        (
          await client.query(
            "SELECT name FROM students WHERE school_id=$1 AND email=$2",
            [a.id, student.email],
          )
        ).rows[0].name,
        "Access check Fixture",
      );
    },
  );
  await check(
    "student responses contain only their own booking and no instructor email",
    async () => {
      for (const person of [student, peer]) {
        const result = await call(`/api/lessons?school=${a.id}`, person.cookie);
        const [row] = expect(result, 200);
        assert.match(result.cache, /private.*no-store/);
        assert.equal(row.bookedCount, 2);
        assert.deepEqual(
          row.attendees.map((s) => s.email),
          [person.email],
        );
        assert.deepEqual(row.coaches, [
          { id: teacher.id, name: "Assigned instructor" },
        ]);
        const instructors = expect(
          await call(`/api/coaches?school=${a.id}`, person.cookie),
          200,
        );
        assert(instructors.some((c) => c.id === teacher.id));
        assert(
          instructors.every(
            (c) => Object.keys(c).sort().join(",") === "id,name",
          ),
        );
      }
      for (const person of [admin, coach])
        assert.equal(
          expect(
            await call(`/api/lessons?school=${a.id}`, person.cookie),
            200,
          )[0].attendees.length,
          2,
        );
    },
  );
  await check(
    "inconsistent legacy links cannot expose another school or claim another user",
    async () => {
      const foreignStudent = (
        await client.query(
          "SELECT id FROM students WHERE school_id=$1 AND user_id=$2",
          [b.id, outsider.id],
        )
      ).rows[0];
      await client.query(
        "INSERT INTO bookings(lesson_id,student_id,status) VALUES($1,$2,'booked')",
        [lesson.id, foreignStudent.id],
      );
      await client.query(
        "INSERT INTO lesson_coaches(lesson_id,coach_id) VALUES($1,$2)",
        [lesson.id, foreignTeacher.id],
      );
      try {
        const [row] = expect(
          await call(`/api/lessons?school=${a.id}`, admin.cookie),
          200,
        );
        assert.equal(row.attendees.length, 2);
        assert.deepEqual(
          row.coaches.map((c) => c.id),
          [teacher.id],
        );
        const [publicRow] = expect(
          await call(`/api/public/lessons?school=${a.id}`),
          200,
        );
        assert.deepEqual(
          publicRow.coaches.map((c) => c.id),
          [teacher.id],
        );
      } finally {
        await client.query(
          "DELETE FROM bookings WHERE lesson_id=$1 AND student_id=$2",
          [lesson.id, foreignStudent.id],
        );
        await client.query(
          "DELETE FROM lesson_coaches WHERE lesson_id=$1 AND coach_id=$2",
          [lesson.id, foreignTeacher.id],
        );
      }
      await client.query(
        "UPDATE students SET user_id=$1 WHERE school_id=$2 AND email=$3",
        [outsider.id, a.id, student.email],
      );
      try {
        expect(await call(`/api/lessons?school=${a.id}`, student.cookie), 403);
        assert.deepEqual(
          expect(
            await call("/api/lessons?scope=bookings", student.cookie),
            200,
          ),
          [],
        );
        expect(
          await call(lessonPath + "/book", student.cookie, "POST", {
            email: student.email,
          }),
          403,
        );
        expect(
          await call(lessonPath + "/book", student.cookie, "DELETE", {
            email: student.email,
          }),
          404,
        );
      } finally {
        await client.query(
          "UPDATE students SET user_id=$1 WHERE school_id=$2 AND email=$3",
          [student.id, a.id, student.email],
        );
      }
    },
  );
  await check(
    "public schedules retain business contact, instructor names and availability only",
    async () => {
      const school = expect(await call("/api/schools"), 200).find(
        (s) => s.id === a.id,
      );
      assert.equal(school.contact_email, "updated@example.invalid");
      assert.deepEqual(Object.keys(school).sort(), [
        "contact_email",
        "id",
        "name",
        "slug",
      ]);
      const [row] = expect(
        await call(`/api/public/lessons?school=${a.slug}&difficulty=Beginner`),
        200,
      );
      assert.equal(row.id, lesson.id);
      assert.equal(row.spotsLeft, 2);
      assert.equal(row.attendees, undefined);
      assert.equal(row.schoolId, undefined);
      assert.deepEqual(row.coaches, [
        { id: teacher.id, name: "Assigned instructor" },
      ]);
      assert.doesNotMatch(JSON.stringify(row), /example.invalid/);
      expect(
        await call(`/api/public/lessons?school=${a.id}&from=invalid`),
        400,
      );
    },
  );
  await check(
    "malformed identifiers produce safe validation responses",
    async () => {
      for (const [path, method, body] of [
        ["/api/users/invalid", "PATCH", {}],
        ["/api/lessons/invalid/book", "POST", {}],
        [lessonPath + "/coaches", "PUT", { coachIds: ["invalid"] }],
        ["/api/coaches", "DELETE", { id: "invalid" }],
      ]) {
        const result = await call(
          path,
          path.startsWith("/api/users") ? platform.cookie : admin.cookie,
          method,
          body,
        );
        expect(result, 400);
        assert.equal(result.body.detail, undefined);
      }
    },
  );
  await check(
    "lesson edit, cancellation and rebooking still work",
    async () => {
      expect(
        await call(lessonPath, admin.cookie, "PUT", {
          ...lessonInput,
          capacity: 3,
        }),
        200,
      );
      expect(
        await call(lessonPath + "/book", student.cookie, "DELETE", {
          email: student.email,
        }),
        200,
      );
      assert.equal(
        expect(
          await call(`/api/lessons?school=${a.id}`, student.cookie),
          200,
        )[0].attendees.length,
        0,
      );
      expect(
        await call(lessonPath + "/book", student.cookie, "POST", {
          email: student.email,
        }),
        200,
      );
      assert.equal(
        expect(
          await call(`/api/lessons?school=${a.id}`, student.cookie),
          200,
        )[0].bookedCount,
        2,
      );
    },
  );
  await check(
    "platform creates a no-school account; login and personal views need no school",
    async () => {
      const email = `b2-${crypto.randomUUID()}@example.invalid`,
        password = crypto.randomBytes(24).toString("base64url");
      const created = expect(
        await call("/api/users", platform.cookie, "POST", {
          name: "Access check",
          familyName: "Fixture",
          email,
          password,
          role: "student",
        }),
        201,
      );
      users.push(created.id);
      await state();
      const login = await call("/api/auth/login", null, "POST", {
        email,
        password,
      });
      const session = expect(login, 200).session;
      assert.deepEqual(session.schools, []);
      assert.equal(session.role, "student");
      assert.deepEqual(
        expect(await call("/api/lessons?scope=bookings", login.cookie), 200),
        [],
      );
      assert.equal(
        expect(await call("/api/spots", login.cookie), 200).length,
        17,
      );
      expect(await call("/api/memberships?school=" + a.id, login.cookie), 403);
      expect(
        await call("/api/users/" + created.id, platform.cookie, "PATCH", {
          disabled: true,
        }),
        200,
      );
      assert.equal(
        expect(await call("/api/auth/session", login.cookie), 200),
        null,
      );
    },
  );
  await check(
    "dual roles and two-school teaching use independent server capabilities",
    async () => {
      for (const [school, roles] of [
        [a, ["school_admin", "coach"]],
        [b, ["coach"]],
      ])
        expect(
          await call("/api/memberships", platform.cookie, "PUT", {
            school: school.id,
            userId: coach.id,
            roles,
            status: "active",
          }),
          200,
        );
      const linked = (
        await client.query(
          "SELECT id FROM coaches WHERE school_id=$1 AND user_id=$2",
          [b.id, coach.id],
        )
      ).rows[0];
      expect(
        await call(
          `/api/lessons/${otherLesson.id}/coaches`,
          otherAdmin.cookie,
          "PUT",
          { coachIds: [linked.id] },
        ),
        200,
      );
      const current = expect(
        await call("/api/auth/session", coach.cookie),
        200,
      );
      assert.equal(current.role, "student");
      assert.deepEqual(current.schools.find((s) => s.id === a.id).roles, [
        "coach",
        "school_admin",
      ]);
      assert.deepEqual(
        expect(await call("/api/lessons?scope=teaching", coach.cookie), 200)
          .map((l) => l.id)
          .sort(),
        [lesson.id, otherLesson.id].sort(),
      );
      assert.equal(
        expect(await call("/api/lessons?school=" + a.id, coach.cookie), 200)[0]
          .capabilities.manageSchool,
        true,
      );
      assert.equal(
        expect(await call("/api/lessons?school=" + b.id, coach.cookie), 200)[0]
          .capabilities.manageSchool,
        false,
      );
      expect(
        await call(
          `/api/lessons/${otherLesson.id}`,
          coach.cookie,
          "PUT",
          lessonInput,
        ),
        403,
      );
      const people = expect(
        await call("/api/memberships?school=" + a.id, coach.cookie),
        200,
      );
      assert(
        people.every(
          (p) =>
            !("email" in p) && !("lastLoginAt" in p) && !("disabledAt" in p),
        ),
      );
    },
  );
  await check(
    "school admins can change existing staff access but never global accounts or arbitrary affiliations",
    async () => {
      for (const [method, body] of [
        ["PATCH", { disabled: true }],
        ["PATCH", { password: "not-a-real-new-password" }],
        ["DELETE", {}],
      ])
        expect(
          await call("/api/users/" + student.id, admin.cookie, method, body),
          403,
        );
      expect(await call("/api/users", admin.cookie, "POST", {}), 403);
      expect(
        await call("/api/memberships", admin.cookie, "PUT", {
          school: a.id,
          userId: outsider.id,
          roles: ["coach"],
          status: "active",
        }),
        403,
      );
      expect(
        await call("/api/memberships", admin.cookie, "PUT", {
          school: a.id,
          userId: coach.id,
          roles: ["coach"],
          status: "active",
          email: "forbidden@example.invalid",
        }),
        400,
      );
      expect(
        await call("/api/memberships", admin.cookie, "PUT", {
          school: a.id,
          userId: coach.id,
          roles: ["platform_admin"],
          status: "active",
        }),
        400,
      );
      expect(
        await call("/api/memberships", admin.cookie, "PUT", {
          school: a.id,
          userId: unassigned.id,
          roles: ["coach"],
          status: "suspended",
        }),
        200,
      );
      assert.equal(
        expect(await call("/api/auth/session", unassigned.cookie), 200).userId,
        unassigned.id,
      );
      expect(
        await call("/api/memberships?school=" + a.id, unassigned.cookie),
        403,
      );
    },
  );
  await check(
    "self-booking and staff booking are distinct and reuse explicit person records",
    async () => {
      expect(
        await call(lessonPath + "/book", coach.cookie, "POST", {
          onBehalf: false,
        }),
        200,
      );
      assert(
        expect(
          await call("/api/lessons?scope=bookings", coach.cookie),
          200,
        ).some((l) => l.id === lesson.id),
      );
      expect(
        await call(lessonPath + "/book", admin.cookie, "POST", {
          onBehalf: true,
          name: "Guest",
          email: "b2-guest@example.invalid",
        }),
        409,
      ); // capacity is three
      const row = (
        await client.query(
          "SELECT id,email FROM students WHERE school_id=$1 AND user_id=$2",
          [a.id, coach.id],
        )
      ).rows[0];
      expect(
        await call(lessonPath + "/book", coach.cookie, "DELETE", {
          onBehalf: false,
        }),
        200,
      );
      expect(
        await call(lessonPath + "/book", coach.cookie, "POST", {
          onBehalf: false,
        }),
        200,
      );
      assert.equal(
        (
          await client.query(
            "SELECT id FROM students WHERE school_id=$1 AND user_id=$2",
            [a.id, coach.id],
          )
        ).rows[0].id,
        row.id,
      );
    },
  );
  await check(
    "suspension immediately removes one school role and preserves login, bookings and other-school teaching",
    async () => {
      expect(
        await call("/api/memberships", platform.cookie, "PUT", {
          school: a.id,
          userId: coach.id,
          roles: ["school_admin", "coach"],
          status: "suspended",
        }),
        200,
      );
      expect(await call("/api/memberships?school=" + a.id, coach.cookie), 403);
      expect(await call(lessonPath, coach.cookie, "PUT", lessonInput), 403);
      assert.deepEqual(
        expect(
          await call("/api/lessons?scope=teaching", coach.cookie),
          200,
        ).map((l) => l.id),
        [otherLesson.id],
      );
      const [mine] = expect(
        await call("/api/lessons?scope=bookings", coach.cookie),
        200,
      );
      assert.equal(mine.id, lesson.id);
      assert.equal(mine.attendees.length, 1);
      assert.equal(
        expect(await call("/api/auth/session", coach.cookie), 200).userId,
        coach.id,
      );
      assert.equal(
        (
          await client.query("SELECT disabled_at FROM users WHERE id=$1", [
            coach.id,
          ])
        ).rows[0].disabled_at,
        null,
      );
    },
  );
  await check(
    "bookings from two schools remain personal and capacity is respected under concurrency",
    async () => {
      await client.query(
        "INSERT INTO students(school_id,user_id,name,email) SELECT $1,id,name,email FROM users WHERE id=$2",
        [b.id, student.id],
      );
      expect(
        await call(
          `/api/lessons/${otherLesson.id}/book`,
          student.cookie,
          "POST",
          { onBehalf: false },
        ),
        200,
      );
      assert.deepEqual(
        expect(await call("/api/lessons?scope=bookings", student.cookie), 200)
          .map((l) => l.id)
          .sort(),
        [lesson.id, otherLesson.id].sort(),
      );
      const race = expect(
        await call("/api/lessons", admin.cookie, "POST", {
          ...lessonInput,
          capacity: 1,
          coachIds: [],
        }),
        201,
      );
      const results = await Promise.all(
        [student, peer].map((u) =>
          call(`/api/lessons/${race.id}/book`, u.cookie, "POST", {
            onBehalf: false,
          }),
        ),
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      assert.equal(
        (
          await client.query(
            "SELECT count(*)::int AS n FROM bookings WHERE lesson_id=$1 AND status='booked'",
            [race.id],
          )
        ).rows[0].n,
        1,
      );
      expect(
        await call(`/api/lessons/${race.id}`, admin.cookie, "DELETE", {}),
        200,
      );
    },
  );
  await check(
    "shared demo student remains isolated and receives the full forecast",
    async () => {
      const demo = await call("/api/auth/login", null, "POST", {
        email: "teststudent",
        password: "teststudent",
      });
      const session = expect(demo, 200).session;
      ownDemoCookies.push(demo.cookie);
      assert.equal(session.role, "student");
      expect(await call("/api/users", demo.cookie), 403);
      expect(await call("/api/lessons?school=" + a.id, demo.cookie), 403);
      expect(await call("/api/coaches?school=" + b.id, demo.cookie), 403);
      expect(await call("/api/spots", demo.cookie, "POST", {}), 403);
      const forecast = expect(
        await call("/api/conditions?spot=" + spot.id, demo.cookie),
        200,
      );
      assert(forecast.hours.length >= 24);
      assert.equal(forecast.dates.length, 16);
      const lessonForecast = expect(
        await call(lessonPath + "/conditions", coach.cookie),
        200,
      );
      assert(lessonForecast.window);
      assert.equal(lessonForecast.hours, undefined);
      expect(await call("/api/auth/session", demo.cookie, "DELETE"), 200);
    },
  );
  await check(
    "removed test pages are 404; health and login still load",
    async () => {
      for (const path of ["/test/schools", "/test/coaches", "/test/lessons"])
        expect(await call(path), 404);
      expect(await call("/login"), 200);
      const health = await call("/api/health");
      expect(health, 200);
      assert.equal(health.body.db, true);
      assert.equal(health.body.env, undefined);
    },
  );
  if (process.env.MWP_BROWSER_CHECK === "1") {
    const { checkMembershipBrowser } = await import(
      "./check-membership-browser.mjs"
    );
    await checkMembershipBrowser({
      base,
      environment,
      student,
      admin,
      coach,
      a,
      b,
      lesson,
      otherLesson,
      spot,
    });
  }
  await check(
    "school closure keeps personal login, bookings and the other school available",
    async () => {
      expect(
        await call("/api/schools/" + a.id, platform.cookie, "DELETE", {}),
        200,
      );
      assert.equal(
        expect(await call("/api/auth/session", student.cookie), 200).userId,
        student.id,
      );
      const mine = expect(
        await call("/api/lessons?scope=bookings", student.cookie),
        200,
      );
      assert(mine.some((l) => l.id === lesson.id && l.schoolOpen === false));
      assert(mine.some((l) => l.id === otherLesson.id));
      expect(await call("/api/lessons?school=" + a.id, student.cookie), 404);
      expect(await call("/api/public/lessons?school=" + a.id), 404);
      expect(
        await call(lessonPath + "/book", student.cookie, "DELETE", {
          onBehalf: false,
        }),
        200,
      );
      assert.equal(
        (
          await client.query("SELECT id FROM users WHERE id=ANY($1::uuid[])", [
            users,
          ])
        ).rowCount,
        users.length,
      );
    },
  );
  console.log(JSON.stringify({ environment, passed, fixtureRun: runId }));
} finally {
  for (const cookie of ownDemoCookies)
    expect(await call("/api/auth/session", cookie, "DELETE"), 200);
  // Exact IDs plus the unique run name prevent cleanup from selecting customer schools.
  await client.query("BEGIN");
  try {
    for (const school of schools) {
      assert.equal(
        (
          await client.query(
            "SELECT id FROM schools WHERE id=$1 AND name=$2 FOR UPDATE",
            [school.id, school.name],
          )
        ).rowCount,
        1,
      );
      await client.query("DELETE FROM schools WHERE id=$1", [school.id]);
    }
    await client.query(
      "DELETE FROM users WHERE id=ANY($1::uuid[]) AND name='Access check' AND email LIKE 'b2-%@example.invalid'",
      [users],
    );
    assert.equal(
      (
        await client.query("SELECT id FROM users WHERE id=ANY($1::uuid[])", [
          users,
        ])
      ).rowCount,
      0,
    );
    await client.query("COMMIT");
    await fs.unlink(stateFile).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
    console.log(
      `${environment}: dedicated test schools, accounts, lessons and bookings removed`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}
