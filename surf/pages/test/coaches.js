// surf/pages/test/coaches.js
import React, { useEffect, useState } from 'react';

export default function TestCoaches() {
  const [school, setSchool] = useState('angels-surf-school'); // slug or uuid
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('');

  async function load() {
    setMsg('');
    const r = await fetch(`/api/coaches?school=${encodeURIComponent(school)}`);
    const j = await r.json();
    if (j.ok) setRows(j.data);
    else setMsg(j.error || 'Server error');
  }

  useEffect(() => { load(); }, []);

  async function createCoach() {
    setMsg('');
    const r = await fetch('/api/coaches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school, name, email }),
    });
    const j = await r.json();
    if (!j.ok) setMsg(j.error || 'Server error');
    await load();
    setName(''); setEmail('');
  }

  async function del(id) {
    setMsg('');
    const r = await fetch('/api/coaches', {
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
      <h1>Coaches API Playground</h1>
      {msg && <p style={{ color: '#c00' }}>{msg}</p>}

      <section style={{ border: '1px solid #eee', padding: 16, borderRadius: 12 }}>
        <label>Scope (school slug or id)</label>
        <input value={school} onChange={e => setSchool(e.target.value)} />
        <button onClick={load} style={{ marginLeft: 8 }}>Refresh list</button>
      </section>

      <section style={{ marginTop: 20, border: '1px solid #eee', padding: 16, borderRadius: 12 }}>
        <h3>Create a coach</h3>
        <label>Name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Joao" />
        <label style={{ marginTop: 8 }}>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="j@school.com" />
        <div style={{ marginTop: 12 }}>
          <button onClick={createCoach}>Create</button>
        </div>
      </section>

      <section style={{ marginTop: 24, border: '1px solid #eee', padding: 16, borderRadius: 12 }}>
        <h3>Coaches ({rows.length})</h3>
        {!rows.length && <div>No coaches yet.</div>}
        {rows.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{r.name}</div>
              <div style={{ fontSize: 12, color: '#555' }}>{r.email || '—'}</div>
            </div>
            <button onClick={() => del(r.id)} style={{ background: '#e44', color: '#fff' }}>Delete</button>
          </div>
        ))}
      </section>
    </div>
  );
}
