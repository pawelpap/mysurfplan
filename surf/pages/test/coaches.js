// surf/pages/test/coaches.js
import { useEffect, useState } from "react";

const box = {
  maxWidth: 900, margin: "32px auto", padding: 24, borderRadius: 12,
  border: "1px solid #e5e7eb", background: "#fff",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};
const h1 = { fontSize: 24, fontWeight: 700, marginBottom: 16 };
const row = { display: "grid", gap: 12, marginBottom: 16 };
const label = { fontSize: 12, color: "#374151" };
const input = { padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", outline: "none" };
const btn = (bg = "#10b981") => ({ padding: "10px 14px", borderRadius: 8, border: "1px solid transparent", background: bg, color: "#fff", cursor: "pointer" });
const errorBox = { background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 8, marginBottom: 16 };
const muted = { fontSize: 12, color: "#6b7280" };
const danger = btn("#ef4444");

export default function TestCoaches() {
  const [scope, setScope] = useState("");     // school slug or id
  const [list, setList] = useState([]);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", email: "" });
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!scope.trim()) {
      setErr("Enter a school slug or id to scope the list.");
      setList([]);
      return;
    }
    setErr("");
    try {
      const r = await fetch(`/api/coaches?school=${encodeURIComponent(scope.trim())}`);
      const j = await r.json();
      if (!j.ok) throw new Error(j.detail || j.error || "Server error");
      setList(j.data || []);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    // try to auto-fill with the most recent school if available
    (async () => {
      try {
        const r = await fetch("/api/schools");
        const j = await r.json();
        if (j.ok && j.data?.[0]) setScope(j.data[0].slug || j.data[0].id);
      } catch {}
    })();
  }, []);

  async function create() {
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/coaches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          school: scope.trim(),
          name: form.name.trim(),
          email: form.email.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.detail || j.error || "Create failed");
      setForm({ name: "", email: "" });
      await refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/coaches", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.detail || j.error || "Delete failed");
      await refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={box}>
      <h1 style={h1}>Coaches API Playground</h1>
      {err && <div style={errorBox}>{err}</div>}

      <section style={{ ...box, margin: 0, padding: 16, border: "1px dashed #e5e7eb" }}>
        <div style={row}>
          <div>
            <div style={label}>Scope (school slug or id)</div>
            <input
              style={input}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="angels-surf-school (or UUID)"
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn("#111827")} onClick={refresh}>Refresh list</button>
        </div>
      </section>

      <section style={{ ...box, marginTop: 24, padding: 16, border: "1px dashed #e5e7eb" }}>
        <div style={row}>
          <div>
            <div style={label}>Name</div>
            <input
              style={input}
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="Coach name"
            />
          </div>
          <div>
            <div style={label}>Email (optional)</div>
            <input
              style={input}
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              placeholder="coach@example.com"
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={btn()}
            disabled={busy || !scope.trim() || !form.name.trim()}
            onClick={create}
          >
            {busy ? "Working…" : "Create"}
          </button>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div style={muted}>Coaches ({list.length})</div>
        <ul style={{ marginTop: 8, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
          {list.map((c) => (
            <li key={c.id} style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={muted}>{c.email || "(no email)"}</div>
              </div>
              <button style={danger} disabled={busy} onClick={() => remove(c.id)}>Delete</button>
            </li>
          ))}
          {list.length === 0 && <li style={muted}>No coaches yet.</li>}
        </ul>
      </section>
    </main>
  );
}
