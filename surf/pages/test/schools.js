// surf/pages/test/schools.js
import React, { useEffect, useState } from 'react';

export default function TestSchools() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState(''); // optional (ignored by API – DB generates its own)
  const [email, setEmail] = useState('');
  const [schools, setSchools] = useState([]);
  const [msg, setMsg] = useState('');

  async function load() {
    setMsg('');
    const r = await fetch('/api/schools');
    const j = await r.json();
    if (j.ok) setSchools(j.data);
    else setMsg(j.error || 'Server error');
  }

  useEffect(() => { load(); }, []);

  async function createSchool() {
    setMsg('');
    const r = await fetch('/api/schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, contactEmail: email, slug: slug || undefined }),
    });
    const j = await r.json();
    if (!j.ok) setMsg(j.error || 'Server error');
    await load();
    setName(''); setSlug(''); setEmail('');
  }

  async function del(id) {
    setMsg('');
    const r = await fetch('/api/schools', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const j = await r.json();
    if (!j.ok) setMsg(j.error || 'Server error');
    await load();
  }

  return (
    <div style={{ maxWidth: 760, margin: '40px auto', padding: 16 }}>
      <h1>Schools API Playground</h1>
      {msg && <p style={{ color: '#c00' }}>{msg}</p>}

      <section style={{ border: '1px solid #eee', padding: 16, borderRadius: 12 }}>
        <h3>Create a school</h3>

        <label>Name (required)</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Surf School Name" />

        <label style={{ marginTop: 8 }}>Slug (optional; generated if empty)</label>
        <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="surf-school-slug" />

        <label style={{ marginTop: 8 }}>Contact email (optional)</label>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="hello@school.com" />

        <div style={{ marginTop: 12 }}>
          <button onClick={createSchool}>Create</button>
          <button onClick={load} style={{ marginLeft: 8 }}>Refresh list</button>
        </div>
      </section>

      <section style={{ marginTop: 24, border: '1px solid #eee', padding: 16, borderRadius: 12 }}>
        <h3>Schools ({schools.length})</h3>
        {!schools.length && <div>No schools yet.</div>}
        {schools.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: '#555' }}>slug: {s.slug}</div>
            </div>
            <button onClick={() => del(s.id)} style={{ background: '#e44', color: '#fff' }}>Delete</button>
          </div>
        ))}
      </section>
    </div>
  );
}
