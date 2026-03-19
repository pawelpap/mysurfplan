// surf/pages/api/lessons/[id]/book.js
import { sql } from 'lib/db';
import { normalizeEmail, requireAuth } from '../../../../lib/auth';

async function getLesson(id) {
  const rows = await sql`
    SELECT id, school_id
    FROM lessons
    WHERE id = ${id} AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0] || null;
}

function normalizeName(name) {
  return typeof name === 'string' ? name.trim() : '';
}

async function bookLesson(lessonId, schoolId, name, email) {
  const rows = await sql`
    WITH lesson AS (
      SELECT id, school_id, capacity
      FROM lessons
      WHERE id = ${lessonId}
        AND school_id = ${schoolId}
        AND deleted_at IS NULL
      FOR UPDATE
    ),
    student AS (
      INSERT INTO students (school_id, name, email)
      SELECT school_id, ${name || null}, ${email}
      FROM lesson
      ON CONFLICT (school_id, email)
      DO UPDATE
      SET name = COALESCE(EXCLUDED.name, students.name), updated_at = now()
      RETURNING id, name, email
    ),
    current_booking AS (
      SELECT b.id, b.status
      FROM bookings b
      JOIN student s ON s.id = b.student_id
      WHERE b.lesson_id = ${lessonId}
      ORDER BY CASE WHEN b.status = 'booked' THEN 0 ELSE 1 END, b.created_at DESC
      LIMIT 1
    ),
    booking_count AS (
      SELECT COUNT(*)::int AS booked_count
      FROM bookings
      WHERE lesson_id = ${lessonId} AND status = 'booked'
    ),
    reactivated AS (
      UPDATE bookings b
      SET status = 'booked', cancelled_at = NULL, updated_at = now()
      FROM student s, lesson l, booking_count bc
      WHERE b.id = (
          SELECT cb.id
          FROM current_booking cb
          WHERE cb.status = 'cancelled'
        )
        AND b.lesson_id = l.id
        AND b.student_id = s.id
        AND NOT EXISTS (
          SELECT 1 FROM current_booking cb WHERE cb.status = 'booked'
        )
        AND (l.capacity IS NULL OR bc.booked_count < l.capacity)
      RETURNING b.id
    ),
    inserted AS (
      INSERT INTO bookings (lesson_id, student_id, status)
      SELECT l.id, s.id, 'booked'
      FROM lesson l
      CROSS JOIN student s
      CROSS JOIN booking_count bc
      WHERE NOT EXISTS (SELECT 1 FROM current_booking)
        AND NOT EXISTS (SELECT 1 FROM reactivated)
        AND (l.capacity IS NULL OR bc.booked_count < l.capacity)
      RETURNING id
    )
    SELECT
      s.id AS student_id,
      s.name,
      s.email,
      l.capacity,
      bc.booked_count,
      CASE
        WHEN EXISTS (SELECT 1 FROM current_booking cb WHERE cb.status = 'booked') THEN 'already_booked'
        WHEN EXISTS (SELECT 1 FROM reactivated) THEN 'booked'
        WHEN EXISTS (SELECT 1 FROM inserted) THEN 'booked'
        ELSE 'full'
      END AS outcome
    FROM lesson l
    CROSS JOIN student s
    CROSS JOIN booking_count bc
  `;

  return rows[0] || null;
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
      const normalizedEmail = normalizeEmail(email);
      const normalizedName = normalizeName(name);
      if (!normalizedEmail) return res.status(400).json({ ok: false, error: 'Missing email' });
      const session = requireAuth(req, res, {
        roles: ['admin', 'school_admin', 'coach', 'student'],
        schoolId: lesson.school_id,
        studentEmail: normalizedEmail,
      });
      if (!session) return;

      const result = await bookLesson(id, lesson.school_id, normalizedName, normalizedEmail);
      if (!result) {
        return res.status(500).json({ ok: false, error: 'Failed to create booking' });
      }

      if (result.outcome === 'full') {
        return res.status(409).json({ ok: false, error: 'Lesson is full' });
      }

      return res.status(200).json({
        ok: true,
        data: {
          studentId: result.student_id,
          email: result.email,
          status: result.outcome,
        },
      });
    }

    if (req.method === 'DELETE') {
      const { email } = req.body || {};
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) return res.status(400).json({ ok: false, error: 'Missing email' });
      const session = requireAuth(req, res, {
        roles: ['admin', 'school_admin', 'coach', 'student'],
        schoolId: lesson.school_id,
        studentEmail: normalizedEmail,
      });
      if (!session) return;

      const students = await sql`
        SELECT id
        FROM students
        WHERE school_id = ${lesson.school_id} AND email = ${normalizedEmail} AND deleted_at IS NULL
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
