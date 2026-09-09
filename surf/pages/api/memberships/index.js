import { sql } from "../../../lib/db";
import { requireAuth, resolveSchoolScope } from "../../../lib/auth";
import { isUuid } from "../../../lib/school-access.mjs";
import { accountError } from "../../../lib/account-admin";
export default async function handler(req, res) {
  if (!(await requireAuth(req, res, { roles: ["school_admin"] }))) return;
  try {
    const value = req.method === "GET" ? req.query.school : req.body?.school;
    const school = await resolveSchoolScope(value);
    if (!school)
      return res.status(404).json({ ok: false, error: "School not found" });
    const session = await requireAuth(req, res, {
      schoolId: school.id,
      roles: ["school_admin"],
    });
    if (!session) return;
    if (req.method === "GET") {
      const rows =
        await sql`SELECT m.id,m.user_id,m.status,u.name,u.family_name,
    sc.owner_membership_id=m.id AS owner,
    COALESCE((SELECT json_agg(role ORDER BY role) FROM membership_roles r WHERE r.membership_id=m.id AND r.revoked_at IS NULL),'[]'::json) AS roles
    FROM school_memberships m JOIN users u ON u.id=m.user_id JOIN schools sc ON sc.id=m.school_id
    WHERE m.school_id=${school.id} AND u.deleted_at IS NULL ORDER BY lower(u.name),m.id`;
      return res.json({
        ok: true,
        data: rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          name: r.name,
          familyName: r.family_name,
          status: r.status,
          owner: r.owner,
          roles: r.roles,
        })),
      });
    }
    if (req.method !== "PUT") {
      res.setHeader("Allow", ["GET", "PUT"]);
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }
    const b = req.body || {};
    if (
      !isUuid(b.userId) ||
      !Array.isArray(b.roles) ||
      b.roles.length > 2 ||
      b.roles.some((r) => !["coach", "school_admin"].includes(r)) ||
      new Set(b.roles).size !== b.roles.length ||
      !["active", "suspended", "left"].includes(b.status)
    )
      return res.status(400).json({
        ok: false,
        error: "Choose a person, roles and access status.",
      });
    if (
      Object.keys(b).some(
        (k) => !["school", "userId", "roles", "status"].includes(k),
      )
    )
      return res.status(400).json({
        ok: false,
        error: "Only school roles and access status can be changed here.",
      });
    const [row] =
      await sql`SELECT set_school_access(${session.userId}::uuid,${b.userId}::uuid,${school.id}::uuid,${b.roles}::text[],${b.status}) AS id`;
    return res.json({ ok: true, data: row });
  } catch (e) {
    return accountError(res, e);
  }
}
