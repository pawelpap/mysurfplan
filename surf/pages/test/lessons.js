// surf/pages/test/lessons.js
import React, { useEffect, useState } from 'react';

export default function TestLessons() {
  const [school, setSchool] = useState('angels-surf-school');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('');

  async function load() {
    setMsg('');
    const qs = new URLSearchParams();
    qs.set('school', school);
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    if (difficulty) qs.set('difficulty', difficulty);

    const r = await fetch(`/api/public/lessons?${qs.toString()}`);
    const j = await r.json();
    if (j.ok) setRows(j.data);
    else setMsg(j.error || 'Server error');
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ maxWidth: 760, margin: '40px auto', padding: 16 }}>
      <h1>Lessons API Playground</h1>
      {msg && <p style={{ color: '#c00' }}>{msg}</p>}

      <section style={{ border: '1px solid #eee', padding: 16, borderRadius: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label>School</label>
            <input value={school} onChange={e => setSchool(e.target.value)} placeholder="school-slug" />
          </div>
          <div>
            <label>From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div>
            <label>Difficulty</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
              <option value="">All</option>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>
        </div>
        <button onClick={load} style={{ marginTop: 12 }}>Refresh list</button>
      </section>

      <section style={{ marginTop: 24, border: '1px solid #eee', padding: 16, borderRadius: 12 }}>
        <h3>Lessons ({rows.length})</h3>
        {!rows.length && <div>No lessons yet.</div>}
        {rows.map(l => (
          <div key={l.id} style={{ borderTop: '1px solid #eee', padding: '12px 0' }}>
            <div><b>{new Date(l.start_at).toLocaleString()}</b> • {Math.round(l.duration_min / 60 * 10) / 10}h</div>
            <div>{l.difficulty} • {l.place}</div>
            {!!l.coaches?.length && (
              <div style={{ fontSize: 12, color: '#555' }}>
                Coaches: {l.coaches.map(c => c.name).join(', ')}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
