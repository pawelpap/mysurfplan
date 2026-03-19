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
const ROLES = [
  { id: "admin", label: "Admin" },
  { id: "school_admin", label: "School Admin" },
  { id: "coach", label: "Coach" },
  { id: "student", label: "Student" },
];

const STAFF_SCREENS = [
  { id: "schools", label: "Schools" },
  { id: "coaches", label: "Coaches" },
  { id: "lessons", label: "Lessons" },
  { id: "students", label: "Students" },
];
const STUDENT_SCREENS = [
  { id: "profile", label: "Profile" },
  { id: "coaches", label: "Coaches" },
  { id: "lessons", label: "Lessons" },
];

function getAvailableScreens(role) {
  if (role === "student") return STUDENT_SCREENS;
  if (role === "coach") return STAFF_SCREENS.filter((s) => ["lessons", "students"].includes(s.id));
  if (role === "school_admin") {
    return STAFF_SCREENS.filter((s) => ["coaches", "lessons", "students"].includes(s.id));
  }
  return STAFF_SCREENS;
}

/* Half-hour helpers */
const HALF_HOUR_MS = 30 * 60 * 1000;
function roundToHalfHour(date) {
  const d = new Date(date);
  const rounded = Math.round(d.getTime() / HALF_HOUR_MS) * HALF_HOUR_MS;
  d.setTime(rounded);
  return d;
}
function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date(date);
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}
function buildISOFromLocal(dateStr, timeStr) {
  // dateStr: YYYY-MM-DD, timeStr: HH:mm (local)
  return new Date(`${dateStr}T${timeStr}`).toISOString();
}
function getInitLocalDateTime() {
  const r = roundToHalfHour(new Date(Date.now() + 60 * 60 * 1000));
  const v = toLocalInputValue(r);
  return { initDate: v.slice(0, 10), initTime: v.slice(11, 16) };
}
function generateHalfHourOptions() {
  const out = [];
  for (let h = 0; h < 24; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
}

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
    .sort((a, b) => new Date(a.startAt || a.startISO) - new Date(b.startAt || b.startISO))
    .reduce((acc, l) => {
      const key = new Date(l.startAt || l.startISO).toDateString();
      (acc[key] ||= []).push(l);
      return acc;
    }, {});
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

/* -------------------- Forms & Lists -------------------- */
function CreateLessonForm({ school, coaches, onCreate, ensureAuth /* existing kept for signature compatibility */ }) {
  // explicit date + 30-minute time select
  const { initDate, initTime } = getInitLocalDateTime();
  const [dateStr, setDateStr] = useState(initDate);  // YYYY-MM-DD
  const [timeStr, setTimeStr] = useState(initTime);  // HH:mm (00 or 30)
  const [difficulty, setDifficulty] = useState("Beginner");
  const [place, setPlace] = useState("");
  const [coachIds, setCoachIds] = useState([]);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    setErr("");
    if (!school) {
      setErr("Please select a school.");
      return;
    }
    if (!place.trim()) {
      setErr("Please enter a place.");
      return;
    }
    if (!coachIds.length) {
      setErr("Please select at least one coach.");
      return;
    }
    const startAt = buildISOFromLocal(dateStr, timeStr);
    setSubmitting(true);
    try {
      await ensureAuth();
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school, startAt, difficulty, place: place.trim(), coachIds }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      onCreate(json.data);
      setPlace("");
      setCoachIds([]);
      setErr("");
    } catch (error) {
      setErr(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  const timeOptions = useMemo(() => generateHalfHourOptions(), []);

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-3">Create a Lesson</h3>
      <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Date & time</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
            />
            <Select
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
            >
              {timeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
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
        <div>
          <Label>Coaches</Label>
          <div className="rounded-xl border p-2 max-h-40 overflow-auto space-y-2">
            {!coaches?.length && (
              <div className="text-sm text-gray-500">Add a coach to assign them.</div>
            )}
            {coaches?.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={coachIds.includes(c.id)}
                  onChange={(e) => {
                    setCoachIds((prev) =>
                      e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                    );
                  }}
                />
                <span>{c.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="md:col-span-3 flex items-center gap-3">
          <Btn type="submit" variant="primary" disabled={submitting} className="min-w-[150px]">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M9 16.2l-3.5-3.6L4 14.1l5 5 11-11-1.4-1.4z" />
            </svg>
            <span>{submitting ? "Creating…" : "Create Lesson"}</span>
          </Btn>
          {err && <span className="text-rose-600 text-sm">{err}</span>}
        </div>
      </form>
    </Card>
  );
}

async function syncAuthSession({ role, school, student }) {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, school, student }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || "Authentication failed");
  }
  return json.data;
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

function SchoolsManager({ schools, onReload, ensureAuth }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function createSchool(e) {
    e.preventDefault();
    setErr("");
    if (!name.trim()) {
      setErr("Please enter a school name.");
      return;
    }
    setBusy(true);
    try {
      await ensureAuth();
      const res = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), contactEmail: email.trim() || null }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setName("");
      setEmail("");
      await onReload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeSchool(id) {
    if (!window.confirm("Delete this school? This cannot be undone.")) return;
    setErr("");
    try {
      await ensureAuth();
      const res = await fetch("/api/schools", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || "Failed");
      await onReload();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-3">Schools</h3>
      <form onSubmit={createSchool} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="School name" />
        </div>
        <div>
          <Label>Contact email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@school.com"
          />
        </div>
        <div className="md:pt-6">
          <Btn type="submit" variant="primary" disabled={busy}>
            {busy ? "Creating…" : "Add school"}
          </Btn>
        </div>
      </form>
      {err && <div className="text-sm text-rose-600 mt-2">{err}</div>}

      <div className="mt-4 space-y-2">
        {schools.map((s) => (
          <div key={s.id} className="flex items-center justify-between border rounded-xl px-3 py-2">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-gray-500">{s.slug}</div>
            </div>
            <Btn variant="outlineDanger" onClick={() => removeSchool(s.id)}>
              Delete
            </Btn>
          </div>
        ))}
        {!schools.length && <div className="text-sm text-gray-500">No schools yet.</div>}
      </div>
    </Card>
  );
}

function CoachesManager({ school, coaches, onReload, ensureAuth }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function createCoach(e) {
    e.preventDefault();
    setErr("");
    if (!school) {
      setErr("Select a school first.");
      return;
    }
    if (!name.trim()) {
      setErr("Please enter a coach name.");
      return;
    }
    setBusy(true);
    try {
      await ensureAuth();
      const res = await fetch("/api/coaches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school, name: name.trim(), email: email.trim() || null }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setName("");
      setEmail("");
      await onReload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeCoach(id) {
    if (!window.confirm("Delete this coach?")) return;
    setErr("");
    try {
      await ensureAuth();
      const res = await fetch("/api/coaches", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || "Failed");
      await onReload();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-3">Coaches</h3>
      <form onSubmit={createCoach} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Coach name" />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="coach@school.com"
          />
        </div>
        <div className="md:pt-6">
          <Btn type="submit" variant="primary" disabled={busy}>
            {busy ? "Creating…" : "Add coach"}
          </Btn>
        </div>
      </form>
      {err && <div className="text-sm text-rose-600 mt-2">{err}</div>}

      <div className="mt-4 space-y-2">
        {coaches.map((c) => (
          <div key={c.id} className="flex items-center justify-between border rounded-xl px-3 py-2">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-gray-500">{c.email || "no email"}</div>
            </div>
            <Btn variant="outlineDanger" onClick={() => removeCoach(c.id)}>
              Delete
            </Btn>
          </div>
        ))}
        {!coaches.length && <div className="text-sm text-gray-500">No coaches yet.</div>}
      </div>
    </Card>
  );
}

function CoachesList({ coaches }) {
  return (
    <Card>
      <h3 className="text-lg font-semibold mb-3">Coaches</h3>
      <div className="space-y-2">
        {coaches.map((c) => (
          <div key={c.id} className="flex items-center justify-between border rounded-xl px-3 py-2">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-gray-500">{c.email || "no email"}</div>
            </div>
          </div>
        ))}
        {!coaches.length && <div className="text-sm text-gray-500">No coaches yet.</div>}
      </div>
    </Card>
  );
}

function StudentsManager({ lessons, reload, ensureAuth }) {
  const [lessonId, setLessonId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const selected = lessons.find((l) => String(l.id) === String(lessonId));
  const attendees = selected?.attendees || [];

  useEffect(() => {
    if (!lessonId && lessons.length) {
      setLessonId(String(lessons[0].id));
    }
  }, [lessonId, lessons]);

  async function addStudent() {
    if (!lessonId || !email) return;
    setBusy(true);
    setMsg("");
    try {
      await ensureAuth();
      const res = await fetch(`/api/lessons/${lessonId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setName("");
      setEmail("");
      setMsg("Student added.");
      await reload();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeStudent() {
    if (!lessonId || !email) return;
    setBusy(true);
    setMsg("");
    try {
      await ensureAuth();
      const res = await fetch(`/api/lessons/${lessonId}/book`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setName("");
      setEmail("");
      setMsg("Student removed.");
      await reload();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-semibold">Students</h3>
          <p className="text-sm text-slate-600">
            Add or remove bookings for a lesson using the same flow as self-booking.
          </p>
        </div>

        {!lessons.length ? (
          <div className="text-sm text-slate-500">Create a lesson first to manage students.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Lesson</Label>
                <Select value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
                  {lessons.map((l) => {
                    const start = l.startAt || l.startISO;
                    return (
                      <option key={l.id} value={l.id}>
                        {fmtDate(start)} • {fmtTime(start)} • {l.place || "Session"}
                      </option>
                    );
                  })}
                </Select>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Current bookings
                </div>
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  {!attendees.length && <div className="text-slate-500">No students yet.</div>}
                  {attendees.map((a, i) => (
                    <div key={i}>
                      {a.name || "(No name)"} — {a.email || "(No email)"}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Student name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Student email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex items-end gap-2">
                <Btn onClick={addStudent} disabled={busy} variant="primary">
                  Add
                </Btn>
                <Btn onClick={removeStudent} disabled={busy} variant="outlineDanger">
                  Remove
                </Btn>
              </div>
            </div>
            {msg && <div className="text-xs text-slate-500">{msg}</div>}
          </>
        )}
      </div>
    </Card>
  );
}

function LessonItem({ lesson, role, student, reload, allCoaches, ensureAuth }) {
  const { id, startAt, startISO, durationMin, difficulty, place, attendees, coaches } = lesson;
  const start = startAt || startISO;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [coachIds, setCoachIds] = useState([]);
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachMsg, setCoachMsg] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffMsg, setStaffMsg] = useState("");

  const booked = attendees?.some((a) => a.email && a.email === student?.email);
  const isStaff = role !== "student";
  const coachNames = Array.isArray(coaches)
    ? coaches.map((c) => c?.name).filter(Boolean).join(", ")
    : "";

  useEffect(() => {
    const next = Array.isArray(coaches) ? coaches.map((c) => c?.id).filter(Boolean) : [];
    setCoachIds(next);
  }, [id, coaches]);

  async function book() {
    if (!student?.email) return;
    setBusy(true);
    setErr("");
    try {
      await ensureAuth();
      const res = await fetch(`/api/lessons/${id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: student.name, email: student.email }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      await reload();
      setErr("");
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
      await ensureAuth();
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
        setErr("");
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
      await ensureAuth();
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

  async function saveCoaches() {
    setCoachBusy(true);
    setCoachMsg("");
    try {
      await ensureAuth();
      const res = await fetch(`/api/lessons/${id}/coaches`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coachIds }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setCoachMsg("Coaches updated.");
      await reload();
    } catch (e) {
      setCoachMsg(e.message);
    } finally {
      setCoachBusy(false);
    }
  }

  async function staffAddStudent() {
    if (!staffEmail) return;
    setStaffBusy(true);
    setStaffMsg("");
    try {
      await ensureAuth();
      const res = await fetch(`/api/lessons/${id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: staffName, email: staffEmail }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setStaffName("");
      setStaffEmail("");
      setStaffMsg("Student added.");
      await reload();
    } catch (e) {
      setStaffMsg(e.message);
    } finally {
      setStaffBusy(false);
    }
  }

  async function staffRemoveStudent() {
    if (!staffEmail) return;
    setStaffBusy(true);
    setStaffMsg("");
    try {
      await ensureAuth();
      const res = await fetch(`/api/lessons/${id}/book`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: staffEmail }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setStaffName("");
      setStaffEmail("");
      setStaffMsg("Student removed.");
      await reload();
    } catch (e) {
      setStaffMsg(e.message);
    } finally {
      setStaffBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-sm text-gray-500">{fmtDate(start)}</div>
          <div className="text-xl font-semibold">
            {fmtTime(start)} • {Math.round((durationMin ?? DURATION_MIN) / 60 * 10) / 10}h
          </div>
          <div className="text-gray-700">
            {difficulty} • {place}
            {coachNames && <span className="text-gray-500"> • {coachNames}</span>}
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex flex-col items-start md:items-end gap-2">
          <div className="text-sm">
            Booked: <span className="font-semibold">{attendees?.length || 0}</span>
          </div>

          {isStaff ? (
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

              <details className="text-sm">
                <summary className="cursor-pointer select-none">Assign coaches</summary>
                <div className="mt-2 space-y-2">
                  <div className="rounded-xl border p-2 max-h-40 overflow-auto space-y-2">
                    {!allCoaches?.length && (
                      <div className="text-xs text-gray-500">No coaches available.</div>
                    )}
                    {allCoaches?.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={coachIds.includes(c.id)}
                          onChange={(e) => {
                            setCoachIds((prev) =>
                              e.target.checked ? [...prev, c.id] : prev.filter((cid) => cid !== c.id)
                            );
                          }}
                        />
                        <span>{c.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Btn onClick={saveCoaches} disabled={coachBusy} variant="neutral">
                      {coachBusy ? "Saving…" : "Save coaches"}
                    </Btn>
                    {coachMsg && <span className="text-xs text-gray-500">{coachMsg}</span>}
                  </div>
                </div>
              </details>

              <details className="text-sm">
                <summary className="cursor-pointer select-none">Manage students</summary>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    placeholder="Student name"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                  />
                  <Input
                    type="email"
                    placeholder="Student email"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Btn onClick={staffAddStudent} disabled={staffBusy} variant="primary">
                      Add
                    </Btn>
                    <Btn onClick={staffRemoveStudent} disabled={staffBusy} variant="outlineDanger">
                      Remove
                    </Btn>
                  </div>
                </div>
                {staffMsg && <div className="text-xs text-gray-500 mt-2">{staffMsg}</div>}
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

          {role === "student" && err && (
            <div className="text-xs text-rose-600">{err}</div>
          )}
        </div>
      </div>
    </Card>
  );
}

function LessonsList({ lessons, role, student, reload, filters, setFilters, coaches, ensureAuth }) {
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
          const start = l.startAt || l.startISO;
          if (filters.difficulty && l.difficulty !== filters.difficulty) return false;
          if (filters.from && new Date(start) < new Date(filters.from)) return false;
          if (filters.to && new Date(start) > new Date(filters.to + "T23:59:59")) return false;
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
                role={role}
                student={student}
                reload={reload}
                allCoaches={coaches}
                ensureAuth={ensureAuth}
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
  const [role, setRole] = useState("coach");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState("lessons");
  const [schools, setSchools] = useState([]);
  const [school, setSchool] = useState("");
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsError, setSchoolsError] = useState("");
  const [coaches, setCoaches] = useState([]);
  const [coachesLoading, setCoachesLoading] = useState(true);
  const [coachesError, setCoachesError] = useState("");
  const [lessons, setLessons] = useState([]);
  const [student, setStudent] = useState({ name: "", email: "" });
  const [filters, setFilters] = useState({ difficulty: "", from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function ensureAuth(overrides = {}) {
    return syncAuthSession({
      role: overrides.role ?? role,
      school: overrides.school ?? school,
      student: overrides.student ?? student,
    });
  }

  async function loadSchools() {
    setSchoolsLoading(true);
    setSchoolsError("");
    try {
      const res = await fetch("/api/schools");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      const list = Array.isArray(json.data) ? json.data : [];
      setSchools(list);
      if (!school && list.length) {
        setSchool(list[0].slug);
      }
      if (!list.length) {
        setLoading(false);
      }
    } catch (e) {
      setSchoolsError(e.message);
    } finally {
      setSchoolsLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      if (!school) {
        setLessons([]);
        setLoading(false);
        return;
      }
      await ensureAuth();
      const res = await fetch(`/api/lessons?school=${encodeURIComponent(school)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setLessons(json.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCoaches() {
    setCoachesLoading(true);
    setCoachesError("");
    try {
      if (!school) {
        setCoaches([]);
        setCoachesLoading(false);
        return;
      }
      await ensureAuth();
      const res = await fetch(`/api/coaches?school=${encodeURIComponent(school)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setCoaches(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setCoachesError(e.message);
    } finally {
      setCoachesLoading(false);
    }
  }

  useEffect(() => {
    loadSchools();
  }, []);

  useEffect(() => {
    if (school) load();
    loadCoaches();
  }, [school]);

  useEffect(() => {
    const available = getAvailableScreens(role);
    if (!available.find((s) => s.id === activeScreen)) {
      setActiveScreen(available[0]?.id || "lessons");
    }
  }, [role, activeScreen]);

  function handleCreated(l) {
    setLessons((prev) =>
      [...prev, l].sort((a, b) => new Date(a.startAt || a.startISO) - new Date(b.startAt || b.startISO))
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <style jsx global>{`
        :root {
          --brand-ink: #0b1220;
          --brand-sky: #d7f5ff;
          --brand-ocean: #0ea5b7;
          --brand-sand: #f6f0e6;
        }
        body {
          background: radial-gradient(circle at 20% 0%, #e7f9ff 0%, #f6f0e6 38%, #f8fafc 100%);
        }
      `}</style>

      <div className="sticky top-0 z-30 border-b border-white/50 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-3 flex-1">
            <button
              type="button"
              className="md:hidden rounded-lg border border-slate-200 bg-white p-2 shadow-sm"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              {settings?.logo?.url ? (
                <img
                  src={settings.logo.url}
                  alt="Surf School"
                  className="h-10 w-auto max-w-[140px] object-contain"
                />
              ) : (
                <span className="text-2xl">🏄</span>
              )}
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-slate-500">
                  Workspace
                </div>
                <div className="text-lg font-semibold text-slate-900">
                  {settings?.siteName || "Surf School"}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="min-w-[180px]">
              <Label>Role</Label>
              <Select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="bg-white"
              >
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[220px]">
              <Label>School</Label>
              <Select
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="bg-white"
                disabled={schoolsLoading}
              >
                {!school && <option value="">Select a school</option>}
                {schools.map((s) => (
                  <option key={s.id} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
        <aside
          className={`fixed md:static inset-y-0 left-0 z-40 w-72 md:w-64 shrink-0 space-y-6 bg-white md:bg-transparent p-4 md:p-0 transform transition ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <div className="bg-white rounded-3xl border border-white/60 p-4 shadow-xl space-y-5">
            <div className="px-2">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400 mb-2">
                Navigation
              </div>
              <div className="text-sm font-medium text-slate-700">
                {ROLES.find((r) => r.id === role)?.label || "Workspace"}
              </div>
            </div>

            <nav className="space-y-2">
              {getAvailableScreens(role).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveScreen(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full text-left rounded-2xl px-4 py-3 text-sm font-medium border transition ${
                    activeScreen === item.id
                      ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <main className="flex-1 space-y-6">
        <Card>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {ROLES.find((r) => r.id === role)?.label || "Workspace"}
              </div>
              <h2 className="text-3xl font-semibold text-slate-900">
                {getAvailableScreens(role).find((s) => s.id === activeScreen)?.label || "Overview"}
              </h2>
            </div>
            <div className="text-sm text-slate-500">
              {school ? `Active school: ${school}` : "Pick a school to continue"}
            </div>
          </div>
          {error && <div className="text-sm text-rose-600 mt-2">{error}</div>}
          {schoolsError && <div className="text-sm text-rose-600 mt-2">{schoolsError}</div>}
          {coachesError && <div className="text-sm text-rose-600 mt-2">{coachesError}</div>}
          {!schoolsLoading && !school && !schoolsError && (
            <div className="text-sm text-slate-500 mt-2">Select a school to load data.</div>
          )}
        </Card>

        {activeScreen === "schools" && role === "admin" && (
          <SchoolsManager schools={schools} onReload={loadSchools} ensureAuth={ensureAuth} />
        )}

        {activeScreen === "coaches" && (role === "admin" || role === "school_admin") && (
          <CoachesManager school={school} coaches={coaches} onReload={loadCoaches} ensureAuth={ensureAuth} />
        )}

        {activeScreen === "students" &&
          (role === "admin" || role === "school_admin" || role === "coach") && (
            <StudentsManager lessons={lessons} reload={load} ensureAuth={ensureAuth} />
          )}

        {activeScreen === "profile" && role === "student" && (
          <StudentIdentity student={student} setStudent={setStudent} />
        )}

        {activeScreen === "coaches" && role === "student" && <CoachesList coaches={coaches} />}

        {activeScreen === "lessons" && (
          <>
            {(role === "admin" || role === "school_admin" || role === "coach") && (
              <CreateLessonForm
                school={school}
                coaches={coaches}
                onCreate={handleCreated}
                existing={lessons}
                ensureAuth={ensureAuth}
              />
            )}

            {loading ? (
              <div className="text-slate-500">Loading…</div>
            ) : (
              <LessonsList
                lessons={lessons}
                role={role}
                student={student}
                reload={load}
                filters={filters}
                setFilters={setFilters}
                coaches={coaches}
                ensureAuth={ensureAuth}
              />
            )}
          </>
        )}
        </main>
      </div>
    </div>
  );
}
