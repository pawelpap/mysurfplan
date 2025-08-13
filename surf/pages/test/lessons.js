import React, { useEffect, useState } from "react";

export default function LessonsPlayground() {
  // --- form state ---
  const [schoolSlug, setSchoolSlug] = useState("angels-surf-school");
  const [startLocal, setStartLocal] = useState(() => {
    // default to now + 1h, formatted for <input type="datetime-local">
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  });
  const [durationMin, setDurationMin] = useState(90);
  const [difficulty, setDifficulty] = useState("Beginner");
  const [place, setPlace] = useState("Carcavelos");
  const [coachIdsText, setCoachIdsText] = useState("");

  // --- data / status ---
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const difficulties = ["Beginner", "Intermediate", "Advanced"];

  async function refresh() {
    setLoading(true);
    setMsg("");
    try {
      const url = `/api/public/lessons?school=${encodeURIComponent(schoolSlug)}`;
      const r = await fetch(url);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setList(j.data);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createLesson() {
    setMsg("");
    // Convert the local datetime to a true ISO string in UTC
    // Example: "2025-08-13T17:57" (local) -> "2025-08-13T16:57:00.000Z" (ISO)
    const startAt = new Date(startLocal).toISOString();

    // Parse coach IDs (comma separated UUIDs)
    const coachIds = coachIdsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const r = await fetch(
        `/api/public/lessons?school=${encodeURIComponent(schoolSlug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startAt, // <-- REQUIRED by the API
            durationMin: Number(durationMin) || 90,
            difficulty,
            place,
            coachIds,
          }),
        }
      );
      const j = await r.json();
      if (!j.ok) {
        throw new Error(j.error || "Create failed");
      }
      setMsg("Created!");
      await refresh();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Lessons API Playground</h1>

      {msg && (
        <div
          className={`rounded-md p-3 ${
            msg === "Created!" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg}
        </div>
      )}

      {/* Scope */}
      <section className="rounded-xl border p-4 space-y-3">
        <label className="block text-sm font-medium">Scope</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={schoolSlug}
          onChange={(e) => setSchoolSlug(e.target.value)}
          placeholder="school slug, e.g. angels-surf-school"
        />
        <button
          onClick={refresh}
          className="rounded bg-gray-800 text-white px-4 py-2"
          disabled={loading}
        >
          Refresh list
        </button>
      </section>

      {/* Create */}
      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Create a lesson</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Start (local)</label>
            <input
              type="datetime-local"
              className="w-full rounded border px-3 py-2"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Duration (min)</label>
            <input
              type="number"
              className="w-full rounded border px-3 py-2"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              min={15}
              step={15}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Difficulty</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              {difficulties.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">Place</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium">
              Coach IDs (optional, comma separated UUIDs)
            </label>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="uuid1, uuid2"
              value={coachIdsText}
              onChange={(e) => setCoachIdsText(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={createLesson}
          className="rounded bg-green-600 text-white px-4 py-2"
        >
          Create
        </button>
      </section>

      {/* List */}
      <section className="rounded-xl border p-4 space-y-2">
        <h2 className="text-lg font-semibold">Lessons ({list.length})</h2>
        {list.length === 0 && <div className="text-gray-500">No lessons yet.</div>}
        <ul className="space-y-2">
          {list.map((l) => (
            <li key={l.id} className="rounded border p-3">
              <div className="font-medium">
                {new Date(l.startAt).toLocaleString()} • {l.difficulty} • {l.place}
              </div>
              <div className="text-sm text-gray-600">
                Duration: {l.durationMin}m
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border p-4 text-sm text-gray-600">
        <div className="font-medium mb-1">Public feed (read only)</div>
        <div>
          GET <code>/api/public/lessons?school=&lt;slug&gt;</code> → subset for
          students, no auth.
        </div>
      </section>
    </div>
  );
}
