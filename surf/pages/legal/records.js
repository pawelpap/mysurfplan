import { useState } from 'react';
import Link from 'next/link';
import { LegalLayout } from '../../components/legal';
import { defaultPreferences, legalDocuments, optionalPurposes, preferenceVersion } from '../../lib/legal/contracts.mjs';

export default function LegalRecords({ initial, documents, schools, demo }) {
  const [records,setRecords] = useState(initial);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  async function save(body) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/legal/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save this action.');
      setRecords(result.data);setMessage(body.action === 'optional_preference' ? 'Optional purposes remain off.' : 'Acceptance recorded.');
    } catch(error) { setMessage(error.message); } finally { setBusy(false); }
  }
  async function withdraw() {
    for (const purpose of optionalPurposes) await save({action:'optional_preference',purpose,selected:false,version:preferenceVersion,language:'en-GB'});
  }
  return <LegalLayout title="Your legal records">
    <p>Terms acceptance, privacy-notice delivery and optional choices are recorded separately. You can keep using your account without optional tracking.</p>
    {demo && <p>Demo access is read-only. Log in with your own account to record an action.</p>}
    <p role="status" aria-live="polite">{message}</p>
    <h2>Agreements</h2>
    {documents.map(d => <Agreement key={d.document_id} document={d} schools={schools} disabled={demo || busy} onSave={save} />)}
    <ul>{records.acceptances.map((a,i) => <li key={i}>{legalDocuments.find(d => d.id===a.document_id)?.title} · {a.version} · {a.language} · {a.accepted_at.slice(0,10)}{a.school_id ? ' · School agreement' : ''}{a.status==='staging_preview' ? ' · Staging only' : ''}</li>)}</ul>
    {!records.acceptances.length && <p>No acceptance has been recorded for this account.</p>}
    <h2>Privacy information delivered</h2>
    <p>Delivery records show which notice the service provided. They do not mean you consented to processing or read the notice.</p>
    <ul>{records.notices.map((n,i) => <li key={i}>Privacy notice · {n.version} · {n.language} · {n.delivered_at.slice(0,10)}</li>)}</ul>
    {!records.notices.length && <p>No notice delivery has been recorded for this account. <Link href="/legal/privacy">Open the privacy notice</Link>.</p>}
    <h2>Optional purposes</h2>
    <p>Marketing, analytics, advertising, session recording and public rankings are currently off. The planned tracking tools are not installed. There are no tracking identifiers to remove in this release.</p>
    <button type="button" className="button" disabled={demo || busy} onClick={withdraw}>Keep optional purposes off</button>
  </LegalLayout>;
}

function Agreement({document:d,schools,disabled,onSave}) {
  const [accepted,setAccepted] = useState(false);
  const [representative,setRepresentative] = useState(false);
  const [schoolId,setSchoolId] = useState('');
  const slug = legalDocuments.find(v=>v.id===d.document_id).slug;
  const school = d.kind === 'school_processing';
  return <form className="legal-agreement" onSubmit={event=>{event.preventDefault();onSave({action:school?'accept_school':'accept_terms',documentId:d.document_id,version:d.version,language:d.language,contentHash:d.content_hash,accepted,...(school?{schoolId,authorisedRepresentative:representative}:{})});}}>
    <h3>{d.title}</h3><p>Version {d.version} · {d.language}{d.status==='staging_preview'?' · Staging only':''}</p>
    <p><Link href={`/legal/${slug}?version=${encodeURIComponent(d.version)}&language=${d.language}`}>Read this version</Link></p>
    {school && <><label>School<select value={schoolId} onChange={event=>setSchoolId(event.target.value)} disabled={disabled} required><option value="">Choose a school</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label><input type="checkbox" checked={representative} onChange={event=>setRepresentative(event.target.checked)} disabled={disabled} required />I am authorised to represent this school.</label></>}
    <label><input type="checkbox" checked={accepted} onChange={event=>setAccepted(event.target.checked)} disabled={disabled} required />I accept this version of {d.title.toLowerCase()}.</label>
    <button className="button" type="submit" disabled={disabled || !accepted || (school && (!schoolId || !representative))}>Record acceptance</button>
  </form>;
}

export async function getServerSideProps({req,res}) {
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
  const {getAuthSession} = await import('../../lib/auth');
  const session = await getAuthSession(req);
  if (!session) return {redirect:{destination:'/login?next=%2Flegal%2Frecords',permanent:false}};
  const {sql} = await import('../../lib/db');
  const {createLegalStore} = await import('../../lib/legal/store.mjs');
  const store = createLegalStore(sql),preview = await store.preview(req);
  const initial = await store.records(session.userId);
  initial.preferences ||= defaultPreferences();
  const documents = (await Promise.all(legalDocuments.filter(d=>d.kind!=='privacy_notice').map(d=>store.document(d.id,{preview})))).filter(Boolean).map(({content,...d})=>d);
  const schools = (session.schools || []).filter(s=>s.open && s.status==='active' && (s.owner || s.roles.includes('school_admin'))).map(({id,name})=>({id,name}));
  return {props:JSON.parse(JSON.stringify({initial,documents,schools,demo:session.demo}))};
}
