// surf/pages/test/coaches.js
import { useState } from 'react';

export default function CoachesPlayground() {
  const [school, setSchool] = useState(''); // slug or uuid
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState('');

  async function refresh() {
    setMsg('');
    const q = school ? `?school=${encodeURIComponent(school)}` : '';
    const r = await fetch(`/api/coaches${q}`);
    const j = await r.json();
    if (!j.ok) return setMsg(j.error || 'Error');
    setList(j.data);
  }

  async function create() {
    setMsg('');
    const r = await fetch('/api/coaches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school, name, email }),
    });
    const j = await r.json();
    if (!j.ok) return setMsg(j.error || 'Error creating coach');
    setName(''); setEmail('');
    await refresh();
  }

  async function remove(id) {
    setMsg('');
    const r = await fetch(`/api/coaches?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const j = await r.json();
    if (!j.ok) return setMsg(j.error || 'Error deleting coach');
    await refresh();
  }

  return (
    <div style={{maxWidth: 760, margin: '2rem auto', fontFamily: 'Inter, system-ui, Arial'}}>
      <h1>Coaches API Playground</h1>
      <p>Enter a <b>school slug or id</b> to scope the list. Use your school slug from <code>/test/schools</code>.</p>

      {msg && <div style={{background:'#fee2e2', padding:12, borderRadius:8, margin:'12px 0'}}> {msg} </div>}

      <section style={{border:'1px solid #eee', borderRadius:12, padding:16, marginTop:12}}>
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
        <h3>Create a coach</h3>
        <div style={{display:'grid', gap:8}}>
          <input placeholder="Coach name" value={name} onChange={e=>setName(e.target.value)}
                 style={{padding:10, borderRadius:8, border:'1px solid #ddd'}} />
          <input placeholder="Email (optional)" value={email} onChange={e=>setEmail(e.target.value)}
                 style={{padding:10, borderRadius:8, border:'1px solid #ddd'}} />
        </div>
        <div style={{marginTop:10}}>
          <button onClick={create} style={{padding:'10px 16px', borderRadius:8, background:'#16a34a', color:'#fff'}}>Create</button>
        </div>
      </section>

      <section style={{border:'1px solid #eee', borderRadius:12, padding:16, marginTop:16}}>
        <h3>Coaches ({list.length})</h3>
        {list.length === 0 ? <div>No coaches yet.</div> : (
          <ul>
            {list.map(c => (
              <li key={c.id} style={{margin:'6px 0', display:'flex', gap:8, alignItems:'center'}}>
                <span style={{flex:1}}>{c.name} <span style={{color:'#666'}}>— {c.email || 'no email'}</span></span>
                <button onClick={()=>remove(c.id)} style={{padding:'6px 10px', borderRadius:8, background:'#ef4444', color:'#fff'}}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
