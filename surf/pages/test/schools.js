// surf/pages/test/schools.js
import React, { useEffect, useState } from "react";

function Field({ label, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: "#555" }}>{label}</div>
      <input
        {...props}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid #ddd",
        }}
      />
    </label>
  );
}

function Button({ children, variant = "default", ...props }) {
  const styles =
    variant === "danger"
      ? { background: "#ef4444", color: "#fff" }
      : variant === "secondary"
      ? { background: "#f3f4f6", color: "#111" }
      : { background: "#10b981", color: "#fff" };
  return (
    <button
      {...props}
      style={{
        ...styles,
        border: "1px solid transparent",
        borderRadius: 8,
        padding: "8px 12px",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default function SchoolsPlayground() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", slug: "", contactEmail: "" });

  const [edit, setEdit] = useState(null); // {id, name, slug, contact_email}

  async function fetchList() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/schools");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setList(json.data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList();
  }, []);

  async function createSchool(e) {
    e.preventDefault();
    setErr("");
    try {
      const res = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || undefined,
          contactEmail: form.contactEmail || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Create failed");
      setForm({ name: "", slug: "", contactEmail: "" });
      await fetchList();
      alert(`Created: ${json.data.name} (${json.data.slug})`);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function viewSchool(id) {
    setErr("");
    try {
      const res = await fetch(`/api/schools/${id}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Not found");
      alert(JSON.stringify(json.data, null, 2));
    } catch (e) {
      setErr(e.message);
    }
  }

  async function updateSchool() {
    if (!edit) return;
    setErr("");
    try {
      const res = await fetch(`/api/schools/${edit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: edit.name,
          slug: edit.slug,
          contactEmail: edit.contact_email || null,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Update failed");
      setEdit(null);
      await fetchList();
      alert("Updated.");
    } catch (e) {
      setErr(e.message);
    }
  }

  async function deleteSchool(id) {
    if (!confirm("Delete this school?")) return;
    setErr("");
    try {
      const res = await fetch(`/api/schools/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Delete failed");
      await fetchList();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 20 }}>
      <h1 style={{ marginBottom: 8 }}>Schools API Playground</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        No CLI needed. Create, list, update, and delete schools with buttons.
      </p>

      {err && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      )}

      <section
        style={{
          border: "1px solid #eee",
          padding: 16,
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <h3>Create a school</h3>
        <form onSubmit={createSchool} style={{ display: "grid", gap: 8 }}>
          <Field
            label="Name (required)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Atlantic Surf Academy"
            required
          />
          <Field
            label="Slug (optional; defaults from name)"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            placeholder="atlantic-surf"
          />
          <Field
            label="Contact email (optional)"
            type="email"
            value={form.contactEmail}
            onChange={(e) =>
              setForm((f) => ({ ...f, contactEmail: e.target.value }))
            }
            placeholder="hello@atlantic.example"
          />
          <div style={{ display: "flex", gap: 8 }}>
            <Button type="submit">Create</Button>
            <Button type="button" variant="secondary" onClick={fetchList}>
              Refresh list
            </Button>
          </div>
        </form>
      </section>

      <section
        style={{
          border: "1px solid #eee",
          padding: 16,
          borderRadius: 12,
        }}
      >
        <h3 style={{ marginBottom: 8 }}>
          Schools {loading ? "…" : `(${list.length})`}
        </h3>
        {list.length === 0 && <div>No schools yet.</div>}

        {list.map((s) => (
          <div
            key={s.id}
            style={{
              padding: 12,
              border: "1px solid #eee",
              borderRadius: 10,
              marginBottom: 10,
            }}
          >
            {edit?.id === s.id ? (
              <>
                <Field
                  label="Name"
                  value={edit.name || ""}
                  onChange={(e) =>
                    setEdit((v) => ({ ...v, name: e.target.value }))
                  }
                />
                <Field
                  label="Slug"
                  value={edit.slug || ""}
                  onChange={(e) =>
                    setEdit((v) => ({ ...v, slug: e.target.value }))
                  }
                />
                <Field
                  label="Contact email"
                  value={edit.contact_email || ""}
                  onChange={(e) =>
                    setEdit((v) => ({ ...v, contact_email: e.target.value }))
                  }
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <Button onClick={updateSchool}>Save</Button>
                  <Button
                    variant="secondary"
                    onClick={() => setEdit(null)}
                    type="button"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700 }}>
                  {s.name} <span style={{ color: "#6b7280" }}>({s.slug})</span>
                </div>
                <div style={{ color: "#6b7280", fontSize: 14 }}>
                  id: {s.id} • {s.contact_email || "no email"}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <Button variant="secondary" onClick={() => viewSchool(s.id)}>
                    View
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setEdit({
                        id: s.id,
                        name: s.name,
                        slug: s.slug,
                        contact_email: s.contact_email || "",
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => deleteSchool(s.id)}>
                    Delete
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
