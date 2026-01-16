// surf/pages/test/schools.js
import { useEffect, useState } from "react";

const box = {
  maxWidth: 900,
  margin: "32px auto",
  padding: 24,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};
const h1 = { fontSize: 24, fontWeight: 700, marginBottom: 16 };
const row = { display: "grid", gap: 12, marginBottom: 16 };
const label = { fontSize: 12, color: "#374151" };
const input = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  outline: "none",
};
const btn = (bg = "#10b981") => ({
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid transparent",
  background: bg,
  color: "#fff",
  cursor: "pointer",
});
const danger = btn("#ef4444");
const muted = { fontSize: 12, color: "#6b7280" };
const errorBox = { background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 8, marginBottom: 16 };

export default function TestSchools() {
  const [list, setList] = useState([]);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", slug: "", email: "" });
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setErr("");
    try {
      const r = await fetch("/api/schools");
      const j = await r.json();
      if (!j.ok) throw new Error(j.detail || j.error || "Server error");
      setList(j.data || []);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function create() {
    setErr(""); setBusy(true);
    try {
      const body = { name: form.name.trim() };
      if (form.slug.trim()) body.slug = form.slug.trim();
      if (form.email.trim()) body.contactEmail = form.email.trim();

      const r = await fetch("/api/schools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.detail || j.error || "Create failed");
      setForm({ name: "", slug: "", email: "" });
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
      const r = await fetch("/api/schools", {
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
      <h1 style={h1}>Schools API Playground</h1>
      {err && <div style={errorBox}>{err}</div>}

      <section style={{ ...box, margin: 0, padding: 16, border: "1px dashed #e5e7eb" }}>
        <div style={row}>
          <div>
            <div style={label}>Name (required)</div>
            <input
              style={input}
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="Surf School Name"
            />
          </div>
          <div>
            <div style={label}>Slug (optional; generated if empty)</div>
            <input
              style={input}
              value={form.slug}
              onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
              placeholder="surf-school-slug"
            />
          </div>
          <div>
            <div style={label}>Contact email (optional)</div>
            <input
              style={input}
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              placeholder="hello@school.com"
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn()} disabled={busy || !form.name.trim()} onClick={create}>
            {busy ? "Working…" : "Create"}
          </button>
          <button style={btn("#111827")} onClick={refresh}>Refresh list</button>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div style={muted}>Schools ({list.length})</div>
        <ul style={{ marginTop: 8, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
          {list.map((s) => (
            <li key={s.id} style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div style={muted}>slug: {s.slug} {s.contact_email ? `• ${s.contact_email}` : ""}</div>
              </div>
              <button style={danger} disabled={busy} onClick={() => remove(s.id)}>Delete</button>
            </li>
          ))}
          {list.length === 0 && <li style={muted}>No schools yet.</li>}
        </ul>
      </section>
    </main>
  );
}
