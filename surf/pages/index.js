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

/* -------------------- Constants & utils -------------------- */
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
const DURATION_MIN = 90;

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

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
  const aStart = Date.parse(a.startISO);
  const aEnd = aStart + (a.durationMin ?? DURATION_MIN) * 60_000;
  const bStart = Date.parse(b.startISO);
  const bEnd = bStart + (b.durationMin ?? DURATION_MIN) * 60_000;
  return aStart < bEnd && bStart < aEnd;
}

/* -------------------- Primitives -------------------- */
const Card = ({ children }) => (
  <div className="rounded-2xl shadow p-4 bg-white border border-gray-100">{children}</div>
);
const Label = ({ children }) => (
  <label className="text-sm font-medium text-gray-700 mb-1 block">{children}</label>
);
const Input = (props) => (
  <input
    {...props}
    className={`w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10 ${props.className || ""}`}
  />
);
const Select = (props) => (
  <select
    {...props}
    className={`w-full rounded-xl border px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-black/10 ${props.className || ""}`}
  />
);

/** Robust button */
function Btn({ children, variant = "neutral", className = "", style, ...rest }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-medium shadow-sm border transition whitespace-nowrap";
  const styles =
    variant === "neutral"
      ? "border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
      : variant === "primary"
      ? "border-green-700 bg-green-600 hover:bg-green-700"
      : variant === "destructive"
      ? "border-red-700 bg-red-600 hover:bg-red-700"
      : variant === "outlineDanger"
      ? "border-red-600 text-red-600 bg-white hover:bg-red-50"
      : "border-gray-300 bg-white text-gray-800";
  const forcedStyle =
    variant === "primary" || variant === "destructive"
      ? { color: "#fff", ...style }
      : style;
  return (
    <button {...rest} className={`${base} ${styles} ${className}`} style={forcedStyle}>
      {children}
    </button>
  );
}

/* -------------------- Header segmented toggle -------------------- */
function ModeToggle({ mode, setMode }) {
  return (
    <div className="ml-auto">
      <div className="inline-flex rounded-full border border-gray-300 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setMode("coach")}
          className={`px-4 py-1.5 text-sm ${mode === "coach" ? "bg-black text-white" : "text-gray-700"}`}
          aria-pressed={mode === "coach"}
        >
          Coach
        </button>
        <button
          type="button"
          onClick={() => setMode("student")}
          className={`px-4 py-1.5 text-sm ${mode === "student" ? "bg-black text-white" : "text-gray-700"}`}
          aria-pressed={mode === "student"}
        >
          Student
        </button>
      </div>
    </div>
  );
}

/* -------------------- Forms & Lists -------------------- */
function CreateLessonForm({ onCreate, existing }) {
  const [startISOInput, setStartISOInput] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [difficulty, setDifficulty] = useState("Beginner");
  const [place, setPlace] = useState("");
  const [warn, setWarn] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const candidateISO = new Date(startISOInput).toISOString();
    const draft = { startISO: candidateISO, durationMin: DURATION_MIN };
    const hasConflict = existing.some((l) => overlaps(l, draft));
    setWarn(hasConflict ? "Heads up: overlaps another lesson." : "");
  }, [startISOInput, existing]);

  async function handleCreate(e) {
    e.preventDefault();
    const startISO = new Date(startISOInput).toISOString();
    if (!place.trim()) {
      setWarn("Please enter a place.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startISO, difficulty, place: place.trim() }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      onCreate(json.data);
      setPlace("");
    } catch (err) {
      setWarn(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-3">Create a Lesson</h3>
      <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Date & time</Label>
          <Input
            type="datetime-local"
            value={startISOInput}
            onChange={(e) => setStartISOInput(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">Duration is fixed to 1h30m.</p>
        </div>
        <div>
          <Label>Difficulty</Label>
          <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Place</Label>
          <Input
            placeholder="e.g. São Pedro do Estoril"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
        </div>

        <div className="md:col-span-3 flex items-center gap-3">
          <Btn type="submit" variant="primary" disabled={submitting} className="min-w-[150px]">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M9 16.2l-3.5-3.6L4 14.1l5 5 11-11-1.4-1.4z" />
            </svg>
            <span>{submitting ? "Creating…" : "Create Lesson"}</span>
          </Btn>
          {warn && <span className="text-amber-600 text-sm">{warn}</span>}
        </div>
      </form>
    </Card>
  );
}

function StudentIdentity({ student, setStudent }) {
  return (
    <Card>
      <h3 className="text-lg font-semibold mb-3">Your details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Name</Label>
          <Input
            value={student.name}
            onChange={(e) => setStudent((s) => ({ ...s, name: e.target.value }))}
            placeholder="Your name"
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={student.email}
            onChange={(e) => setStudent((s) => ({ ...s, email: e.target.value }))}
            placeholder="you@example.com"
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2">Used to reserve your spot.</p>
    </Card>
  );
}

function LessonItem({ lesson, mode, student, reload }) {
  const { id, startISO, durationMin, difficulty, place, attendees } = lesson;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const booked = attendees?.some((a) => a.email && a.email === student?.email);

  async function book() {
    if (!student?.email) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/lessons/${id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: student.name, email: student.email }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      await reload();
      setErr(""); // clear after success
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function unbook() {
    if (!student?.email) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/lessons/${id}/book`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: student.email }),
      });
      const json = await res.json();
      if (!json.ok) {
        if (res.status === 404 || json.error === 'Not booked') {
          setErr("No person with this email address booked for this lesson.");
        } else {
          throw new Error(json.error || "Failed");
        }
      } else {
        await reload();
        setErr(""); // clear after success
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteLesson() {
    if (!window.confirm("Are you sure you want to delete this lesson? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/lessons/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `Failed with status ${res.status}`);
      }
      await reload();
    } catch (e) {
      alert(`Error deleting lesson: ${e.message}`);
    }
  }

  return (
    <Card>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-sm text-gray-500">{fmtDate(startISO)}</div>
          <div className="text-xl font-semibold">
            {fmtTime(startISO)} • {Math.round((durationMin ?? DURATION_MIN) / 60 * 10) / 10}h
          </div>
          <div className="text-gray-700">
            {difficulty} • {place}
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex flex-col items-start md:items-end gap-2">
          <div className="text-sm">
            Booked: <span className="font-semibold">{attendees?.length || 0}</span>
          </div>

          {mode === "coach" ? (
            <>
              <details className="text-sm">
                <summary className="cursor-pointer select-none">See attendees</summary>
                <ul className="mt-1 list-disc ml-5">
                  {(attendees?.length || 0) === 0 && (
                    <li className="list-none ml-0 text-gray-500">No bookings yet</li>
                  )}
                  {attendees?.map((a, i) => (
                    <li key={i}>
                      {a.name || "(No name)"} — {a.email || "(No email)"}
                    </li>
                  ))}
                </ul>
              </details>

              <Btn
                onClick={deleteLesson}
                variant="destructive"
                className="min-w-[150px]"
                title="Delete this lesson"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M9 3h6a1 1 0 0 1 1 1v1h4v2h-1v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7H4V5h4V4a1 1 0 0 1 1-1zm2 0v1h2V3h-2zM7 7v12h10V7H7zm3 3h2v8h-2v-8zm4 0h2v8h-2v-8z" />
                </svg>
                <span>Delete Lesson</span>
              </Btn>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Btn
                onClick={book}
                disabled={!student?.email || booked || busy}
                variant="primary"
                className="min-w-[150px]"
                title={student?.email ? "Book this lesson" : "Enter your details above"}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M9 16.2l-3.5-3.6L4 14.1l5 5 11-11-1.4-1.4z" />
                </svg>
                <span>{booked ? "Booked" : busy ? "Booking…" : "Book Lesson"}</span>
              </Btn>

              <Btn
                onClick={unbook}
                disabled={!student?.email || busy}
                variant="outlineDanger"
                className="min-w-[120px]"
                title="Cancel booking for this email"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M18.3 5.71L12 12.01l-6.29-6.3-1.42 1.42L10.59 13.4l-6.3 6.3 1.42 1.41 6.3-6.29 6.29 6.29 1.41-1.41-6.29-6.3 6.29-6.29z"/>
                </svg>
                <span>Unbook</span>
              </Btn>
            </div>
          )}

          {/* Only show booking/unbooking errors to students */}
          {mode === "student" && err && (
            <div className="text-xs text-rose-600">{err}</div>
          )}
        </div>
      </div>
    </Card>
  );
}

function LessonsList({ lessons, mode, student, reload, filters, setFilters }) {
  const grouped = useMemo(() => groupByDay(lessons), [lessons]);
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
              <Select
                value={filters.difficulty}
                onChange={(e) => setFilters((f) => ({ ...f, difficulty: e.target.value }))}
              >
                <option value="">All</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>From</Label>
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              />
            </div>
            <div>
              <Label>To</Label>
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </Card>

      {days.length === 0 && (
        <div className="text-gray-500">No lessons yet.</div>
      )}

      {days.map((day) => {
        const dayLessons = grouped[day].filter((l) => {
          if (filters.difficulty && l.difficulty !== filters.difficulty) return false;
          if (filters.from && new Date(l.startISO) < new Date(filters.from)) return false;
          if (filters.to && new Date(l.startISO) > new Date(filters.to + "T23:59:59")) return false;
          return true;
        });
        if (dayLessons.length === 0) return null;
        return (
          <section key={day} className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{day}</h4>
            {dayLessons.map((lesson) => (
              <LessonItem
                key={lesson.id}
                lesson={lesson}
                mode={mode}
                student={student}
                reload={reload}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

/* -------------------- Page -------------------- */
export default function App({ settings }) {
  const [mode, setMode] = useState("coach");
  const [lessons, setLessons] = useState([]);
  const [student, setStudent] = useState({ name: "", email: "" });
  const [filters, setFilters] = useState({ difficulty: "", from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/lessons");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setLessons(json.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function handleCreated(l) {
    setLessons((prev) => [...prev, l].sort((a, b) => new Date(a.startISO) - new Date(b.startISO)));
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            {settings?.logo?.url ? (
              <img
                src={settings.logo.url}
                alt={settings.siteName || "MyWavePlan"}
                className="h-7 w-auto rounded-md"
              />
            ) : (
              <span className="text-xl">🏄</span>
            )}
            <div className="text-xl font-bold">{settings?.siteName || "MyWavePlan"}</div>
          </div>

          <ModeToggle mode={mode} setMode={setMode} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold">
                {mode === "coach" ? "Coach" : "Student"} Workspace
              </h2>
            </div>
          </div>
          {error && <div className="text-sm text-rose-600 mt-2">{error}</div>}
        </Card>

        {mode === "coach" && <CreateLessonForm onCreate={handleCreated} existing={lessons} />}

        {mode === "student" && <StudentIdentity student={student} setStudent={setStudent} />}

        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : (
          <LessonsList
            lessons={lessons}
            mode={mode}
            student={student}
            reload={load}
            filters={filters}
            setFilters={setFilters}
          />
        )}
      </main>
    </div>
  );
}
