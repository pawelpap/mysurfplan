// surf/pages/api/schools/index.js
import { q } from "../../../lib/db";

function slugify(input = "") {
  return input
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")          // remove quotes
    .replace(/[^a-z0-9]+/g, "-")   // non-alnum -> hyphen
    .replace(/^-+|-+$/g, "")       // trim hyphens
    .slice(0, 80);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      // Optional: ?search=foo
      const { search = "" } = req.query;
      const like = `%${search.toLowerCase()}%`;
      const { rows } = await q`
        SELECT id, name, slug, contact_email, created_at
        FROM schools
        WHERE $${0}::int IS NULL
           OR LOWER(name) LIKE ${like}
           OR LOWER(slug) LIKE ${like}
        ORDER BY created_at DESC
      `;
      return res.status(200).json({ ok: true, data: rows });
    }

    if (req.method === "POST") {
      const { name, slug: rawSlug, contactEmail } = req.body || {};

      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ ok: false, error: "Name is required." });
      }

      const slug = rawSlug && rawSlug.trim() ? slugify(rawSlug) : slugify(name);
      if (!slug) {
        return res.status(400).json({ ok: false, error: "Invalid slug." });
      }

      try {
        const { rows } = await q`
          INSERT INTO schools (name, slug, contact_email)
          VALUES (${name.trim()}, ${slug}, ${contactEmail || null})
          RETURNING id, name, slug, contact_email, created_at
        `;
        return res.status(201).json({ ok: true, data: rows[0] });
      } catch (err) {
        // unique_violation
        if (err && err.code === "23505") {
          return res.status(409).json({ ok: false, error: "Slug already exists." });
        }
        throw err;
      }
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  } catch (err) {
    console.error("schools/index error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
