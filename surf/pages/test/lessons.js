// surf/pages/test/lessons.js
import { useState } from 'react';

export default function LessonsPlayground() {
  const [school, setSchool] = useState(''); // slug or uuid
  const [difficulty, setDifficulty] = useState('Beginner');
  const [start, setStart] = useState(() => new Date(Date.now() + 3600_000).toISOString().slice(0,16));
  const [duration, setDuration] = useState(90);
  const [place, setPlace] = useState('');
  const [coachIds, setCoachIds] = useState(''); // comma-separated UUIDs
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState('');

  async function refresh() {
    setMsg('');
    if (!school) { setMsg('Enter school slug or id, then refresh.'); return; }
    const q = new URLSearchParams({ school }).toString();
    const r = await fetch(`/api/lessons?${q}`);
    const j = await r.json();
    if (!j.ok) return setMsg(j.error || 'Error');
    setList(j.data);
  }

  async function create() {
    setMsg('');
    const body = {
      school,
      startISO: new Date(start).toISOString(),
      durationMin: Number(duration),
      difficulty,
      place,
    };
    const ids = coachIds.split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length > 0) body.coachIds = ids;

    const r = await fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!j.ok) return setMsg(j.error || 'Error creating lesson');
    await refresh();
  }

  async function remove(id) {
    setMsg('');
    const r = await fetch(`/api/lessons?id=${encodeURIComponent(id)}`, { method:'DELETE' });
    const j = await r.json();
    if (!j.ok) return setMsg(j.error || 'Error deleting lesson');
    await refresh();
  }

  return (
    <div style={{maxWidth: 840, margin:'2rem auto', fontFamily:'Inter, system-ui, Arial'}}>
      <h1>Lessons API Playground</h1>
      {msg && <div style={{background:'#fee2e2', padding:12, borderRadius:8, margin:'12px 0'}}>{msg}</div>}

      <section style={{border:'1px solid #eee', borderRadius:12, padding:16}}>
        <h3>Scope</h3>
        <input
          placeholder="school slug or uuid (e.g. angels)"
          value={school}
          onChange={(e)=>setSchool(e.target.value)}
          style={{width:'100%', padding:10, borderRadius:8, border:'1px solid #ddd'}}
        />
        <div style={{marginTop:10}}>
          <button onClick={refresh} style={{padding:'8px 14px', borderRadius:8, background:'#eee'}}>Refresh list</button>
        </div>
      </section>

      <section style={{border:'1px solid #eee', borderRadius:12, padding:16, marginTop:16}}>
        <h3>Create a lesson</h3>
        <div style={{display:'grid', gap:8}}>
          <label>
            <div style={{fontSize:12, color:'#666'}}>Start (local)</div>
            <input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}
              style={{padding:10, borderRadius:8, border:'1px solid #ddd', width:'100%'}} />
          </label>
          <label>
            <div style={{fontSize:12, color:'#666'}}>Duration (min)</div>
            <input type="number" min="30" step="30" value={duration} onChange={e=>setDuration(e.target.value)}
              style={{padding:10, borderRadius:8, border:'1px solid #ddd', width:'100%'}} />
          </label>
          <label>
            <div style={{fontSize:12, color:'#666'}}>Difficulty</div>
            <select value={difficulty} onChange={e=>setDifficulty(e.target.value)}
              style={{padding:10, borderRadius:8, border:'1px solid #ddd', width:'100%'}}>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </label>
          <label>
            <div style={{fontSize:12, color:'#666'}}>Place</div>
            <input value={place} onChange={e=>setPlace(e.target.value)}
              style={{padding:10, borderRadius:8, border:'1px solid #ddd', width:'100%'}} />
          </label>
          <label>
            <div style={{fontSize:12, color:'#666'}}>Coach IDs (optional, comma separated UUIDs)</div>
            <input placeholder="uuid1, uuid2" value={coachIds} onChange={e=>setCoachIds(e.target.value)}
              style={{padding:10, borderRadius:8, border:'1px solid #ddd', width:'100%'}} />
          </label>
        </div>
        <div style={{marginTop:10}}>
          <button onClick={create} style={{padding:'10px 16px', borderRadius:8, background:'#16a34a', color:'#fff'}}>Create</button>
        </div>
      </section>

      <section style={{border:'1px solid #eee', borderRadius:12, padding:16, marginTop:16}}>
        <h3>Lessons ({list.length})</h3>
        {list.length === 0 ? <div>No lessons yet.</div> : (
          <ul>
            {list.map(l => (
              <li key={l.id} style={{margin:'10px 0', borderBottom:'1px solid #eee', paddingBottom:8}}>
                <div><b>{new Date(l.startISO).toLocaleString()}</b> — {Math.round((l.durationMin||90)/60*10)/10}h — {l.difficulty} — {l.place}</div>
                <div style={{color:'#666'}}>Coaches: {Array.isArray(l.coaches) && l.coaches.length ? l.coaches.join(', ') : '—'}</div>
                <div style={{marginTop:6}}>
                  <button onClick={()=>remove(l.id)} style={{padding:'6px 10px', borderRadius:8, background:'#ef4444', color:'#fff'}}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{border:'1px dashed #ccc', borderRadius:12, padding:16, marginTop:16}}>
        <h3>Public feed (read only)</h3>
        <div style={{fontSize:13, color:'#555'}}>
          GET <code>/api/public/lessons?school=&lt;slug&gt;</code> → subset for students, no auth.
        </div>
      </section>
    </div>
  );
}
