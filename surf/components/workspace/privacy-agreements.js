import { useState } from 'react';
import Link from 'next/link';
import DataLicences from '../data-licences';
import { legalDocuments } from '../../lib/legal/contracts.mjs';
import { Loading, Message, PageHeading, request, useData } from './ui';

const date = value => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Lisbon' });
function documentHref(d) {
  const descriptor = legalDocuments.find(v => v.id === d.document_id);
  return `/legal/${descriptor?.slug || 'privacy'}?version=${encodeURIComponent(d.version)}&language=${encodeURIComponent(d.language)}`;
}
function DocumentLink({ document, children }) {
  return <a className="document-action" href={documentHref(document)} target="_blank" rel="noreferrer">{children}<span className="sr-only"> (opens in a new tab)</span> ↗</a>;
}

export default function PrivacyAgreements({ session }) {
  const data = useData('/api/legal/records');
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const initial = data.data;
  const records = saved || initial;
  async function save(body) {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await request('/api/legal/records', { method: 'POST', body: JSON.stringify(body) });
      setSaved(result); setMessage('Your acceptance has been saved.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="privacy-settings">
    <PageHeading title="Privacy and agreements" description="Review your agreements, privacy information and optional choices." />
    {data.loading && <Loading label="Loading your agreements…" />}
    <Message>{data.error || error}</Message>
    {data.error && <button className="button" onClick={data.reload}>Try again</button>}
    <Message success>{message}</Message>
    {!data.error && initial.documents && <>
      {initial.preview && <p className="environment-note">Staging · Test actions stay in this environment.</p>}
      {session.demo && <p className="legal-info">You are exploring the demo. Agreements can be viewed here; acceptance is available with your own account.</p>}
      <section aria-labelledby="agreements-heading" className="privacy-section">
        <h2 id="agreements-heading">Your agreements</h2>
        <p>Opening a document does not accept it. Optional tracking choices are separate from agreements.</p>
        {initial.documents.filter(d => d.kind === 'terms' || initial.schools.length > 0).map(d => <Agreement key={`${d.document_id}:${d.version}:${d.language}`} document={d} schools={initial.schools} records={records.acceptances} disabled={session.demo || busy} demo={session.demo} onSave={save} />)}
        {!initial.documents.length && <p>No agreements are available at the moment.</p>}
        <details className="record-history"><summary>Agreement history</summary>
          {records.acceptances.length ? <ul>{records.acceptances.map((a,i) => <li key={i}><strong>{legalDocuments.find(d => d.id === a.document_id)?.title}</strong><p>Accepted {date(a.accepted_at)}{a.school_id ? ` · ${a.school_name || initial.schools.find(s => s.id === a.school_id)?.name || 'School agreement'}` : ''} · Version {a.version}</p><DocumentLink document={a}>View accepted version</DocumentLink></li>)}</ul> : <p>You have not accepted an agreement yet.</p>}
        </details>
      </section>
      <section aria-labelledby="privacy-heading" className="privacy-section">
        <h2 id="privacy-heading">Privacy information</h2>
        <p>Our privacy notice explains how information is used, who handles it and how to exercise your rights. You do not need to accept it.</p>
        <a className="document-action" href="/legal/privacy" target="_blank" rel="noreferrer">Read the privacy notice<span className="sr-only"> (opens in a new tab)</span> ↗</a>
        {!session.demo && <details className="record-history"><summary>Notices provided to your account</summary>
          <p>This history records the notice provided by the service. It does not confirm that you read or accepted it.</p>
          <button className="button" type="button" disabled={data.loading || busy} onClick={() => { setSaved(null); data.reload(); }}>Refresh history</button>
          {records.notices.length ? <ul>{records.notices.map((n,i) => <li key={i}>Provided {date(n.delivered_at)} · Version {n.version}<br/><DocumentLink document={n}>View this notice</DocumentLink></li>)}</ul> : <p>No notice has been recorded yet.</p>}
        </details>}
      </section>
      <section aria-labelledby="choices-heading" className="privacy-section">
        <h2 id="choices-heading">Optional choices</h2>
        <p>Optional analytics, advertising and session recording are off. No action is needed.</p>
        <p>If optional tools become available, you will be able to choose each purpose here. Your choices will not affect account access.</p>
        <Link className="document-action" href="/legal/storage">Cookies and browser storage</Link>
      </section>
      <section aria-labelledby="licences-heading" className="privacy-section">
        <h2 id="licences-heading">Data licences</h2>
        <p>Sources and licences for forecasts, tide predictions and light times.</p>
        <details className="record-history data-licences"><summary>View data sources and licences</summary><DataLicences /></details>
      </section>
      <section aria-labelledby="help-heading" className="privacy-section">
        <h2 id="help-heading">Questions about your information?</h2>
        <p>Contact us about access, corrections, deletion or another privacy request.</p>
        <a className="document-action" href="mailto:support@mywaveplan.com">Contact support</a>
      </section>
    </>}
  </div>;
}

function Agreement({ document:d, schools, records, disabled, demo, onSave }) {
  const [accepted, setAccepted] = useState(false);
  const [representative, setRepresentative] = useState(false);
  const [schoolId, setSchoolId] = useState(schools.length === 1 ? schools[0].id : '');
  const school = d.kind === 'school_processing';
  const prior = records.find(a => a.document_id === d.document_id && a.version === d.version && a.language === d.language && (school ? a.school_id === schoolId : !a.school_id));
  const previous = records.some(a => a.document_id === d.document_id && (school ? a.school_id === schoolId : !a.school_id));
  return <article className="legal-agreement">
    <div className="agreement-heading"><h3>{d.title}</h3><span className={`agreement-status ${prior ? 'accepted' : ''}`}>{prior ? 'Accepted' : demo ? 'View only' : previous ? 'New version available' : 'Not accepted'}</span></div>
    <p className="legal-metadata">Version {d.version}{prior ? ` · Accepted ${date(prior.accepted_at)}` : ''}</p>
    {school && (schools.length === 1 ? <p className="agreement-school-name"><span>School</span><strong>{schools[0].name}</strong></p> : <label className="agreement-school">School<select value={schoolId} onChange={event => { setSchoolId(event.target.value); setAccepted(false); setRepresentative(false); }} disabled={disabled} required><option value="">Choose a school</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>)}
    {!prior && previous && <p>You accepted an earlier version. Review this version before accepting it.</p>}
    <DocumentLink document={d}>{prior ? 'View accepted version' : 'Read agreement'}</DocumentLink>
    {!prior && !demo && <form onSubmit={event => { event.preventDefault(); onSave({ action: school ? 'accept_school' : 'accept_terms', documentId:d.document_id, version:d.version, language:d.language, contentHash:d.content_hash, accepted, ...(school ? { schoolId, authorisedRepresentative:representative } : {}) }); }}>
      {school && <label className="agreement-check"><input type="checkbox" checked={representative} onChange={event => setRepresentative(event.target.checked)} disabled={disabled} required/><span>I am authorised to accept this agreement on behalf of this school.</span></label>}
      <label className="agreement-check"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={disabled} required/><span>I accept {school ? 'the school data-processing agreement' : 'the terms of use'} shown above.</span></label>
      <button className="button primary" type="submit" disabled={disabled || !accepted || (school && (!schoolId || !representative))}>{disabled ? 'Saving…' : school ? 'Accept school agreement' : 'Accept terms of use'}</button>
    </form>}
  </article>;
}
