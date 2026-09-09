import { sql } from "../../../lib/db";
import {
  hashPassword,
  normalizeEmail,
  normalizePhone,
  requireAuth,
  validatePassword,
} from "../../../lib/auth";
import { isUuid } from "../../../lib/school-access.mjs";
import { listAccounts, accountError } from "../../../lib/account-admin";
export default async function handler(req, res) {
  const session = await requireAuth(req, res, { roles: ["platform_admin"] });
  if (!session) return;
  const { id } = req.query;
  if (!isUuid(id))
    return res.status(400).json({ ok: false, error: "Invalid user id" });
  try {
    const [person] = await listAccounts(id);
    if (!person)
      return res.status(404).json({ ok: false, error: "Person not found" });
    if (req.method === "GET") return res.json({ ok: true, data: person });
    if (!["PUT", "PATCH", "DELETE"].includes(req.method)) {
      res.setHeader("Allow", ["GET", "PUT", "PATCH", "DELETE"]);
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }
    const b = req.body || {},
      details = {};
    if (req.method === "DELETE") details.deleted = true;
    else {
      if (b.school !== undefined || b.roles !== undefined)
        return res
          .status(400)
          .json({
            ok: false,
            error: "Manage school roles from school access.",
          });
      for (const key of ["name", "familyName", "description"])
        if (b[key] !== undefined) {
          if (typeof b[key] !== "string" || b[key].length > 5000)
            return res
              .status(400)
              .json({ ok: false, error: "Invalid profile value" });
          details[key] = b[key].trim();
        }
      if (b.email !== undefined) details.email = normalizeEmail(b.email);
      if (b.phone !== undefined) details.phone = normalizePhone(b.phone);
      if (
        ["name", "familyName", "email"].some(
          (k) => details[k] !== undefined && !details[k],
        )
      )
        return res
          .status(400)
          .json({ ok: false, error: "Name and email cannot be empty." });
      if (b.disabled !== undefined) {
        if (typeof b.disabled !== "boolean")
          return res
            .status(400)
            .json({ ok: false, error: "Invalid account status" });
        details.disabled = b.disabled;
      }
      if (b.role !== undefined) {
        if (!["platform_admin", "student"].includes(b.role))
          return res
            .status(400)
            .json({
              ok: false,
              error: "Set instructor and administrator roles in school access.",
            });
        details.platform = b.role === "platform_admin";
      }
      if (b.password) {
        const error = validatePassword(b.password);
        if (error) return res.status(400).json({ ok: false, error });
        details.passwordHash = await hashPassword(b.password);
      }
    }
    await sql`SELECT update_global_account(${session.userId}::uuid,${id}::uuid,${JSON.stringify(details)}::jsonb)`;
    return res.json({
      ok: true,
      data:
        req.method === "DELETE"
          ? { id, deleted: true }
          : (await listAccounts(id))[0],
    });
  } catch (e) {
    return accountError(res, e);
  }
}
