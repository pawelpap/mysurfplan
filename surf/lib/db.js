import { sql } from "@vercel/postgres";

export const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];

export async function ensureTables() {
  await sql`CREATE TABLE IF NOT EXISTS lessons (
    id SERIAL PRIMARY KEY,
    start TIMESTAMPTZ NOT NULL,
    duration_min INT NOT NULL DEFAULT 90,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('Beginner','Intermediate','Advanced')),
    place TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`;

  await sql`CREATE TABLE IF NOT EXISTS attendees (
    id SERIAL PRIMARY KEY,
    lesson_id INT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    UNIQUE(lesson_id, email)
  );`;
}

export async function listLessons() {
  await ensureTables();
  const { rows } = await sql`
    SELECT l.id,
           l.start,
           l.duration_min,
           l.difficulty,
           l.place,
           COALESCE(
             json_agg(json_build_object('name', a.name, 'email', a.email)
               ) FILTER (WHERE a.id IS NOT NULL), '[]'::json
           ) AS attendees
    FROM lessons l
    LEFT JOIN attendees a ON a.lesson_id = l.id
    GROUP BY l.id
    ORDER BY l.start ASC;`;
  return rows.map(r => ({
    id: r.id,
    startISO: new Date(r.start).toISOString(),
    durationMin: r.duration_min,
    difficulty: r.difficulty,
    place: r.place,
    attendees: r.attendees
  }));
}

export async function createLesson({ startISO, difficulty, place }) {
  await ensureTables();
  if (!DIFFICULTIES.includes(difficulty)) throw new Error("Invalid difficulty");
  const start = new Date(startISO);
  const { rows } = await sql`
    INSERT INTO lessons (start, difficulty, place)
    VALUES (${start.toISOString()}, ${difficulty}, ${place})
    RETURNING id, start, duration_min, difficulty, place;`;
  const l = rows[0];
  return { id: l.id, startISO: new Date(l.start).toISOString(), durationMin: l.duration_min, difficulty: l.difficulty, place: l.place, attendees: [] };
}

export async function bookLesson({ lessonId, name, email }) {
  await ensureTables();
  if (!email) throw new Error("Email required");
  await sql`INSERT INTO attendees (lesson_id, name, email) VALUES (${lessonId}, ${name||null}, ${email}) ON CONFLICT (lesson_id, email) DO NOTHING;`;
  const lessons = await listLessons();
  return lessons.find(l => l.id === Number(lessonId));
}
