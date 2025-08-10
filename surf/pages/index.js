import React, { useMemo, useState, useEffect } from "react";

export async function getServerSideProps() {
  try {
    const { getSettings } = await import('../lib/cms');
    const settings = await getSettings();
    return { props: { settings } };
  } catch (e) {
    return { props: { settings: { siteName: 'MyWavePlan', logo: null } } };
  }
}

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
const DURATION_MIN = 90;

const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

function groupByDay(lessons) {
  return lessons
    .slice()
    .sort((a, b) => new Date(a.startISO) - new Date(b.startISO))
    .reduce((acc, l) => {
      const key = new Date(l.startISO).toDateString();
      (acc[key] ||= []).push(l);
      return acc;
    }, {});
}

function overlaps(a, b) {
  const aStart = new Date(a.startISO).getTime();
  const aEnd = aStart + a.durationMin * 60_000;
  const bStart = new Date(b.startISO).getTime();
  const bEnd = bStart + b.durationMin * 60_000;
  return aStart < bEnd && bStart < aEnd;
}

const Card = ({ children }) => (
  <div className="rounded-2xl shadow p-4 bg-white border border-gray-100">{children}</div>
);
const Label = ({ children }) => (
  <label className="text-sm font-medium text-gray-700 mb-1 block">{children}</label>
);
const Input = (props) => (
  <input {...props} className={`w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10 ${props.className||""}`} />
);
const Select = (props) => (
  <select {...props} className={`w-full rounded-xl border px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-black/10 ${props.className||""}`} />
);
const Button = ({ children, className="", ...rest }) => (
  <button {...rest} className={`rounded-xl px-4 py-2 font-medium shadow-sm border hover:shadow transition ${className}`} />
);

function CreateLessonForm({ onCreate, existing }) {
  const [startISO, setStartISO] = useState(() => new Date(Date.now() + 60*60*1000).toISOString().slice(0,16));
  const [difficulty, setDifficulty] = useState("Beginner");
  const [place, setPlace] = useState("");
  const [warn, setWarn] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setWarn("");
    const draft = { startISO: new Date(startISO).toISOString(), durationMin: DURATION_MIN };
    const conflict = existing.some(l => overlaps(l, draft));
    if (conflict) setWarn("Heads up: overlaps another lesson.");
  }, [startISO, existing]);

  async function handleCreate(e){
    e.preventDefault();
    const iso = new Date(startISO).toISOString();
    if (!place.trim()) return setWarn("Please enter a place.");
    setSubmitting(true);
    try {
      const res = await fetch('/api/lessons', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ startISO: iso, difficulty, place: place.trim() }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error||'Failed');
      onCreate(json.data);
      setPlace("");
    } catch (err) {
      setWarn(err.message);
    } finally { setSubmitting(false); }
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-3">Create a Lesson</h3>
      <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Date & time</Label>
          <Input type="datetime-local" value={startISO} onChange={(e)=>setStartISO(e.target.value)} />
          <p className="text-xs text-gray-500 mt-1">Duration is fixed to 1h30m.</p>
        </div>
        <div>
          <Label>Difficulty</Label>
          <Select value={difficulty} onChange={(e)=>setDifficulty(e.target.value)}>
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
        </div>
        <div>
          <Label>Place</Label>
          <Input placeholder="e.g. São Pedro do Estoril" value={place} onChange={(e)=>setPlace(e.target.value)} />
        </div>
        <div className="md:col-span-3 flex items-center gap-2">
          <Button type="submit" className="bg-black text-white border-black" disabled={submitting}>{submitting?"Creating...":"Create"}</Button>
          {warn && <span className="text-amber-600 text-sm">{warn}</span>}
        </div>
      </form>
    </Card>
  );
}

function StudentIdentity({ student, setStudent }){
  return (
    <Card>
      <h3 className="text-lg font-semibold mb-3">Your details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Name</Label>
          <Input value={student.name} onChange={e=>setStudent(s=>({...s, name:e.target.value}))} placeholder="Your name" />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={student.email} onChange={e=>setStudent(s=>({...s, email:e.target.value}))} placeholder="you@example.com" />
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2">Used to reserve your spot.</p>
    </Card>
  );
}

function LessonItem({ lesson, mode, onBook, onDelete, student }){
  const { id, startISO, durationMin, difficulty, place, attendees } = lesson;
  const booked = attendees?.some(a => a.email && a.email === student?.email);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function book(){
    if (!student?.email) return;
    setLoading(true); setErr("");
    try{
      const res = await fetch(`/api/lessons/${id}/book`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: student.name, email: student.email })});
      const json = await res.json();
      if (!json.ok) throw new Error(json.error||'Failed');
      onBook(json.data);
    }catch(e){ setErr(e.message); } finally { setLoading(false); }
  }

  return (
    <Card>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-sm text-gray-500">{fmtDate(startISO)}</div>
          <div className="text-xl font-semibold">{fmtTime(startISO)} • {Math.round(durationMin/60*10)/10}h</div>
          <div className="text-gray-700">{difficulty} • {place}</div>
        </div>
        <div className="flex-1" />
        <div className="flex flex-col items-start md:items-end gap-2">
          <div className="text-sm">Booked: <span className="font-semibold">{attendees?.length||0}</span></div>

          {mode === "coach" ? (
            <>
              <details className="text-sm">
                <summary className="cursor-pointer select-none">See attendees</summary>
                <ul className="mt-1 list-disc ml-5">
                  {(attendees?.length||0) === 0 && <li className="list-none ml-0 text-gray-500">No bookings yet</li>}
                  {attendees?.map((a,i)=>(<li key={i}>{a.name || "(No name)"} — {a.email || "(No email)"} </li>))}
                </ul>
              </details>

              {/* Destructive delete button with label + icon */}
              <button
                onClick={() => onDelete(id)}
                className="inline-flex items-center justify-center gap-2 min-w-[150px] rounded-xl px-4 py-2 border border-red-700 bg-red-600 text-white hover:bg-red-700 transition"
                title="Delete this lesson"
              >
                {/* inline SVG so the icon always renders */}
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M9 3h6a1 1 0 0 1 1 1v1h4v2h-1v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7H4V5h4V4a1 1 0 0 1 1-1zm2 0v1h2V3h-2zM7 7v12h10V7H7zm3 3h2v8h-2v-8zm4 0h2v8h-2v-8z" />
                </svg>
                <span>Delete Lesson</span>
              </button>
            </>
          ) : (
            <Button disabled={!student?.email || booked || loading} onClick={book} className={`border-black ${booked?"bg-gray-200 text-gray-600 cursor-not-allowed":"bg-white hover:bg-gray-50"}`}>
              {booked ? "Already booked" : (loading ? "Booking..." : (student?.email ? "Book this lesson" : "Enter your details above"))}
            </Button>
          )}

          {err && <div className="text-xs text-rose-600">{err}</div>}
        </div>
      </div>
    </Card>
  );
}

function LessonsList({ lessons, mode, onBook, onDelete, student, filters, setFilters }){
  const grouped = useMemo(()=>groupByDay(lessons), [lessons]);
  const days = Object.keys(grouped);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Calendar</h3>
            <p className="text-sm text-gray-500">Grouped by day. Use filters to narrow results.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full md:w-auto">
            <div>
              <Label>Difficulty</Label>
              <Select value={filters.difficulty} onChange={(e)=>setFilters(f=>({...f, difficulty:e.target.value}))}>
                <option value="">All</option>
                {DIFFICULTIES.map(d=> <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>
            <div>
              <Label>From</Label>
              <Input type="date" value={filters.from} onChange={(e)=>setFilters(f=>({...f, from:e.target.value}))} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={filters.to} onChange={(e)=>setFilters(f=>({...f, to:e.target.value}))} />
            </div>
          </div>
        </div>
      </Card>

      {days.length === 0 && (
        <div className="text-gray-500">No lessons yet. {mode === "coach" ? "Create one above." : "Please check back later."}</div>
      )}

      {days.map(day => {
        const dayLessons = grouped[day].filter(l => {
          if (filters.difficulty && l.difficulty !== filters.difficulty) return false;
          if (filters.from && new Date(l.startISO) < new Date(filters.from)) return false;
          if (filters.to && new Date(l.startISO) > new Date(filters.to + "T23:59:59")) return false;
          return true;
        });
        if (dayLessons.length === 0) return null;
        return (
          <section key={day} className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{day}</h4>
            {dayLessons.map(lesson => (
              <LessonItem
                key={lesson.id}
                lesson={lesson}
                mode={mode}
                onBook={onBook}
                onDelete={onDelete}
                student={student}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

export default function App({ settings }){
  const [mode, setMode] = useState("coach");
  const [lessons, setLessons] = useState([]);
  const [student, setStudent] = useState({ name: "", email: "" });
  const [filters, setFilters] = useState({ difficulty: "", from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(){
    setLoading(true); setError("");
    try{
      const res = await fetch('/api/lessons');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error||'Failed');
      setLessons(json.data);
    }catch(e){ setError(e.message);} finally { setLoading(false); }
  }

  useEffect(()=>{ load(); }, []);

  function handleCreated(l){ setLessons(prev => [...prev, l].sort((a,b)=> new Date(a.startISO)-new Date(b.startISO))); }
  function handleBooked(updated){ setLessons(prev => prev.map(l => l.id===updated.id? updated: l)); }

  // Server-first deletion with real error messages
  async function handleDelete(id){
    if (!window.confirm('Are you sure you want to delete this lesson? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/lessons/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `Failed with status ${res.status}`);
      }
      setLessons(prev => prev.filter(l => l.id !== id));
    } catch (e) {
      alert(`Error deleting lesson: ${e.message}`);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            {settings?.logo?.url ? (
              <img
                src={settings.logo.url}
                alt={settings.siteName || 'MyWavePlan'}
                className="h-7 w-auto rounded-md"
              />
            ) : (
              <span className="text-xl">🏄</span>
            )}
            <div className="text-xl font-bold">{settings?.siteName || 'MyWavePlan'}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`text-sm ${mode==="coach"?"font-semibold":""}`}>Coach</span>
            <Button onClick={()=> setMode(m => m === "coach" ? "student" : "coach")} className="bg-black text-white border-black">
              Switch to {mode === "coach" ? "Student" : "Coach"}
            </Button>
            <span className={`text-sm ${mode==="student"?"font-semibold":""}`}>Student</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold">{mode === "coach" ? "Coach" : "Student"} Workspace</h2>
              <p className="text-sm text-gray-600">Create lessons, browse the calendar, and book sessions. Data is now stored in a database via API routes.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={load} className="border-gray-300">Refresh</Button>
            </div>
          </div>
          {error && <div className="text-sm text-rose-600 mt-2">{error}</div>}
        </Card>

        {mode === "coach" && (
          <CreateLessonForm onCreate={handleCreated} existing={lessons} />
        )}

        {mode === "student" && (
          <StudentIdentity student={student} setStudent={setStudent} />
        )}

        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : (
          <LessonsList
            lessons={lessons}
            mode={mode}
            onBook={handleBooked}
            onDelete={handleDelete}
            student={student}
            filters={filters}
            setFilters={setFilters}
          />
        )}

        <footer className="pt-6 text-xs text-gray-500">
          <p>
            Roadmap: Google Maps places, capacity limits & waitlists, coach auth, iCal export. Deployed on Vercel with Vercel Postgres.
          </p>
        </footer>
      </main>
    </div>
  );
}
