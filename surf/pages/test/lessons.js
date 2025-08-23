// surf/pages/test/lessons.js
import { useEffect, useState } from "react";

const box = { maxWidth: 900, margin: "32px auto", padding: 24, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" };
const h1 = { fontSize: 24, fontWeight: 700, marginBottom: 16 };
const row = { display: "grid", gap: 12, marginBottom: 16, gridTemplateColumns: "1fr 1fr", alignItems: "end" };
const label = { fontSize: 12, color: "#374151" };
const input = { padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", outline: "none", width: "100%" };
const btn = (bg = "#10b981") => ({ padding: "10px 14px", borderRadius: 8, border: "1px solid transparent", background: bg, color: "#fff", cursor: "pointer" });
const muted = { fontSize: 12, color: "#6b7280" };
const errorBox = { background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 8, marginBottom: 16 };

const DIFFS = ["Beginner", "Intermediate", "Advanced"];

export default function TestLessons() {
  const [school, setSchool] = useState("");
  const [list, setList] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // create form
  const [startLocal, setStartLocal] = useState(""); // yyyy-mm-ddThh:mm
  const [duration, setDuration] = useState(90);
  const [difficulty, setDifficulty] = useState("Beginner");
  const [place, setPlace] = useState("");
  const [coachIds, setCoachIds] = useState(""); // comma separated

  async function refresh() {
    if (!school.trim()) {
      setErr("Enter a school slug or id.");
      setList([]);
      return;
    }
    setErr("");
    try {
      const r = await fetch(`/api/public/lessons?school=${encodeURIComponent(school.trim())}`);
      const j = await r.json();
      if (!j.ok) throw new Error(j.detail || j.error || "Server error");
      setList(j.data || []);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    // pick the most recent school if present
    (async () => {
      try {
        const r = await fetch("/api/schools");
        const j = await r.json();
        if (j.ok && j.data?.[0]) setSchool(j.data[0].slug || j.data[0].id);
      } catch {}
    })();
  }, []);

  async function create() {
    if (!school.trim()) { setErr("Enter a school slug or id."); return; }
    if (!startLocal) { setErr("Missing start date/time."); return; }
    setErr(""); setBusy(true);

    try {
      const startISO = new Date(startLocal).toISOString();
      const body = {
        school: school.trim(),
        startAt: startISO,
        durationMin: Number(duration) || 90,
        difficulty,
        place: place.trim() || undefined,
        coachIds: coachIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const r = await fetch("/api/lessons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.detail || j.error || "Create failed");
      setStartLocal(""); setPlace(""); setCoachIds("");
      await refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={box}>
      <h1 style={h1}>Lessons API Playground</h1>
      {err && <div style={errorBox}>{err}</div>}

      <section style={{ ...box, margin: 0, padding: 16, border: "1px dashed #e5e7eb" }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={label}>Scope (school slug or id)</div>
            <input style={input} value={school} onChange={(e) => setSchool(e.target.value)} placeholder="angels-surf-school (or UUID)" />
          </div>
          <div>
            <button style={btn("#111827")} onClick={refresh}>Refresh list</button>
          </div>
        </div>
      </section>

      <section style={{ ...box, marginTop: 24, padding: 16, border: "1px dashed #e5e7eb" }}>
        <div style={row}>
          <div>
            <div style={label}>Start (local)</div>
            <input type="datetime-local" style={input} value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
          </div>
          <div>
            <div style={label}>Duration (min)</div>
            <input type="number" min={30} step={30} style={input} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div>
            <div style={label}>Difficulty</div>
            <select style={input} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              {DIFFS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <div style={label}>Place</div>
            <input style={input} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g., Carcavelos" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={label}>Coach IDs (optional, comma separated UUIDs)</div>
            <input style={input} value={coachIds} onChange={(e) => setCoachIds(e.target.value)} placeholder="uuid1, uuid2" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn()} disabled={busy || !school.trim() || !startLocal} onClick={create}>
            {busy ? "Working…" : "Create"}
          </button>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div style={muted}>Lessons ({list.length})</div>
        <ul style={{ marginTop: 8, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
          {list.map((l) => (
            <li key={l.id} style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
              <div style={{ fontWeight: 600 }}>
                {new Date(l.start_at).toLocaleString()} • {Math.round((l.duration_min || 0) / 60 * 10) / 10}h
              </div>
              <div style={muted}>{l.difficulty} • {l.place || "(no place)"} </div>
              {Array.isArray(l.coaches) && l.coaches.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <span style={muted}>Coaches:</span>{" "}
                  {l.coaches.map((c, i) => (
                    <span key={c.id}>
                      {c.name || "(no name)"}{i < l.coaches.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
          {list.length === 0 && <li style={muted}>No lessons yet.</li>}
        </ul>
      </section>
    </main>
  );
}
