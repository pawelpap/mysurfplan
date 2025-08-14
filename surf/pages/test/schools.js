// surf/pages/test/schools.js
import React, { useEffect, useState } from 'react';

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

export default function SchoolsPlayground() {
  const [name, setName] = useState('Angels Surf School');
  const [slug, setSlug] = useState('angels-surf-school');
  const [contactEmail, setContactEmail] = useState('hello@angels.com');
  const [schools, setSchools] = useState([]);
  const [banner, setBanner] = useState(null); // { type: 'error'|'success', text: string }

  async function load() {
    setBanner(null);
    const res = await fetch('/api/schools');
    const json = await res.json().catch(() => ({}));
    if (!json.ok) {
      setBanner({ type: 'error', text: json.detail || json.error || 'Server error' });
      setSchools([]);
    } else {
      setSchools(json.data || []);
    }
  }

  async function create() {
    setBanner(null);
    const res = await fetch('/api/schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name || '',
        slug: slug || undefined,           // optional; will auto-generate if omitted
        contactEmail: contactEmail || undefined,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!json.ok) {
      setBanner({ type: 'error', text: json.detail || json.error || 'Server error' });
    } else {
      setBanner({ type: 'success', text: 'School created.' });
      setName('');
      // leave slug/email as-is for convenience
      await load();
    }
  }

  async function remove(id) {
    setBanner(null);
    const res = await fetch(`/api/schools?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.status !== 204) {
      const json = await res.json().catch(() => ({}));
      setBanner({ type: 'error', text: json.detail || json.error || 'Server error' });
    } else {
      setBanner({ type: 'success', text: 'School deleted.' });
      await load();
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ maxWidth: 800, margin: '24px auto', padding: '0 16px' }}>
      <h1>Schools API Playground</h1>

      {banner && (
        <div
          style={{
            margin: '12px 0',
            padding: '10px 12px',
            borderRadius: 8,
            color: banner.type === 'error' ? '#7f1d1d' : '#065f46',
            background: banner.type === 'error' ? '#fee2e2' : '#d1fae5',
            border: `1px solid ${banner.type === 'error' ? '#fecaca' : '#a7f3d0'}`,
          }}
        >
          {banner.text}
        </div>
      )}

      <section
        style={{
          border: '1px solid #eee',
          padding: 16,
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Create a school</h3>

        <Field label="Name (required)">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Surf School Name"
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
          />
        </Field>

        <Field label="Slug (optional; generated if empty)">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="surf-school-slug"
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
          />
        </Field>

        <Field label="Contact email (optional)">
          <input
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="hello@example.com"
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
          />
        </Field>

        <button
          onClick={create}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #16a34a',
            background: '#22c55e',
            color: '#fff',
            fontWeight: 600,
          }}
        >
          Create
        </button>

        <button
          onClick={load}
          style={{
            marginLeft: 8,
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #ddd',
            background: '#fff',
            fontWeight: 600,
          }}
        >
          Refresh list
        </button>
      </section>

      <section
        style={{
          border: '1px solid #eee',
          padding: 16,
          borderRadius: 12,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Schools ({schools.length})</h3>
        {schools.length === 0 ? (
          <div style={{ color: '#666' }}>No schools yet.</div>
        ) : (
          <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
            {schools.map((s) => (
              <li
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #f1f1f1',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    slug: <code>{s.slug}</code> • {s.contact_email || '—'}
                  </div>
                </div>
                <button
                  onClick={() => remove(s.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid #b91c1c',
                    background: '#ef4444',
                    color: '#fff',
                    fontWeight: 600,
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
