import { listLessons, createLesson } from "../../../lib/db";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const data = await listLessons();
      return res.status(200).json({ ok: true, data });
    }
    if (req.method === "POST") {
      const { startISO, difficulty, place } = req.body || {};
      if (!startISO || !difficulty || !place) return res.status(400).json({ ok:false, error:"Missing fields" });
      const lesson = await createLesson({ startISO, difficulty, place });
      return res.status(201).json({ ok: true, data: lesson });
    }
    res.setHeader('Allow', ['GET','POST']);
    return res.status(405).end('Method Not Allowed');
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error: e.message });
  }
}
