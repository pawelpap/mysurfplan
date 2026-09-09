import { sql } from "./db";
export async function listAccounts(id = null) {
  const rows =
    await sql`SELECT u.id,u.name,u.family_name,u.email,u.phone,u.description,u.photo_url,u.created_at,u.updated_at,u.last_login_at,u.disabled_at,
 EXISTS(SELECT 1 FROM platform_role_assignments p WHERE p.user_id=u.id AND p.revoked_at IS NULL) AS platform,
 COALESCE((SELECT json_agg(json_build_object('id',a.school_id,'name',a.name,'roles',a.roles,'status',a.status,'owner',a.is_owner)) FROM account_school_access a WHERE a.user_id=u.id),'[]'::json) AS schools
 FROM users u WHERE u.deleted_at IS NULL AND (${id}::uuid IS NULL OR u.id=${id}::uuid)
 ORDER BY lower(u.name),u.id`;
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    familyName: u.family_name,
    email: u.email,
    phone: u.phone,
    description: u.description,
    photoUrl: u.photo_url,
    role: u.platform ? "platform_admin" : "student",
    schools: u.schools,
    schoolName: u.schools.map((s) => s.name).join(", "),
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    lastLoginAt: u.last_login_at,
    disabledAt: u.disabled_at,
  }));
}
export function accountError(res, e) {
  const status =
    {
      42501: 403,
      P0002: 404,
      23505: 409,
      23514: 409,
      22023: 400,
      55000: 503,
      "40P01": 409,
    }[e?.code] || 500;
  const message =
    {
      42501: "Forbidden",
      P0002: "Person not found",
      23505: "This account or school record already exists.",
      23514:
        "This change would remove your own access or leave a school without an active owner.",
      22023: "Invalid school access.",
      55000: "Account changes are temporarily unavailable. Please try again.",
      "40P01": "Access changed at the same time. Please try again.",
    }[e?.code] || "Could not update the account. Please try again.";
  return res.status(status).json({ ok: false, error: message });
}
