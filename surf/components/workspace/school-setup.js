import { useEffect, useState } from 'react';
import { useLocale } from '../locale';
import { Button, Empty, Field, Loading, Message, PageHeading, request, useData } from './ui';
import { schoolSetupProgress } from '../../lib/school-setup-progress.mjs';

const problem = error => error.status === 409 ? 'school.conflict' : error.status === 400 ? 'school.invalid' : error.status === 403 ? 'school.forbidden' : 'school.unavailable';
const validLink = value => { try { const url=new URL(value); return url.protocol==='https:' && !url.username && !url.password; } catch { return false; } };
const zones = ['Europe/Lisbon','Atlantic/Azores','Europe/Madrid','Europe/Paris','Europe/London','UTC'];
const formValues = school => ({name:school?.name || '',description:school?.description || '',timezone:school?.timezone || 'Europe/Lisbon',contactEmail:school?.contactEmail || '',contactPhone:school?.contactPhone || '',website:school?.website || '',socialLinks:school?.socialLinks?.join('\n') || '',operatingSpotIds:school?.operatingSpotIds || []});

export default function SchoolSetup({ session, query, go, onSaved, onAgreements }) {
  const { locale, t } = useLocale();
  useEffect(() => {
    for (const input of document.querySelectorAll('.school-setup [data-error-key]')) {
      if (input.validity?.customError) input.setCustomValidity(t(input.dataset.errorKey));
    }
  }, [locale, t]);
  const source = useData('/api/school-onboarding');
  const [saved, setSaved] = useState(null);
  const [notice, setNotice] = useState('');
  const [createdId, setCreatedId] = useState(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const schools = source.data;
  const selected = (saved?.id === query.record ? saved : null) || schools.find(school => school.id === query.record);
  const complete = async (school, created) => {
    setSaved(school); setNotice(created ? 'school.created' : 'school.saved'); source.reload(); onSaved();
    if (created) { setCreatedId(school.id); go({record:school.id}); }
  };
  if (query.action === 'new') return <CreateDraft session={session} onCancel={()=>go({})} onSaved={school=>complete(school,true)} />;
  if (source.loading && !schools.length) return <Loading />;
  if (source.error) return <><Message>{t('school.unavailable')}</Message><Button onClick={source.reload}>{t('Try again')}</Button></>;
  if (query.record && !selected) return <Empty title={t('School not found')} action={<Button onClick={()=>go({})}>{t('school.cancel')}</Button>}>{t('school.forbidden')}</Empty>;
  if (selected) return <SchoolSettings key={`${selected.id}:${reloadVersion}`} school={selected} notice={notice} created={createdId===selected.id} onEditing={()=>setNotice('')} onSaved={school=>complete(school,false)} onCancel={()=>{setNotice('');setCreatedId(null);go({});}} onAgreements={onAgreements} onReload={async()=>{const list=await request('/api/school-onboarding');const fresh=list.find(record=>record.id===selected.id);if(fresh){setSaved(fresh);setNotice('');setReloadVersion(value=>value+1);source.reload();}else{setSaved(null);go({});}}} />;
  return <div className="school-setup">
    <PageHeading title={t('school.title')} description={t('school.intro')} action={<Button tone="primary" onClick={()=>{setNotice('');go({action:'new'});}}>{t('school.create')}</Button>} />
    {schools.length ? <div className="school-setup-list">{schools.map(school=><article className="surface school-setup-card" key={school.id}>
      <div><h2>{school.name}</h2><p className="muted-note">{t(school.owner ? 'school.owner' : school.canEdit ? 'school.admin' : 'school.readOnly')}</p></div>
      <SchoolState school={school} compact />
      <Button onClick={()=>{setNotice('');setCreatedId(null);go({record:school.id});}}>{t(school.canEdit?'school.continue':'school.viewSettings')}</Button>
    </article>)}</div> : <Empty title={t('school.empty')}>{t('school.privateHelp')}</Empty>}
  </div>;
}
function TimezoneField({ value, onChange, disabled }) {
  const { t } = useLocale();
  return <Field label={t('school.timezone')} hint={t('school.timezoneHelp')}>{id=><><input id={id} data-error-key="school.invalidTimezone" list={`${id}-zones`} required maxLength={100} value={value} onChange={event=>{event.target.setCustomValidity('');onChange(event);}} onBlur={event=>{try{new Intl.DateTimeFormat('en-GB',{timeZone:event.target.value}).format();event.target.setCustomValidity('');}catch{event.target.setCustomValidity(t('school.invalidTimezone'));}}} onInvalid={event=>event.target.setCustomValidity(t('school.invalidTimezone'))} disabled={disabled} autoComplete="off" /><datalist id={`${id}-zones`}>{zones.map(zone=><option key={zone} value={zone} />)}</datalist></>}</Field>;
}
function CreateDraft({ session, onCancel, onSaved }) {
  const { t } = useLocale();
  const [name,setName] = useState('');
  const [timezone,setTimezone] = useState('Europe/Lisbon');
  const [requestId] = useState(()=>crypto.randomUUID());
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function submit(event) {
    event.preventDefault(); if(busy) return;
    setBusy(true);setError('');
    try { const school=await request('/api/school-onboarding',{method:'POST',body:JSON.stringify({requestId,name,timezone})});await onSaved(school); }
    catch(error){setError(problem(error));setBusy(false);}
  }
  return <div className="school-setup school-create">
    <PageHeading title={t('school.create')} description={t('school.createIntro')} back={{label:t('school.title'),onClick:onCancel}} />
    <form className="surface school-setup-section" onSubmit={submit}>
      <p className="school-scope-note">{t('school.privateHelp')}</p>
      <Field label={t('school.name')} data-error-key="school.invalidName" required maxLength={160} value={name} pattern=".*[a-zA-Z0-9].*" onChange={event=>{event.target.setCustomValidity('');setName(event.target.value);}} onInvalid={event=>event.target.setCustomValidity(t('school.invalidName'))} disabled={busy} autoComplete="organization" />
      <TimezoneField value={timezone} onChange={event=>setTimezone(event.target.value)} disabled={busy} />
      <div className="school-owner-summary"><strong>{t('school.owner')}</strong><span>{[session.name,session.familyName].filter(Boolean).join(' ')}</span><span>{session.email}</span></div>
      <Message>{error && t(error)}</Message>
      <div className="school-form-actions"><Button type="submit" tone="primary" disabled={busy}>{t(busy ? 'Saving…' : 'school.create')}</Button><Button onClick={onCancel} disabled={busy}>{t('Cancel')}</Button></div>
    </form>
  </div>;
}
function SchoolState({ school, compact=false }) {
  const { t } = useLocale();
  const draft=school.workspaceKind==='self_service' && school.workspaceStatus==='draft';
  return <div className={`school-state ${compact?'compact':''}`} aria-label={t('school.settings')}>
    <strong>{t(draft ? 'school.draft' : school.workspaceKind==='legacy' ? 'school.legacy' : 'Active')}</strong>
    <span>{t(school.workspaceKind==='legacy' ? 'Public schedule' : school.listingStatus==='published' ? 'Published' : 'school.notPublic')}</span>
    {school.workspaceKind==='self_service' && <span>{t(school.pilotAccessStatus==='approved' ? 'school.pilotApproved' : 'school.pilotPending')}</span>}
  </div>;
}
function SchoolSettings({school,notice,created,onEditing,onSaved,onCancel,onAgreements,onReload}) {
  const {locale,t}=useLocale();
  const spots=useData('/api/spots');
  const legal=useData('/api/legal/records?language='+locale);
  const [values,setValues]=useState(()=>formValues(school));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [checklistOpen,setChecklistOpen]=useState(false);
  useEffect(()=>{
    const media=window.matchMedia('(min-width:1101px)');
    const update=()=>setChecklistOpen(media.matches);update();
    media.addEventListener('change',update);return ()=>media.removeEventListener('change',update);
  },[]);
  const dirty=JSON.stringify(values)!==JSON.stringify(formValues(school));
  const progress=schoolSetupProgress(school,legal.data);
  useEffect(()=>{
    if(!dirty)return;
    const warn=event=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);
    return ()=>window.removeEventListener('beforeunload',warn);
  },[dirty]);
  function leave(action){if(!dirty || window.confirm(t('school.unsaved')))action();}
  const change=(field,value)=>{onEditing();setValues(previous=>({...previous,[field]:value}));};
  async function submit(event){
    event.preventDefault();if(busy || !school.canEdit)return;
    onEditing();setBusy(true);setError('');
    try {
      const payload={...values,id:school.id,revision:school.revision,socialLinks:values.socialLinks.split('\n').map(value=>value.trim()).filter(Boolean)};
      const updated=await request('/api/school-onboarding',{method:'PATCH',body:JSON.stringify(payload)});
      await onSaved(updated);setValues(formValues(updated));
    }catch(error){setError(problem(error));}finally{setBusy(false);}
  }
  const field=(key,type='text')=><Field label={t('school.'+key.replace('contactEmail','email').replace('contactPhone','phone'))} type={type} data-error-key={key==='website'?'school.invalidLink':key==='name'?'school.invalidName':key==='contactEmail'?'school.invalidEmail':'school.invalidPhone'} maxLength={key==='name'?160:key==='contactPhone'?40:key==='contactEmail'?254:2048} required={key==='name'} value={values[key]} pattern={key==='name'?'.*[a-zA-Z0-9].*':key==='website'?'https://.*':undefined} onChange={event=>{event.target.setCustomValidity('');change(key,event.target.value);}} onBlur={event=>{if(key==='website' && event.target.value)event.target.setCustomValidity(validLink(event.target.value)?'':t('school.invalidLink'));if(key==='contactPhone' && event.target.value)event.target.setCustomValidity(/^\+?[0-9 ()\-./]{3,40}$/.test(event.target.value)?'':t('school.invalidPhone'));}} onInvalid={event=>event.target.setCustomValidity(t(key==='website'?'school.invalidLink':key==='name'?'school.invalidName':key==='contactEmail'?'school.invalidEmail':'school.invalidPhone'))} disabled={busy || !school.canEdit} />;
  return <div className="school-setup">
    <PageHeading title={t('school.settings')} description={`${school.name} · ${t(school.owner?'school.owner':'school.admin')}`} back={{label:t('school.title'),onClick:()=>leave(onCancel)}} />
    <Message success>{created && t('school.created')}</Message>
    <SchoolState school={school} />
    <p className="muted-note">{t('school.requiredHelp')}</p>
    {!school.canEdit && <p className="school-scope-note">{t('school.readOnly')}</p>}
    <div className="school-settings-layout">
      <aside className="school-checklist surface">
        <h2>{t('school.checklist')}</h2><p>{t('school.progress',{done:progress.done,total:progress.total})}</p>
        <progress max={progress.total} value={progress.done} aria-label={t('school.checklist')} />
        <p className="school-next-step">{progress.steps.find(step=>!step.complete) ? t('school.next',{step:t('school.'+progress.steps.find(step=>!step.complete).key)}) : t('school.complete')}</p>
        <details className="school-checklist-details" open={checklistOpen} onToggle={event=>setChecklistOpen(event.currentTarget.open)}><summary>{t('school.viewChecklist')}</summary><ol>{progress.steps.map(step=><li key={step.key}>
          <a href={`#school-${step.key}`}><span aria-hidden="true">{step.complete?'✓':'○'}</span> {t('school.'+step.key)}<small>{t(step.complete?'school.complete':'school.incomplete')}</small></a>
        </li>)}</ol></details><small className="muted-note">{t('school.checklistHelp')}</small>
      </aside>
      <form className="school-settings-form" onSubmit={submit}>
        <section className="surface school-setup-section" id="school-basics"><h2>{t('school.basics')}</h2>
          {field('name')}<TimezoneField value={values.timezone} onChange={event=>change('timezone',event.target.value)} disabled={busy || !school.canEdit} />
          <div id="school-description"><Field label={t('school.description')}>{id=><textarea id={id} rows={4} maxLength={5000} value={values.description} onChange={event=>change('description',event.target.value)} disabled={busy || !school.canEdit} />}</Field></div>
          <p className="muted-note">{t('school.renameHelp')}</p>
        </section>
        <section className="surface school-setup-section" id="school-contact"><h2>{t('school.contact')}</h2><div className="form-grid">{field('contactEmail','email')}{field('contactPhone','tel')}</div>{field('website','url')}
          <Field label={t('school.social')} hint={t('school.socialHelp')}>{id=><textarea id={id} data-error-key="school.invalidSocial" rows={3} value={values.socialLinks} onChange={event=>{event.target.setCustomValidity('');change('socialLinks',event.target.value);}} onBlur={event=>{const links=event.target.value.split('\n').map(link=>link.trim()).filter(Boolean);event.target.setCustomValidity(links.length<=5 && links.every(validLink)?'':t('school.invalidSocial'));}} disabled={busy || !school.canEdit} maxLength={10244} />}</Field>
        </section>
        <section className="surface school-setup-section" id="school-spots"><h2>{t('school.spots')}</h2><p className="muted-note">{t('school.spotsHelp')}</p>
          {spots.loading ? <Loading/> : spots.error ? <><Message>{t('school.unavailable')}</Message><Button onClick={spots.reload}>{t('Try again')}</Button></> : <fieldset className="school-spots"><legend className="sr-only">{t('school.spots')}</legend>{spots.data.map(spot=><label key={spot.id}><input type="checkbox" checked={values.operatingSpotIds.includes(spot.id)} disabled={busy || !school.canEdit} onChange={event=>change('operatingSpotIds',event.target.checked?[...values.operatingSpotIds,spot.id]:values.operatingSpotIds.filter(id=>id!==spot.id))}/><span>{spot.name}</span></label>)}</fieldset>}
        </section>
        <section className="surface school-setup-section" id="school-agreement"><h2>{t('school.agreement')}</h2><p>{t('school.agreementHelp')}</p>
          {legal.error && <Message>{t('school.unavailable')}</Message>}
          {progress.preview && <p className="school-scope-note">{t('school.previewAgreement')}</p>}
          <Button onClick={()=>leave(onAgreements)}>{t('school.reviewAgreement')}</Button>
        </section>
        {error==='school.conflict' && <Button onClick={()=>leave(async()=>{try{await onReload();}catch{setError('school.unavailable');}})}>{t('school.reload')}</Button>}
        <div className="school-save-status"><p role="status">{notice==='school.saved' ? t('school.saved') : ''}</p><Message>{error && t(error)}</Message></div>
        <div className="school-form-actions"><Button type="submit" tone="primary" disabled={busy || !school.canEdit}>{t(busy?'Saving…':'school.save')}</Button><Button onClick={()=>leave(onCancel)} disabled={busy}>{t('Cancel')}</Button></div>
      </form>
    </div>
  </div>;
}
