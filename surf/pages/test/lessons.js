// surf/pages/test/lessons.js
import React, { useEffect, useState } from "react";

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced", "All"];

export default function LessonsPlayground() {
  const [school, setSchool] = useState("angels-surf-school");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [difficulty, setDifficulty] = useState("All");

  const [startAt, setStartAt] = useState(() =>
    new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)
  ); // local datetime-local
  const [durationMin, setDurationMin] = useState(90);
  const [lessonDifficulty, setLessonDifficulty] = useState("Beginner");
  const [place, setPlace] = useState("");
  const [coachIds, setCoachIds] = useState(""); // comma separated
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");

  const qs = () => {
    const u = new URLSearchParams();
    u.set("school", school);
    if (from) u.set("from", from);
    if (to) u.set("to", to);
    if (difficulty && difficulty !== "All") u.set("difficulty", difficulty);
    return u.toString();
  };

  async function refresh() {
    setMsg("");
    try {
      const res = await fetch(`/api/public/lessons?${qs()}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.detail || json.error || "Failed");
      setRows(json.data || []);
    } catch (e) {
      setMsg(e.message);
      setRows([]);
    }
  }

  async function create() {
    setMsg("");
    try {
      const body = {
        startAt: new Date(startAt).toISOString(), // ensure ISO
        durationMin: Number(durationMin),
        difficulty: lessonDifficulty,
        place: place.trim(),
        coachIds: coachIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const res = await fetch(`/api/public/lessons?school=${encodeURIComponent(school)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.detail || json.error || "Create failed");
      setPlace("");
      setCoachIds("");
      await refresh();
      setMsg("Created!");
    } catch (e) {
      setMsg(e.message);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Lessons API Playground</h1>

      {msg && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2">
          {msg}
        </div>
      )}

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold mb-3">Scope</h2>
        <div className="flex gap-2 flex-wrap items-end">
          <input
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            className="border rounded px-3 py-2 flex-1"
            placeholder="school slug (e.g. angels-surf-school)"
          />
          <button
            onClick={refresh}
            className="px-4 py-2 rounded bg-gray-100 border hover:bg-gray-200"
          >
            Refresh list
          </button>
        </div>
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold">Create a lesson</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            Start (local)
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="mt-1 border rounded px-3 py-2 w-full"
            />
          </label>

          <label className="text-sm">
            Duration (min)
            <input
              type="number"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              className="mt-1 border rounded px-3 py-2 w-full"
            />
          </label>

          <label className="text-sm">
            Difficulty
            <select
              value={lessonDifficulty}
              onChange={(e) => setLessonDifficulty(e.target.value)}
              className="mt-1 border rounded px-3 py-2 w-full"
            >
              {DIFFICULTIES.filter((d) => d !== "All").map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Place
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              className="mt-1 border rounded px-3 py-2 w-full"
              placeholder="e.g. Carcavelos"
            />
          </label>

          <label className="text-sm md:col-span-2">
            Coach IDs (optional, comma separated UUIDs)
            <input
              value={coachIds}
              onChange={(e) => setCoachIds(e.target.value)}
              className="mt-1 border rounded px-3 py-2 w-full"
              placeholder="uuid1, uuid2"
            />
          </label>
        </div>

        <button
          onClick={create}
          className="mt-2 px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
        >
          Create
        </button>
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold">Filter & list</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <label className="text-sm">
            Difficulty
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="mt-1 border rounded px-3 py-2 w-full"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 border rounded px-3 py-2 w-full"
            />
          </label>
          <label className="text-sm">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 border rounded px-3 py-2 w-full"
            />
          </label>
        </div>

        <button
          onClick={refresh}
          className="px-4 py-2 rounded bg-gray-100 border hover:bg-gray-200"
        >
          Apply
        </button>

        <div className="pt-3">
          {rows.length === 0 ? (
            <div className="text-gray-500">No lessons yet.</div>
          ) : (
            <ul className="space-y-2">
              {rows.map((l) => (
                <li key={l.id} className="border rounded px-3 py-2">
                  <div className="text-sm text-gray-600">
                    {new Date(l.start_at).toLocaleString()} • {l.duration_min}m
                  </div>
                  <div className="font-medium">
                    {l.difficulty} • {l.place}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-xl border p-4">
        <h3 className="font-medium mb-1">Public feed (read only)</h3>
        <code className="text-sm bg-gray-50 px-2 py-1 rounded border">
          GET /api/public/lessons?school=&lt;slug&gt;
        </code>
        <div className="text-sm text-gray-600">→ subset for students, no auth.</div>
      </section>
    </main>
  );
}
