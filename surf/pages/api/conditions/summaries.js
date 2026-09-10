import { requireAuth } from "../../../lib/auth";
import { getConditions } from "../../../lib/conditions/service";
import { summaryBatchLimit } from "../../../lib/conditions/spot-summaries.mjs";

// Up to 24 spots, three calculations/refreshes at once. The longer ceiling
// accommodates provider timeouts without increasing upstream concurrency.
export const config = { maxDuration: 300 };
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!(await requireAuth(req, res))) return;
  const { spots, refresh } = req.query;
  if (typeof spots !== "string" || spots.length > summaryBatchLimit * 181)
    return res.status(400).json({ ok: false, error: "Choose surf spots." });
  const ids = [...new Set(spots.split(","))];
  if (!ids.length || ids.length > summaryBatchLimit || ids.some((id) => !/^[a-zA-Z0-9_-]{1,180}$/.test(id)))
    return res.status(400).json({ ok: false, error: "Choose up to 24 surf spots." });
  if (refresh !== undefined && (typeof refresh !== "string" || refresh.split(",").some((id) => !ids.includes(id))))
    return res.status(400).json({ ok: false, error: "Choose valid spots to refresh." });
  const forced = new Set(refresh?.split(",") || []);
  const now = Date.now();
  const data = Object.create(null);
  const queue = [...ids];
  async function worker() {
    while (queue.length) {
      const id = queue.shift();
      try {
        data[id] = await getConditions(id, forced.has(id), { summary: true, daylight: true, at: now })
          || { error: "Spot not found." };
      } catch (error) {
        console.error("conditions summaries API", error.message);
        data[id] = { error: "Conditions are unavailable." };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, ids.length) }, worker));
  return res.json({ ok: true, data });
}
