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
  { id: "platform_admin", label: "Platform Admin" },
  { id: "school_admin", label: "School Admin" },
  { id: "coach", label: "Coach" },
  { id: "student", label: "Student" },
];

const STAFF_SCREENS = [
  { id: "schools", label: "Schools" },
  { id: "people", label: "People" },
  { id: "lessons", label: "Lessons" },
  { id: "conditions", label: "Conditions" },
  { id: "profile", label: "Profile" },
];
const STUDENT_SCREENS = [
  { id: "profile", label: "Profile" },
  { id: "coaches", label: "Coaches" },
  { id: "lessons", label: "Lessons" },
  { id: "conditions", label: "Conditions" },
];

function getAvailableScreens(role) {
  if (role === "student") return STUDENT_SCREENS;
  if (role === "coach") return STAFF_SCREENS.filter((s) => ["lessons", "conditions", "profile"].includes(s.id));
  if (role === "school_admin") {
    return STAFF_SCREENS.filter((s) => ["people", "lessons", "conditions", "profile"].includes(s.id));
  }
  if (role === "platform_admin" || role === "admin") return STAFF_SCREENS;
  return STAFF_SCREENS;
}

function getRoleLabel(role) {
  return ROLES.find((r) => r.id === role)?.label || "Workspace";
}

function isPlatformAdmin(role) {
  return role === "platform_admin" || role === "admin";
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

/* -------------------- Primitives -------------------- */
const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>
);
const Label = ({ children }) => (
  <label className="mb-1.5 block text-xs font-semibold text-slate-600">{children}</label>
);
const Input = (props) => (
  <input
    {...props}
    className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 disabled:bg-slate-50 disabled:text-slate-400 ${props.className || ""}`}
  />
);
const Select = (props) => (
  <select
    {...props}
    className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 disabled:bg-slate-50 disabled:text-slate-400 ${props.className || ""}`}
  />
);
const Textarea = (props) => (
  <textarea
    {...props}
    className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 ${props.className || ""}`}
  />
);

function getFullName(person) {
  return [person?.name, person?.familyName].filter(Boolean).join(" ").trim() || person?.email || "Untitled";
}

function getInitials(person) {
  const parts = [person?.name, person?.familyName].filter(Boolean);
  if (!parts.length && person?.email) parts.push(person.email);
  return parts
    .slice(0, 2)
    .map((part) => String(part).trim().charAt(0).toUpperCase())
    .join("") || "?";
}

/** Robust button */
function Btn({ children, variant = "neutral", className = "", style, ...rest }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60";
  const styles =
    variant === "neutral"
      ? "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-800"
      : variant === "primary"
      ? "border-teal-700 bg-teal-700 hover:bg-teal-800"
      : variant === "destructive"
      ? "border-rose-700 bg-rose-600 hover:bg-rose-700"
      : variant === "outlineDanger"
      ? "border-rose-200 text-rose-700 bg-white hover:bg-rose-50"
      : "border-slate-200 bg-white text-slate-800";
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

function LogoMark({ className = "h-10 w-10" }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <rect x="6" y="6" width="84" height="84" rx="24" fill="#0D6E7A" />
      <path d="M18 58C30 39 48 40 58 50C65 57 74 57 82 48" stroke="#DFF5EA" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M19 66C37 54 50 55 62 64C70 70 77 70 84 63" stroke="#F4C96B" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M38 38C46 29 58 30 66 38" stroke="white" strokeWidth="6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function EmptyState({ title, children, action }) {
  return (
    <Card className="py-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
        <LogoMark className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{children}</p>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

function ScoreBadge({ value = "TBC", tone = "neutral" }) {
  const classes =
    tone === "good"
      ? "bg-teal-600 text-white"
      : tone === "ok"
      ? "bg-amber-300 text-slate-950"
      : tone === "poor"
      ? "bg-rose-50 text-rose-700"
      : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex h-8 min-w-12 items-center justify-center rounded-full px-3 text-xs font-bold ${classes}`}>
      {value}
    </span>
  );
}

function LessonConditionPreview() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <span className="rounded-full bg-slate-100 px-2.5 py-1">Wave TBC</span>
      <span className="rounded-full bg-slate-100 px-2.5 py-1">Energy TBC</span>
      <span className="rounded-full bg-slate-100 px-2.5 py-1">Period TBC</span>
      <ScoreBadge />
    </div>
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
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-950">Add lesson</h3>
        <p className="mt-1 text-sm text-slate-500">Create one lesson, then manage coaches, bookings and attendance from its detail panel.</p>
      </div>
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
          <p className="text-xs text-slate-500 mt-1">Duration is fixed to 1h30m.</p>
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
          <div className="max-h-40 space-y-2 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
            {!coaches?.length && (
              <div className="text-sm text-slate-500">Add a coach to assign them.</div>
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

function StudentIdentity({ student, setStudent }) {
  return (
    <Card>
      <h3 className="text-lg font-semibold mb-3">Your details</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <Label>Name</Label>
          <Input
            value={student.name}
            onChange={(e) => setStudent((s) => ({ ...s, name: e.target.value }))}
            placeholder="Your name"
          />
        </div>
        <div>
          <Label>Family name</Label>
          <Input
            value={student.familyName || ""}
            onChange={(e) => setStudent((s) => ({ ...s, familyName: e.target.value }))}
            placeholder="Your family name"
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
        <div>
          <Label>Phone</Label>
          <Input
            value={student.phone || ""}
            onChange={(e) => setStudent((s) => ({ ...s, phone: e.target.value }))}
            placeholder="Optional"
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2">Used to reserve your spot.</p>
    </Card>
  );
}

function SelfProfileScreen({ session, student, setStudent }) {
  const profile = {
    name: session?.name || student?.name || "",
    familyName: session?.familyName || student?.familyName || "",
    email: session?.email || student?.email || "",
    phone: session?.phone || student?.phone || "",
    description: session?.description || "",
    photoUrl: session?.photoUrl || "",
    role: session?.role || "",
  };
  const canEditLocalStudent = profile.role === "student";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
      <Card className="h-fit">
        <div className="flex items-center gap-4">
          {profile.photoUrl ? (
            <img src={profile.photoUrl} alt="" className="h-20 w-20 rounded-2xl border border-slate-200 object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-teal-700 text-xl font-bold text-white">
              {getInitials(profile)}
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold text-slate-950">{getFullName(profile)}</h3>
            <div className="mt-1 text-sm text-slate-500">{getRoleLabel(profile.role)}</div>
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-950">Photo upload</div>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            The interface is ready for upload. Storage and upload validation still need to be implemented.
          </p>
          <Btn className="mt-3" variant="neutral" disabled>Upload photo</Btn>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-950">Profile details</h3>
          <p className="mt-1 text-sm text-slate-500">
            Students can keep booking details locally in this prototype. Full self-service profile saving is planned.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input
              value={canEditLocalStudent ? student.name : profile.name}
              onChange={(e) => setStudent((s) => ({ ...s, name: e.target.value }))}
              disabled={!canEditLocalStudent}
            />
          </div>
          <div>
            <Label>Family name</Label>
            <Input
              value={canEditLocalStudent ? student.familyName || "" : profile.familyName}
              onChange={(e) => setStudent((s) => ({ ...s, familyName: e.target.value }))}
              disabled={!canEditLocalStudent}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={canEditLocalStudent ? student.email : profile.email}
              onChange={(e) => setStudent((s) => ({ ...s, email: e.target.value }))}
              disabled={!canEditLocalStudent}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={canEditLocalStudent ? student.phone || "" : profile.phone || ""}
              onChange={(e) => setStudent((s) => ({ ...s, phone: e.target.value }))}
              disabled={!canEditLocalStudent}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Textarea rows={4} value={profile.description} disabled placeholder="Profile bio will be editable after self-service save is implemented." />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Btn variant="primary" disabled>Save profile</Btn>
          <span className="text-sm text-slate-500">Self-service save endpoint is planned.</span>
        </div>
      </Card>
    </div>
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

function UsersManager({ school, schools, users, onReload, ensureAuth, role }) {
  const [form, setForm] = useState({
    name: "",
    familyName: "",
    photoUrl: "",
    description: "",
    email: "",
    phone: "",
    role: "student",
    school: school || "",
    password: "",
  });
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const canChooseSchool = isPlatformAdmin(role);
  const canCreatePlatformAdmin = isPlatformAdmin(role);
  const availableRoles = ROLES.filter((r) => canCreatePlatformAdmin || r.id !== "platform_admin");
  const sortedUsers = useMemo(
    () =>
      users
        .slice()
        .sort((a, b) =>
          `${a.familyName || ""} ${a.name || ""} ${a.email || ""}`.localeCompare(
            `${b.familyName || ""} ${b.name || ""} ${b.email || ""}`,
            undefined,
            { sensitivity: "base" }
          )
        ),
    [users]
  );

  useEffect(() => {
    setForm((prev) => ({ ...prev, school: prev.school || school || "" }));
  }, [school]);

  useEffect(() => {
    if (!sortedUsers.length) {
      setSelectedId("");
      setEditing(null);
      return;
    }
    const next = sortedUsers.find((u) => u.id === selectedId) || sortedUsers[0];
    setSelectedId(next.id);
    setEditing({
      id: next.id,
      name: next.name || "",
      familyName: next.familyName || "",
      photoUrl: next.photoUrl || "",
      description: next.description || "",
      email: next.email || "",
      phone: next.phone || "",
      role: next.role || "student",
      school: next.schoolSlug || next.schoolId || school || "",
      password: "",
    });
  }, [sortedUsers, selectedId, school]);

  async function createUser(e) {
    e.preventDefault();
    setErr("");
    if (!form.name.trim()) return setErr("Please enter a name.");
    if (!form.familyName.trim()) return setErr("Please enter a family name.");
    if (!form.email.trim()) return setErr("Please enter an email.");
    if (!form.password) return setErr("Please enter a password.");
    setBusy(true);
    try {
      await ensureAuth();
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          familyName: form.familyName.trim(),
          photoUrl: form.photoUrl.trim() || null,
          description: form.description.trim() || null,
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          role: form.role,
          school: form.role === "platform_admin" ? null : form.school || school,
          password: form.password,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || "Failed");
      setForm((prev) => ({
        ...prev,
        name: "",
        familyName: "",
        photoUrl: "",
        description: "",
        email: "",
        phone: "",
        password: "",
      }));
      await onReload();
      if (json.data?.id) setSelectedId(json.data.id);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (!editing?.id) return;
    setProfileBusy(true);
    setProfileMsg("");
    try {
      await ensureAuth();
      const res = await fetch(`/api/users/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing.name.trim(),
          familyName: editing.familyName.trim(),
          photoUrl: editing.photoUrl.trim() || null,
          description: editing.description.trim() || null,
          email: editing.email.trim(),
          phone: editing.phone.trim() || null,
          role: editing.role,
          school: editing.role === "platform_admin" ? null : editing.school || school,
          password: editing.password || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || "Failed");
      setProfileMsg("Profile saved.");
      setEditing((prev) => ({ ...prev, password: "" }));
      await onReload();
    } catch (e) {
      setProfileMsg(e.message);
    } finally {
      setProfileBusy(false);
    }
  }

  async function removeUser(id) {
    if (!window.confirm("Deactivate this user?")) return;
    setErr("");
    try {
      await ensureAuth();
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || "Failed");
      if (selectedId === id) setSelectedId("");
      await onReload();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
      <h3 className="text-lg font-semibold mb-3">Add person</h3>
      <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
        </div>
        <div>
          <Label>Family name</Label>
          <Input value={form.familyName} onChange={(e) => setForm((s) => ({ ...s, familyName: e.target.value }))} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} placeholder="Optional" />
        </div>
        <div className="md:col-span-2">
          <Label>Photo URL</Label>
          <Input value={form.photoUrl} onChange={(e) => setForm((s) => ({ ...s, photoUrl: e.target.value }))} placeholder="Optional" />
        </div>
        <div className="md:col-span-2">
          <Label>Description</Label>
          <Textarea rows={2} value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} placeholder="Optional" />
        </div>
        <div>
          <Label>Role</Label>
          <Select value={form.role} onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}>
            {availableRoles.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>School</Label>
          <Select
            value={form.school}
            onChange={(e) => setForm((s) => ({ ...s, school: e.target.value }))}
            disabled={!canChooseSchool || form.role === "platform_admin"}
          >
            {!form.school && <option value="">Select a school</option>}
            {schools.map((s) => (
              <option key={s.id} value={s.slug}>{s.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Password</Label>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
            placeholder="At least 8 characters"
          />
        </div>
        <div className="md:col-span-4 flex items-center gap-3">
          <Btn type="submit" variant="primary" disabled={busy}>
            {busy ? "Creating..." : "Add user"}
          </Btn>
          {err && <span className="text-sm text-rose-600">{err}</span>}
        </div>
      </form>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)] gap-6">
        <Card>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-lg font-semibold">People</h3>
            <div className="text-sm text-slate-500">{sortedUsers.length} total</div>
          </div>
          <div className="space-y-2">
            {sortedUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedId(u.id)}
                className={`w-full text-left rounded-xl border px-3 py-3 transition ${
                  selectedId === u.id ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  {u.photoUrl ? (
                    <img src={u.photoUrl} alt="" className="h-11 w-11 rounded-full object-cover border" />
                  ) : (
                    <div className="h-11 w-11 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">
                      {getInitials(u)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{getFullName(u)}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {getRoleLabel(u.role)} • {u.email}
                      {u.schoolName ? ` • ${u.schoolName}` : ""}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-slate-600">Edit</span>
                </div>
              </button>
            ))}
            {!sortedUsers.length && <div className="text-sm text-gray-500">No people yet.</div>}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-3">Profile</h3>
          {!editing ? (
            <div className="text-sm text-gray-500">Select a person to edit their profile.</div>
          ) : (
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="flex items-center gap-3">
                {editing.photoUrl ? (
                  <img src={editing.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover border" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-semibold">
                    {getInitials(editing)}
                  </div>
                )}
                <div>
                  <div className="font-semibold">{getFullName(editing)}</div>
                  <div className="text-sm text-slate-500">{getRoleLabel(editing.role)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input value={editing.name} onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))} />
                </div>
                <div>
                  <Label>Family name</Label>
                  <Input value={editing.familyName} onChange={(e) => setEditing((s) => ({ ...s, familyName: e.target.value }))} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={editing.email} onChange={(e) => setEditing((s) => ({ ...s, email: e.target.value }))} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={editing.phone} onChange={(e) => setEditing((s) => ({ ...s, phone: e.target.value }))} placeholder="Optional" />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={editing.role} onChange={(e) => setEditing((s) => ({ ...s, role: e.target.value }))}>
                    {availableRoles.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>School</Label>
                  <Select
                    value={editing.school}
                    onChange={(e) => setEditing((s) => ({ ...s, school: e.target.value }))}
                    disabled={!canChooseSchool || editing.role === "platform_admin"}
                  >
                    {!editing.school && <option value="">Select a school</option>}
                    {schools.map((s) => (
                      <option key={s.id} value={s.slug}>{s.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Photo URL</Label>
                  <Input value={editing.photoUrl} onChange={(e) => setEditing((s) => ({ ...s, photoUrl: e.target.value }))} placeholder="Optional" />
                </div>
                <div className="md:col-span-2">
                  <Label>Description</Label>
                  <Textarea rows={4} value={editing.description} onChange={(e) => setEditing((s) => ({ ...s, description: e.target.value }))} placeholder="Optional" />
                </div>
                <div className="md:col-span-2">
                  <Label>New password</Label>
                  <Input
                    type="password"
                    value={editing.password}
                    onChange={(e) => setEditing((s) => ({ ...s, password: e.target.value }))}
                    placeholder="Leave blank to keep current password"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Btn type="submit" variant="primary" disabled={profileBusy}>
                  {profileBusy ? "Saving..." : "Save profile"}
                </Btn>
                <Btn type="button" variant="outlineDanger" onClick={() => removeUser(editing.id)}>
                  Deactivate
                </Btn>
                {profileMsg && <span className="text-sm text-slate-500">{profileMsg}</span>}
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
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

function PeopleManager({
  school,
  schools,
  users,
  reloadUsers,
  ensureAuth,
  role,
}) {
  return (
    <div className="space-y-6">
      <UsersManager
        school={school}
        schools={schools}
        users={users}
        onReload={reloadUsers}
        ensureAuth={ensureAuth}
        role={role}
      />
    </div>
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
  const canManageLesson = isPlatformAdmin(role) || role === "school_admin";
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
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-semibold text-teal-700">{fmtDate(start)}</div>
            <h3 className="mt-1 text-2xl font-bold text-slate-950">
              {fmtTime(start)} · {Math.round(((durationMin ?? DURATION_MIN) / 60) * 10) / 10}h
            </h3>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1">{difficulty}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{place || "Spot TBC"}</span>
              {coachNames && <span className="rounded-full bg-slate-100 px-3 py-1">{coachNames}</span>}
            </div>
            <LessonConditionPreview />
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <div className="font-semibold text-slate-950">{attendees?.length || 0} booked</div>
            <div className="text-slate-500">students</div>
          </div>
        </div>

        {isStaff ? (
          <div className="grid gap-4">
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="font-semibold text-slate-950">Bookings</h4>
                <span className="text-xs font-semibold text-slate-500">{attendees?.length || 0} total</span>
              </div>
              <div className="space-y-2 text-sm">
                {(attendees?.length || 0) === 0 && <div className="text-slate-500">No bookings yet.</div>}
                {attendees?.map((a, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                    <span className="font-medium text-slate-800">{a.name || "(No name)"}</span>
                    <span className="text-slate-500">{a.email || "(No email)"}</span>
                  </div>
                ))}
              </div>
            </section>

            {canManageLesson && (
              <section className="rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold text-slate-950">Assigned coaches</h4>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {!allCoaches?.length && <div className="text-sm text-slate-500">No coaches available.</div>}
                  {allCoaches?.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
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
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Btn onClick={saveCoaches} disabled={coachBusy} variant="neutral">
                    {coachBusy ? "Saving..." : "Save coaches"}
                  </Btn>
                  {coachMsg && <span className="text-xs text-slate-500">{coachMsg}</span>}
                </div>
              </section>
            )}

            <section className="rounded-xl border border-slate-200 p-4">
              <h4 className="font-semibold text-slate-950">Add or remove booking</h4>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
                <Input placeholder="Student name" value={staffName} onChange={(e) => setStaffName(e.target.value)} />
                <Input type="email" placeholder="Student email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} />
                <div className="flex items-center gap-2">
                  <Btn onClick={staffAddStudent} disabled={staffBusy} variant="primary">Add</Btn>
                  <Btn onClick={staffRemoveStudent} disabled={staffBusy} variant="outlineDanger">Remove</Btn>
                </div>
              </div>
              {staffMsg && <div className="mt-2 text-xs text-slate-500">{staffMsg}</div>}
            </section>

            {canManageLesson && (
              <div className="flex justify-end">
                <Btn onClick={deleteLesson} variant="outlineDanger" title="Delete this lesson">
                  Delete lesson
                </Btn>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Btn onClick={book} disabled={!student?.email || booked || busy} variant="primary">
              {booked ? "Booked" : busy ? "Booking..." : "Book lesson"}
            </Btn>
            <Btn onClick={unbook} disabled={!student?.email || busy} variant="outlineDanger">
              Cancel booking
            </Btn>
            {err && <div className="w-full text-xs text-rose-600">{err}</div>}
          </div>
        )}
      </div>
    </Card>
  );
}

function LessonsList({ lessons, role, student, reload, filters, setFilters, coaches, ensureAuth }) {
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const filteredLessons = useMemo(
    () =>
      lessons.filter((l) => {
        const start = l.startAt || l.startISO;
        if (filters.difficulty && l.difficulty !== filters.difficulty) return false;
        if (filters.from && new Date(start) < new Date(filters.from)) return false;
        if (filters.to && new Date(start) > new Date(filters.to + "T23:59:59")) return false;
        return true;
      }),
    [lessons, filters]
  );
  const selectedLesson = filteredLessons.find((l) => l.id === selectedLessonId) || filteredLessons[0] || null;

  useEffect(() => {
    if (!selectedLesson) {
      setSelectedLessonId("");
      return;
    }
    if (selectedLesson.id !== selectedLessonId) {
      setSelectedLessonId(selectedLesson.id);
    }
  }, [selectedLesson, selectedLessonId]);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Lessons</h3>
            <p className="text-sm text-gray-500">Select a lesson to manage coaches, bookings, and attendance.</p>
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

      {filteredLessons.length === 0 && (
        <EmptyState title="No lessons for this filter">
          Create a lesson or adjust the filters to find a scheduled session.
        </EmptyState>
      )}

      {!!filteredLessons.length && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] gap-6">
          <Card className="h-fit">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-lg font-semibold text-slate-950">Lesson list</h3>
              <div className="text-sm text-slate-500">{filteredLessons.length} total</div>
            </div>
            <div className="space-y-2">
              {filteredLessons.map((lesson) => {
                const start = lesson.startAt || lesson.startISO;
                const coachNames = Array.isArray(lesson.coaches)
                  ? lesson.coaches.map((c) => c?.name).filter(Boolean).join(", ")
                  : "";
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => setSelectedLessonId(lesson.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      selectedLesson?.id === lesson.id
                        ? "border-teal-700 bg-teal-50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-semibold text-slate-950">{fmtDate(start)} · {fmtTime(start)}</div>
                    <div className="text-xs text-slate-500">
                      {lesson.difficulty} · {lesson.place || "No place"} · {lesson.attendees?.length || 0} booked
                    </div>
                    {coachNames && <div className="text-xs text-slate-500 truncate">{coachNames}</div>}
                    <LessonConditionPreview />
                  </button>
                );
              })}
            </div>
          </Card>

          {selectedLesson && (
            <LessonItem
              lesson={selectedLesson}
              role={role}
              student={student}
              reload={reload}
              allCoaches={coaches}
              ensureAuth={ensureAuth}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ConditionsScreen({ school }) {
  const rows = [
    ["Mon 8", "NW", "1.2m", "10s", "640 kJ", "N", "12 km/h", "82", "good"],
    ["Tue 9", "NW", "1.4m", "11s", "720 kJ", "NE", "10 km/h", "86", "good"],
    ["Wed 10", "W", "0.9m", "8s", "390 kJ", "SE", "18 km/h", "58", "poor"],
    ["Thu 11", "W", "1.7m", "12s", "910 kJ", "N", "14 km/h", "79", "ok"],
    ["Fri 12", "NW", "1.2m", "10s", "640 kJ", "N", "12 km/h", "82", "good"],
    ["Sat 13", "NW", "1.4m", "11s", "720 kJ", "NE", "10 km/h", "86", "good"],
    ["Sun 14", "W", "0.9m", "8s", "390 kJ", "SE", "18 km/h", "58", "poor"],
    ["Mon 15", "W", "1.7m", "12s", "910 kJ", "N", "14 km/h", "79", "ok"],
    ["Tue 16", "NW", "1.1m", "9s", "560 kJ", "N", "9 km/h", "76", "ok"],
    ["Wed 17", "SW", "0.8m", "7s", "330 kJ", "W", "22 km/h", "44", "poor"],
    ["Thu 18", "NW", "1.6m", "13s", "940 kJ", "NE", "11 km/h", "88", "good"],
    ["Fri 19", "N", "1.0m", "8s", "420 kJ", "S", "17 km/h", "52", "poor"],
    ["Sat 20", "NW", "1.3m", "10s", "690 kJ", "N", "13 km/h", "81", "good"],
    ["Sun 21", "W", "2.0m", "14s", "1100 kJ", "NE", "16 km/h", "84", "good"],
    ["Mon 22", "NW", "1.1m", "9s", "540 kJ", "E", "9 km/h", "73", "ok"],
    ["Tue 23", "W", "0.7m", "7s", "300 kJ", "S", "20 km/h", "39", "poor"],
  ];

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-teal-700">Forecasting module</div>
            <h3 className="mt-1 text-2xl font-bold text-slate-950">16-day conditions</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Design preview for the standalone conditions page. API provider selection, spot models, storage, and score calculation are planned but not connected yet.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
            <div>
              <Label>Spot</Label>
              <Select value={school || "carcavelos"} disabled>
                <option value={school || "carcavelos"}>{school || "Carcavelos"}</option>
              </Select>
            </div>
            <div>
              <Label>Window</Label>
              <Select value="16" disabled>
                <option value="16">16 days</option>
              </Select>
            </div>
            <div>
              <Label>Provider</Label>
              <Select value="planned" disabled>
                <option value="planned">To be selected</option>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                {["Day", "Swell dir", "Size", "Period", "Energy", "Wind dir", "Wind", "Score"].map((h) => (
                  <th key={h} className="px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row[0]} className="hover:bg-slate-50/70">
                  {row.slice(0, 7).map((cell, index) => (
                    <td key={`${row[0]}-${index}`} className={`px-4 py-3 ${index === 0 ? "font-semibold text-slate-950" : "text-slate-600"}`}>
                      {cell}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <ScoreBadge value={row[7]} tone={row[8]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          ["Forecast data", "Sea, swell, wind, tide and weather providers need an adapter layer and cache strategy."],
          ["Spot score", "Scores should be calculated from normalized inputs and stored for reuse in lessons."],
          ["Lesson reuse", "Lessons should show only wave size, energy, period and score once lesson spots are connected."],
        ].map(([title, body]) => (
          <Card key={title}>
            <h4 className="font-semibold text-slate-950">{title}</h4>
            <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* -------------------- Page -------------------- */
export default function App({ settings }) {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState("lessons");
  const [schools, setSchools] = useState([]);
  const [school, setSchool] = useState("");
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsError, setSchoolsError] = useState("");
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [coaches, setCoaches] = useState([]);
  const [coachesLoading, setCoachesLoading] = useState(true);
  const [coachesError, setCoachesError] = useState("");
  const [lessons, setLessons] = useState([]);
  const [student, setStudent] = useState({ name: "", familyName: "", email: "", phone: "" });
  const [filters, setFilters] = useState({ difficulty: "", from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const role = session?.role || "";

  async function ensureAuth() {
    if (!session) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      throw new Error("Authentication required");
    }
    return session;
  }

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    window.location.href = `/login?next=${encodeURIComponent("/")}`;
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
      if (session && !isPlatformAdmin(session.role)) {
        const scopedSchool = session.schoolSlug || session.schoolId || "";
        setSchool(scopedSchool);
      } else if (!school && list.length) {
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

  async function loadUsers() {
    setUsersLoading(true);
    setUsersError("");
    try {
      if (!session || !["platform_admin", "admin", "school_admin"].includes(role)) {
        setUsers([]);
        return;
      }
      const params = new URLSearchParams();
      if (school && !isPlatformAdmin(role)) params.set("school", school);
      if (school && isPlatformAdmin(role)) params.set("school", school);
      const res = await fetch(`/api/users${params.toString() ? `?${params.toString()}` : ""}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setUsers(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setUsersError(e.message);
    } finally {
      setUsersLoading(false);
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
    (async () => {
      try {
        const res = await fetch("/api/auth/session");
        const json = await res.json().catch(() => ({}));
        const nextSession = json.ok ? json.data : null;
        if (!nextSession) {
          window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        setSession(nextSession);
        if (nextSession.role === "student") {
          setStudent({
            name: nextSession.name || nextSession.studentName || "",
            familyName: nextSession.familyName || "",
            email: nextSession.email || nextSession.studentEmail || "",
            phone: nextSession.phone || "",
          });
        }
        if (nextSession.schoolSlug || nextSession.schoolId) {
          setSchool(nextSession.schoolSlug || nextSession.schoolId);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (session) loadSchools();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    if (school) load();
    loadCoaches();
    loadUsers();
  }, [session, school]);

  useEffect(() => {
    if (!role) return;
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

  if (!authChecked || !session) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <div className="text-sm text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6faf7] text-slate-950">
      <style jsx global>{`
        :root {
          --brand-ink: #11191f;
          --brand-sea: #0d6e7a;
          --brand-teal: #11a096;
          --brand-mint: #dff5ea;
          --brand-sand: #fbf3d7;
        }
        body {
          background: #f6faf7;
        }
      `}</style>

      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-3 flex-1">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm"
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
                <LogoMark />
              )}
              <div>
                <div className="text-lg font-bold text-slate-950">{settings?.siteName || "MyWavePlan"}</div>
                <div className="text-xs font-medium text-slate-500">{getRoleLabel(role)}</div>
              </div>
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

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 md:px-6">
        <aside
          className={`fixed md:sticky md:top-6 inset-y-0 left-0 z-40 h-screen md:h-[calc(100vh-48px)] w-72 shrink-0 bg-white p-4 transform border-r border-slate-200 transition md:translate-x-0 md:rounded-2xl md:border md:shadow-sm ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="mb-8 flex items-center gap-3">
              {settings?.logo?.url ? (
                <img src={settings.logo.url} alt="Surf School" className="h-10 w-auto max-w-[140px] object-contain" />
              ) : (
                <LogoMark />
              )}
              <div>
                <div className="text-lg font-bold text-slate-950">{settings?.siteName || "MyWavePlan"}</div>
                <div className="text-xs font-medium text-slate-500">{getRoleLabel(role)}</div>
              </div>
            </div>

            <nav className="space-y-1">
              {getAvailableScreens(role).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveScreen(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                    activeScreen === item.id
                      ? "bg-teal-700 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="mt-auto space-y-4 border-t border-slate-200 pt-4">
              <div>
                <Label>School</Label>
                <Select
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  disabled={schoolsLoading || !isPlatformAdmin(role)}
                >
                  {!school && <option value="">Select a school</option>}
                  {schools.map((s) => (
                    <option key={s.id} value={s.slug}>{s.name}</option>
                  ))}
                </Select>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="font-semibold text-slate-950">{session.name || session.email}</div>
                <div className="mt-1 text-slate-500">{session.email}</div>
              </div>
              <Btn variant="neutral" onClick={logout} className="w-full">Log out</Btn>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6 md:pl-0">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-semibold text-teal-700">
                {getRoleLabel(role)}
              </div>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
                {getAvailableScreens(role).find((s) => s.id === activeScreen)?.label || "Overview"}
              </h1>
            </div>
            <div className="rounded-full bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
              {school ? `Active school: ${school}` : "Pick a school to continue"}
            </div>
          </div>
          {error && <div className="text-sm text-rose-600 mt-2">{error}</div>}
          {schoolsError && <div className="text-sm text-rose-600 mt-2">{schoolsError}</div>}
          {usersError && <div className="text-sm text-rose-600 mt-2">{usersError}</div>}
          {coachesError && <div className="text-sm text-rose-600 mt-2">{coachesError}</div>}
          {!schoolsLoading && !school && !schoolsError && (
            <div className="text-sm text-slate-500 mt-2">Select a school to load data.</div>
          )}
        </div>

        {activeScreen === "schools" && isPlatformAdmin(role) && (
          <SchoolsManager schools={schools} onReload={loadSchools} ensureAuth={ensureAuth} />
        )}

        {activeScreen === "people" && (isPlatformAdmin(role) || role === "school_admin") && (
          usersLoading || coachesLoading ? (
            <div className="text-slate-500">Loading...</div>
          ) : (
            <PeopleManager
              school={school}
              schools={schools}
              users={users}
              reloadUsers={loadUsers}
              ensureAuth={ensureAuth}
              role={role}
            />
          )
        )}

        {activeScreen === "profile" && (
          <SelfProfileScreen session={session} student={student} setStudent={setStudent} />
        )}

        {activeScreen === "coaches" && role === "student" && <CoachesList coaches={coaches} />}

        {activeScreen === "conditions" && (
          <ConditionsScreen school={school} />
        )}

        {activeScreen === "lessons" && (
          <>
            {(isPlatformAdmin(role) || role === "school_admin") && (
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
