// surf/pages/index.js
import { useEffect, useMemo, useState } from 'react';

const DUR_MIN = 90;

// helper: round a JS Date to the nearest 30 min
function roundTo30(date) {
  const d = new Date(date);
  const ms = d.getTime();
  const halfHour = 30 * 60 * 1000;
  const rounded = Math.round(ms / halfHour) * halfHour;
  d.setTime(rounded);
  return d;
}

// helper: add minutes
function addMin(d, m) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() + m);
  return x;
}

// helper: parse ISO or string to Date safely
function toDate(v) {
  if (!v) return null;
  return v instanceof Date ? v : new Date(v);
}

// overlap test: [aStart, aEnd) vs [bStart, bEnd)
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

export default function Home() {
  const [mode, setMode] = useState('coach'); // 'coach' | 'student'
  const [lessons, setLessons] = useState([]);
  const [createAt, setCreateAt] = useState(() => roundTo30(new Date()));
  const [difficulty, setDifficulty] = useState('Beginner');
  const [place, setPlace] = useState('');

  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');

  // fetch lessons
  async function refresh() {
    const r = await fetch('/api/lessons');
    const j = await r.json();
    if (j.ok) setLessons(j.data || []);
  }
  useEffect(() => { refresh(); }, []);

  // ----- FIX 1: robust overlap detection -----
  const hasOverlap = useMemo(() => {
    const start = toDate(createAt);
    if (!start || !lessons?.length) return false;

    const end = addMin(start, DUR_MIN);
    for (const L of lessons) {
      const ls = toDate(L.startISO || L.start_iso);
      if (!ls) continue;
      const le = addMin(ls, L.durationMin ?? L.duration_min ?? DUR_MIN);
      if (intervalsOverlap(start, end, ls, le)) return true;
    }
    return false;
  }, [createAt, lessons]);

  // ----- FIX 2: 30-minute snapping + input constraint -----
  function onDateInputChange(e) {
    const raw = e.target.value ? new Date(e.target.value) : null;
    if (!raw || isNaN(raw)) return;
    setCreateAt(roundTo30(raw));
  }

  async function createLesson() {
    const body = {
      startISO: toDate(createAt)?.toISOString(),
      difficulty,
      place: place?.trim()
    };
    const r = await fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    if (!j.ok) {
      alert(j.error || 'Create failed'); 
      return;
    }
    setPlace('');
    await refresh();
  }

  async function deleteLesson(id) {
    if (!confirm('Delete this lesson?')) return;
    const r = await fetch(`/api/lessons/${id}`, { method: 'DELETE' });
    const j = await r.json();
    if (!j.ok) {
      alert(j.error || 'Delete failed');
      return;
    }
    await refresh();
  }

  async function book(lessonId) {
    if (!studentEmail) { alert('Please enter your email.'); return; }
    const r = await fetch(`/api/lessons/${lessonId}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: studentName || null, email: studentEmail })
    });
    const j = await r.json();
    if (!j.ok) { alert(j.error || 'Booking failed'); return; }
    await refresh();
  }

  // UI helpers
  const lessonsByDay = useMemo(() => {
    const map = new Map();
    for (const L of lessons) {
      const d = new Date(L.startISO || L.start_iso);
      const key = d.toLocaleDateString(undefined, { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(L);
    }
    // sort each day by time
    for (const arr of map.values()) {
      arr.sort((a,b) => new Date(a.startISO||a.start_iso) - new Date(b.startISO||b.start_iso));
    }
    return Array.from(map.entries());
  }, [lessons]);

  const isCoach = mode === 'coach';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="text-xl font-bold">🏄 Surf Lesson Booking</div>
          {/* big switch */}
          <div className="ml-auto flex items-center gap-2">
            <span className={`text-sm ${isCoach ? 'font-semibold' : ''}`}>Coach</span>
            <button
              onClick={() => setMode(prev => prev === 'coach' ? 'student' : 'coach')}
              aria-label="Toggle Coach/Student"
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition 
                ${isCoach ? 'bg-black' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition
                ${isCoach ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className={`text-sm ${!isCoach ? 'font-semibold' : ''}`}>Student</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* Coach workspace */}
        {isCoach && (
          <>
            <section className="rounded-2xl border p-5 shadow-sm">
              <h2 className="text-2xl font-semibold mb-4">Create a Lesson</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Date & Time – 30-min increments */}
                <div>
                  <label className="block text-gray-600 mb-1">Date & time</label>
                  <input
                    type="datetime-local"
                    step={1800} // 30 min in seconds
                    value={new Date(createAt).toISOString().slice(0,16)}
                    onChange={onDateInputChange}
                    className="w-full rounded-xl border px-3 py-2"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Duration is fixed to 1h30m.
                  </p>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block text-gray-600 mb-1">Difficulty</label>
                  <select
                    className="w-full rounded-xl border px-3 py-2"
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value)}
                  >
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </div>

                {/* Place */}
                <div>
                  <label className="block text-gray-600 mb-1">Place</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2"
                    placeholder="e.g. São Pedro do Estoril"
                    value={place}
                    onChange={e => setPlace(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <button
                  onClick={createLesson}
                  className="inline-flex items-center gap-2 rounded-full bg-green-600 text-white px-5 py-2.5 hover:bg-green-700"
                >
                  <span>✓</span>
                  <span>Create Lesson</span>
                </button>

                {/* show the warning only when TRUE */}
                {hasOverlap && (
                  <p className="text-amber-600 font-medium">
                    Heads up: overlaps another lesson.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border p-5 shadow-sm">
              <h3 className="text-xl font-semibold mb-3">Calendar</h3>

              {lessonsByDay.length === 0 && (
                <p className="text-gray-500">No lessons yet.</p>
              )}

              <div className="space-y-6">
                {lessonsByDay.map(([day, items]) => (
                  <div key={day} className="space-y-2">
                    <div className="text-sm text-gray-500">{day}</div>
                    {items.map(L => {
                      const s = new Date(L.startISO || L.start_iso);
                      const label = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const count = L.attendees?.length || 0;
                      return (
                        <div key={L.id} className="rounded-2xl border p-4 flex items-center justify-between">
                          <div>
                            <div className="text-lg font-semibold">{label} • 1.5h</div>
                            <div className="text-sm text-gray-600">
                              {L.difficulty} • {L.place}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">Booked: {count}</span>
                            <button
                              onClick={() => deleteLesson(L.id)}
                              className="inline-flex items-center gap-2 rounded-full bg-red-600 text-white px-4 py-2 hover:bg-red-700"
                            >
                              <span>🗑️</span>
                              <span>Delete Lesson</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Student workspace */}
        {!isCoach && (
          <>
            <section className="rounded-2xl border p-5 shadow-sm">
              <h2 className="text-2xl font-semibold mb-4">Your details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-600 mb-1">Name</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2"
                    placeholder="Your name"
                    value={studentName}
                    onChange={e => setStudentName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Email</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2"
                    placeholder="you@example.com"
                    value={studentEmail}
                    onChange={e => setStudentEmail(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border p-5 shadow-sm">
              <h3 className="text-xl font-semibold mb-3">Calendar</h3>

              {lessonsByDay.length === 0 && (
                <p className="text-gray-500">No lessons yet.</p>
              )}

              <div className="space-y-6">
                {lessonsByDay.map(([day, items]) => (
                  <div key={day} className="space-y-2">
                    <div className="text-sm text-gray-500">{day}</div>
                    {items.map(L => {
                      const s = new Date(L.startISO || L.start_iso);
                      const label = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const isBooked = (L.attendees || []).some(a => a.email === studentEmail);
                      return (
                        <div key={L.id} className="rounded-2xl border p-4 flex items-center justify-between">
                          <div>
                            <div className="text-lg font-semibold">{label} • 1.5h</div>
                            <div className="text-sm text-gray-600">
                              {L.difficulty} • {L.place}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">Booked: {L.attendees?.length || 0}</span>
                            <button
                              onClick={() => book(L.id)}
                              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-white ${isBooked ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                              {isBooked ? '✓ Booked' : 'Book Lesson'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
