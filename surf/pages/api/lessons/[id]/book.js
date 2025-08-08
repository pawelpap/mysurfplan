import { bookLesson } from "../../../../lib/db";

export default async function handler(req, res) {
  try {
    const { id } = req.query;
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end('Method Not Allowed');
    }
    const { name, email } = req.body || {};
    if (!email) return res.status(400).json({ ok:false, error: 'Email required' });
    const updated = await bookLesson({ lessonId: id, name, email });
    return res.status(200).json({ ok:true, data: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error: e.message });
  }
}
