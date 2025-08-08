import { sql } from "@vercel/postgres";
export default async function handler(req, res) {
  try {
    const { rows } = await sql`select now() as now`;
    res.status(200).json({ ok: true, now: rows[0].now });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
