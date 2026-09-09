import { sql } from "../../../lib/db";
import {
  hashPassword,
  normalizeEmail,
  normalizePhone,
  requireAuth,
  resolveSchoolScope,
  validatePassword,
} from "../../../lib/auth";
import { listAccounts, accountError } from "../../../lib/account-admin";
export default async function handler(req, res) {
  const session = await requireAuth(req, res, { roles: ["platform_admin"] });
  if (!session) return;
  try {
    if (req.method === "GET")
      return res.json({ ok: true, data: await listAccounts() });
    if (req.method !== "POST") {
      res.setHeader("Allow", ["GET", "POST"]);
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }
    const b = req.body || {};
    const details = {
      name: typeof b.name === "string" ? b.name.trim() : "",
      familyName: typeof b.familyName === "string" ? b.familyName.trim() : "",
      email: normalizeEmail(b.email),
      phone: normalizePhone(b.phone),
      description:
        typeof b.description === "string" ? b.description.trim() : "",
    };
    if (
      !details.name ||
      !details.familyName ||
      !details.email ||
      details.email.length > 320
    )
      return res
        .status(400)
        .json({
          ok: false,
          error: "Name, family name and email are required.",
        });
    const error = validatePassword(b.password);
    if (error) return res.status(400).json({ ok: false, error });
    if (
      !["student", "coach", "school_admin", "platform_admin"].includes(b.role)
    )
      return res.status(400).json({ ok: false, error: "Invalid role" });
    const school = b.school ? await resolveSchoolScope(b.school) : null;
    if (b.school && !school)
      return res.status(404).json({ ok: false, error: "School not found" });
    const roles = Array.isArray(b.roles)
      ? b.roles
      : ["coach", "school_admin"].includes(b.role)
        ? [b.role]
        : [];
    if (roles.length && !school)
      return res
        .status(400)
        .json({ ok: false, error: "Choose a school for staff access." });
    const hash = await hashPassword(b.password);
    const [created] =
      await sql`SELECT create_global_account(${session.userId}::uuid,${JSON.stringify(details)}::jsonb,${hash},${school?.id || null}::uuid,${roles}::text[],${b.role === "platform_admin"}) AS id`;
    return res
      .status(201)
      .json({ ok: true, data: (await listAccounts(created.id))[0] });
  } catch (e) {
    return accountError(res, e);
  }
}
