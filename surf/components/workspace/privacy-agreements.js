import { useLocale } from "../locale";
import { useState } from 'react';
import Link from 'next/link';
import DataLicences from '../data-licences';
import { legalHref } from '../../lib/locale/preferences.mjs';
import { legalDocuments } from '../../lib/legal/contracts.mjs';
import { Loading, Message, PageHeading, request, useData } from './ui';

const date = (value, locale) => new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Lisbon' });
function documentHref(d) {
  const descriptor = legalDocuments.find(v => v.id === d.document_id);
  return legalHref(descriptor?.slug || 'privacy', d.language, d.version);
}
function DocumentLink({ document, children }) {
  const { t } = useLocale();
  return <a className="document-action" href={documentHref(document)} target="_blank" rel="noreferrer">{children}<span className="sr-only"> {t("(opens in a new tab)")}</span> ↗</a>;
}

export default function PrivacyAgreements({ session }) {
  const { locale, t } = useLocale();
  const data = useData('/api/legal/records?language=' + locale);
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
      setSaved(result); setMessage(t("Your acceptance has been saved."));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="privacy-settings">
    <PageHeading title={t("Privacy and agreements")} description={t("Review your agreements, privacy information and optional choices.")} />
    {data.loading && <Loading label={t("Loading your agreements…")} />}
    <Message>{data.error || error}</Message>
    {data.error && <button className="button" onClick={data.reload}>{t("Try again")}</button>}
    <Message success>{message}</Message>
    {!data.error && initial.documents && <>
      {initial.preview && <p className="environment-note">{t("Staging · Test actions stay in this environment.")}</p>}
      {session.demo && <p className="legal-info">{t("You are exploring the demo. Agreements can be viewed here; acceptance is available with your own account.")}</p>}
      <section aria-labelledby="agreements-heading" className="privacy-section">
        <h2 id="agreements-heading">{t("Your agreements")}</h2>
        <p>{t("Opening a document does not accept it. Optional tracking choices are separate from agreements.")}</p>
        {initial.documents.filter(d => d.kind === 'terms' || initial.schools.length > 0).map(d => <Agreement key={`${d.document_id}:${d.version}:${d.language}`} document={d} schools={initial.schools} records={records.acceptances} disabled={session.demo || busy} demo={session.demo} onSave={save} />)}
        {!initial.documents.length && <p>{t("No agreements are available at the moment.")}</p>}
        <details className="record-history"><summary>{t("Agreement history")}</summary>
          {records.acceptances.length ? <ul>{records.acceptances.map((a,i) => <li key={i}><strong>{t(legalDocuments.find(d => d.id === a.document_id)?.title)}</strong><p>{t("Accepted")} {date(a.accepted_at, locale)}{a.school_id ? ` · ${a.school_name || initial.schools.find(s => s.id === a.school_id)?.name || t("School agreement")}` : ''} {t("· Version")} {a.version}</p><DocumentLink document={a}>{t("View accepted version")}</DocumentLink></li>)}</ul> : <p>{t("You have not accepted an agreement yet.")}</p>}
        </details>
      </section>
      <section aria-labelledby="privacy-heading" className="privacy-section">
        <h2 id="privacy-heading">{t("Privacy information")}</h2>
        <p>{t("Our privacy notice explains how information is used, who handles it and how to exercise your rights. You do not need to accept it.")}</p>
        <a className="document-action" href={legalHref("privacy", locale)} target="_blank" rel="noreferrer">{t("Read the privacy notice")}<span className="sr-only"> {t("(opens in a new tab)")}</span> ↗</a>
        {!session.demo && <details className="record-history"><summary>{t("Notices provided to your account")}</summary>
          <p>{t("This history records the notice provided by the service. It does not confirm that you read or accepted it.")}</p>
          <button className="button" type="button" disabled={data.loading || busy} onClick={() => { setSaved(null); data.reload(); }}>{t("Refresh history")}</button>
          {records.notices.length ? <ul>{records.notices.map((n,i) => <li key={i}>{t("Provided")} {date(n.delivered_at, locale)} {t("· Version")} {n.version}<br/><DocumentLink document={n}>{t("View this notice")}</DocumentLink></li>)}</ul> : <p>{t("No notice has been recorded yet.")}</p>}
        </details>}
      </section>
      <section aria-labelledby="choices-heading" className="privacy-section">
        <h2 id="choices-heading">{t("Optional choices")}</h2>
        <p>{t("Optional analytics, advertising and session recording are off. No action is needed.")}</p>
        <p>{t("If optional tools become available, you will be able to choose each purpose here. Your choices will not affect account access.")}</p>
        <Link className="document-action" href={legalHref("storage", locale)}>{t("Cookies and browser storage")}</Link>
      </section>
      <section aria-labelledby="licences-heading" className="privacy-section">
        <h2 id="licences-heading">{t("Data licences")}</h2>
        <p>{t("Sources and licences for forecasts, tide predictions and light times.")}</p>
        <details className="record-history data-licences"><summary>{t("View data sources and licences")}</summary><DataLicences /></details>
      </section>
      <section aria-labelledby="help-heading" className="privacy-section">
        <h2 id="help-heading">{t("Questions about your information?")}</h2>
        <p>{t("Contact us about access, corrections, deletion or another privacy request.")}</p>
        <a className="document-action" href="mailto:support@mywaveplan.com">{t("Contact support")}</a>
      </section>
    </>}
  </div>;
}

function Agreement({ document:d, schools, records, disabled, demo, onSave }) {
  const { locale, t } = useLocale();
  const [accepted, setAccepted] = useState(false);
  const [representative, setRepresentative] = useState(false);
  const [schoolId, setSchoolId] = useState(schools.length === 1 ? schools[0].id : '');
  const school = d.kind === 'school_processing';
  const prior = records.find(a => a.document_id === d.document_id && a.version === d.version && a.language === d.language && (school ? a.school_id === schoolId : !a.school_id));
  const previous = records.some(a => a.document_id === d.document_id && (school ? a.school_id === schoolId : !a.school_id));
  return <article className="legal-agreement">
    <div className="agreement-heading"><h3 lang={d.language}>{d.title}</h3><span className={`agreement-status ${prior ? 'accepted' : ''}`}>{prior ? t("Accepted") : demo ? t("View only") : previous ? t("New version available") : t("Not accepted")}</span></div>
    <p className="legal-metadata">{t("Version")} {d.version}{prior ? t(" · Accepted {1}", { 1: date(prior.accepted_at, locale) }) : ''}</p>
    {school && (schools.length === 1 ? <p className="agreement-school-name"><span>{t("School")}</span><strong>{schools[0].name}</strong></p> : <label className="agreement-school">{t("School")}<select value={schoolId} onChange={event => { setSchoolId(event.target.value); setAccepted(false); setRepresentative(false); }} disabled={disabled} required><option value="">{t("Choose a school")}</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>)}
    {!prior && previous && <p>{t("You accepted an earlier version. Review this version before accepting it.")}</p>}
    <DocumentLink document={d}>{prior ? t("View accepted version") : t("Read agreement")}</DocumentLink>
    {!prior && !demo && <form onSubmit={event => { event.preventDefault(); onSave({ action: school ? 'accept_school' : 'accept_terms', documentId:d.document_id, version:d.version, language:d.language, contentHash:d.content_hash, accepted, ...(school ? { schoolId, authorisedRepresentative:representative } : {}) }); }}>
      {school && <label className="agreement-check"><input type="checkbox" checked={representative} onChange={event => setRepresentative(event.target.checked)} disabled={disabled} required/><span>{t("I am authorised to accept this agreement on behalf of this school.")}</span></label>}
      <label className="agreement-check"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={disabled} required/><span>{t(school ? "I accept the school data-processing agreement shown above." : "I accept the terms of use shown above.")}</span></label>
      <button className="button primary" type="submit" disabled={disabled || !accepted || (school && (!schoolId || !representative))}>{disabled ? t("Saving…") : school ? t("Accept school agreement") : t("Accept terms of use")}</button>
    </form>}
  </article>;
}
