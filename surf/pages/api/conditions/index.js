import { requireAuth } from "../../../lib/auth";
import { getConditions } from "../../../lib/conditions/service";
export const config = { maxDuration: 60 };
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!requireAuth(req, res)) return;
  if (typeof req.query.spot !== "string" || req.query.spot.length > 180)
    return res.status(400).json({ ok: false, error: "Choose a surf spot." });
  try {
    const data = await getConditions(req.query.spot, req.query.refresh === "1");
    if (!data)
      return res.status(404).json({ ok: false, error: "Spot not found." });
    return res.json({ ok: true, data });
  } catch (e) {
    console.error("conditions API", e.message);
    return res
      .status(503)
      .json({
        ok: false,
        error: "Conditions are temporarily unavailable. Please try again.",
      });
  }
}
