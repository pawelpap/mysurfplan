import { requireAuth } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { isLocale } from "../../../lib/locale/preferences.mjs";

export const config = { api: { bodyParser: { sizeLimit: "1kb" } } };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const session = await requireAuth(req, res);
  if (!session) return;

  const { locale } = req.body || {};
  if (locale !== null && !isLocale(locale))
    return res.status(400).json({ ok: false, error: "Unsupported language" });

  try {
    const [user] = await sql`
      UPDATE users SET preferred_locale = ${locale}
      WHERE id = ${session.userId} AND NOT is_demo
        AND deleted_at IS NULL AND disabled_at IS NULL
      RETURNING preferred_locale
    `;
    if (!user) return res.status(401).json({ ok: false, error: "Authentication required" });
    return res.status(200).json({ ok: true, data: { locale: user.preferred_locale } });
  } catch {
    return res.status(503).json({ ok: false, error: "Could not save your language" });
  }
}
