import test from "node:test";
import assert from "node:assert/strict";
import {
  schoolAccess,
  withSchool,
  permitsSchoolFilter,
} from "../lib/school-access.mjs";
const session = {
  role: "student",
  schools: [
    {
      id: "a",
      slug: "school-a",
      open: true,
      status: "active",
      roles: ["coach", "school_admin"],
    },
    {
      id: "b",
      slug: "school-b",
      open: true,
      status: "active",
      roles: ["coach"],
    },
  ],
};
test("combined roles remain independent and never spill into a different school", () => {
  assert.deepEqual(schoolAccess(session, "a"), {
    viewSchool: true,
    manageSchool: true,
    teach: true,
    owner: false,
  });
  assert.deepEqual(schoolAccess(session, "b"), {
    viewSchool: true,
    manageSchool: false,
    teach: true,
    owner: false,
  });
  assert.deepEqual(schoolAccess(session, "c"), {
    viewSchool: false,
    manageSchool: false,
    teach: false,
    owner: false,
  });
  assert.equal(withSchool(session, "a").role, "school_admin");
  assert.equal(withSchool(session, "b").role, "coach");
});
test("a suspended membership loses staff rights but keeps personal context", () => {
  const changed = {
    ...session,
    schools: session.schools.map((s) => ({ ...s, status: "suspended" })),
  };
  assert.deepEqual(schoolAccess(changed, "a"), {
    viewSchool: true,
    manageSchool: false,
    teach: false,
    owner: false,
  });
  assert.equal(withSchool(changed, "a").role, "student");
});
test("closed schools have no staff authority and are excluded from context filters", () => {
  const changed = {
    ...session,
    schools: session.schools.map((s) => ({ ...s, open: false })),
  };
  assert.deepEqual(schoolAccess(changed, "a"), {
    viewSchool: false,
    manageSchool: false,
    teach: false,
    owner: false,
  });
  assert.equal(permitsSchoolFilter(changed, "school-a"), false);
});
test("global personal accounts work without a school and legacy staff fields cannot grant authority", () => {
  assert.equal(
    schoolAccess({ role: "student", schools: [] }, "a").manageSchool,
    false,
  );
  assert.equal(
    schoolAccess({ role: "school_admin", schoolId: "a", schools: [] }, "a")
      .manageSchool,
    false,
  );
  assert.equal(permitsSchoolFilter(session, ["school-a"]), false);
});
test("ownership allows management but teaching remains an explicit role", () => {
  const owner = {
    role: "student",
    schools: [
      { id: "a", open: true, status: "active", roles: [], owner: true },
    ],
  };
  assert.deepEqual(schoolAccess(owner, "a"), {
    viewSchool: true,
    manageSchool: true,
    teach: false,
    owner: true,
  });
});
