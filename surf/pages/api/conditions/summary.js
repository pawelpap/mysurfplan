import { requireAuth } from "../../../lib/auth";
import { getConditions } from "../../../lib/conditions/service";

export const config = { maxDuration: 60 };
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;
  if (typeof req.query.spot !== "string" || req.query.spot.length > 180)
    return res.status(400).json({ ok: false, error: "Choose a surf spot." });
  const at = req.query.at === undefined ? Date.now() : Number(req.query.at);
  if (
    (req.query.at !== undefined && typeof req.query.at !== "string") ||
    !Number.isFinite(at) ||
    at < Date.now() - 2 * 86400000 ||
    at > Date.now() + 17 * 86400000
  )
    return res
      .status(400)
      .json({ ok: false, error: "Choose a time within the forecast." });
  try {
    const data = await getConditions(
      req.query.spot,
      req.query.refresh === "1",
      { summary: true, at },
    );
    if (!data)
      return res.status(404).json({ ok: false, error: "Spot not found." });
    return res.json({ ok: true, data });
  } catch (error) {
    console.error("conditions summary API", error.message);
    return res
      .status(503)
      .json({ ok: false, error: "Conditions are unavailable." });
  }
}
