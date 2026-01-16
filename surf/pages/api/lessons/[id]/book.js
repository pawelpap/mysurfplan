// surf/pages/api/lessons/[id]/book.js
import { sql } from 'lib/db';

async function getLesson(id) {
  const rows = await sql`
    SELECT id, school_id
    FROM lessons
    WHERE id = ${id} AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0] || null;
}

async function upsertStudent(schoolId, name, email) {
  const rows = await sql`
    INSERT INTO students (school_id, name, email)
    VALUES (${schoolId}, ${name || null}, ${email})
    ON CONFLICT (school_id, email)
    DO UPDATE SET name = COALESCE(EXCLUDED.name, students.name), updated_at = now()
    RETURNING id, name, email;
  `;
  return rows[0];
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing lesson id' });
  }

  try {
    const lesson = await getLesson(id);
    if (!lesson) return res.status(404).json({ ok: false, error: 'Lesson not found' });

    if (req.method === 'POST') {
      const { name, email } = req.body || {};
      if (!email) return res.status(400).json({ ok: false, error: 'Missing email' });

      const student = await upsertStudent(lesson.school_id, name, email);

      const updated = await sql`
        UPDATE bookings
        SET status = 'booked', cancelled_at = NULL, updated_at = now()
        WHERE lesson_id = ${id} AND student_id = ${student.id}
        RETURNING id;
      `;

      if (!updated.length) {
        await sql`
          INSERT INTO bookings (lesson_id, student_id, status)
          VALUES (${id}, ${student.id}, 'booked');
        `;
      }

      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ ok: false, error: 'Missing email' });

      const students = await sql`
        SELECT id
        FROM students
        WHERE school_id = ${lesson.school_id} AND email = ${email} AND deleted_at IS NULL
        LIMIT 1
      `;
      const student = students[0];
      if (!student) return res.status(404).json({ ok: false, error: 'Not booked' });

      const cancelled = await sql`
        UPDATE bookings
        SET status = 'cancelled', cancelled_at = now(), updated_at = now()
        WHERE lesson_id = ${id} AND student_id = ${student.id} AND status = 'booked'
        RETURNING id;
      `;
      if (!cancelled.length) {
        return res.status(404).json({ ok: false, error: 'Not booked' });
      }

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['POST', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e) {
    console.error('bookings error:', e);
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
