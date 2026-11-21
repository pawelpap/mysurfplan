import{useEffect,useRef,useState}from'react';
import{useLocale}from'../locale';
import{Button,Loading,PageHeading,useData}from'./ui';
import{ownershipRequest}from'../../lib/ownership-client.mjs';
import{OwnershipCheck,OwnershipFeedback,OwnershipField,OwnershipHeading,OwnershipState}from'./ownership-ui';

export default function SchoolClaims({onBack}){
 const{t}=useLocale(),[view,setView]=useState('targets'),[selected,setSelected]=useState(null),[notice,setNotice]=useState('');
 const[search,setSearch]=useState(''),[term,setTerm]=useState('');
 const targets=useData('/api/school-ownership/claims?view=targets'+(term?'&search='+encodeURIComponent(term):''));
 function chooseView(next){setSelected(null);setView(next);setNotice('');}
 return <div className="ownership-page"><PageHeading title={t('ownership.claimTitle')} description={t('ownership.scope')} back={{label:t('school.title'),onClick:onBack}}/>
  <nav className="ownership-tabs" aria-label={t('ownership.claimTitle')}>
   <Button aria-current={view==='targets'?'page':undefined} onClick={()=>chooseView('targets')}>{t('ownership.claimTitle')}</Button>
   <Button aria-current={view==='mine'?'page':undefined} onClick={()=>chooseView('mine')}>{t('ownership.myClaims')}</Button>
   {targets.data.canReview&&<Button aria-current={view==='review'?'page':undefined} onClick={()=>chooseView('review')}>{t('ownership.reviewQueue')}</Button>}
  </nav>
  <OwnershipFeedback notice={notice}/>
  {view==='targets'?selected?<SubmitClaim school={selected} canSubmit={targets.data.canSubmit===true} onBack={()=>setSelected(null)} onSaved={()=>{chooseView('mine');setNotice('ownership.claimSubmitted');}}/>:
   <ClaimTargets source={targets} onChoose={setSelected} search={search} setSearch={setSearch} onSearch={()=>setTerm(search.trim())} onClear={()=>{setSearch('');setTerm('');}}/>:
   <ClaimsList key={view} view={view} onBack={()=>chooseView('mine')}/>}
 </div>;
}
function ClaimTargets({source,onChoose,search,setSearch,onSearch,onClear}){
 const{t}=useLocale(),schools=source.data.schools||[];
 if(source.loading&&!source.data.schools)return <Loading/>;
 return <><p>{t('ownership.claimCatalogueHelp')}</p><p>{t('ownership.claimNoAccess')}</p>
  <form onSubmit={event=>{event.preventDefault();onSearch();}}><OwnershipField label={t('ownership.claimSearch')} value={search} minLength={2} maxLength={160} onChange={event=>setSearch(event.target.value)}/>
   <div className="ownership-actions"><Button type="submit" disabled={source.loading||search.trim().length<2}>{t('ownership.findSchools')}</Button><Button onClick={onClear} disabled={source.loading}>{t('ownership.clearSearch')}</Button></div></form>
  <OwnershipFeedback error={source.error?'ownership.unavailable':''}/>
  {source.error?<Button onClick={source.reload}>{t('ownership.tryAgain')}</Button>:<div className="ownership-cards">
   {schools.length?schools.map(school=><article className="surface ownership-section" key={school.id}><h2>{school.name}</h2>
    <Button onClick={()=>onChoose(school)}>{t('ownership.selectSchool')}</Button></article>):<p>{t('ownership.claimEmpty')} <a href="mailto:support@mywaveplan.com">{t('ownership.support')}</a></p>}
  </div>}
 </>;
}
function SubmitClaim({school,canSubmit,onBack,onSaved}){
 const{t}=useLocale(),[statement,setStatement]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const requestId=useRef(crypto.randomUUID()),lastPayload=useRef(''),lock=useRef(false);
 async function submit(event){event.preventDefault();if(lock.current||!canSubmit)return;lock.current=true;setBusy(true);setError('');
  const fingerprint=JSON.stringify([school.id,school.ownershipRevision,statement]);if(fingerprint!==lastPayload.current){requestId.current=crypto.randomUUID();lastPayload.current=fingerprint;}
  try{await ownershipRequest('/api/school-ownership/claims',{body:{action:'submit',schoolId:school.id,ownershipRevision:school.ownershipRevision,statement,requestId:requestId.current}});onSaved();}
  catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}
 }
 return <section className="surface ownership-section"><OwnershipHeading>{school.name}</OwnershipHeading><p>{t('ownership.claimNoAccess')}</p>
  {!canSubmit&&<p className="message">{t('ownership.verifiedRequired')}</p>}
  <form onSubmit={submit}><OwnershipField label={t('ownership.statement')} hint={t('ownership.statementHelp')} multiline rows={6} value={statement} maxLength={2000} minLength={20} required disabled={busy||!canSubmit} onChange={event=>setStatement(event.target.value)}/>
   <p className="ownership-count">{t('ownership.charactersRemaining',{count:2000-statement.length})}</p>
   <OwnershipFeedback error={error}/><div className="ownership-actions"><Button type="submit" tone="primary" disabled={busy||!canSubmit||statement.trim().length<20}>{t(busy?'ownership.busy':'ownership.submitClaim')}</Button>
    <Button onClick={onBack} disabled={busy}>{t('ownership.cancel')}</Button></div>
  </form></section>;
}
function ClaimsList({view}){
 const{t}=useLocale(),source=useData('/api/school-ownership/claims?view='+view),[selected,setSelected]=useState(null);
 const claims=source.data.claims||[];
 if(source.loading&&!source.data.claims)return <Loading/>;
 if(source.error)return <><OwnershipFeedback error="ownership.unavailable"/><Button onClick={source.reload}>{t('ownership.tryAgain')}</Button></>;
 const current=claims.find(claim=>claim.id===selected);
 if(current)return <ClaimDetail claim={current} review={view==='review'} onBack={()=>setSelected(null)} onSaved={()=>{source.reload();setSelected(null);}}/>;
 return <section><h2>{t(view==='review'?'ownership.reviewQueue':'ownership.myClaims')}</h2><Button onClick={source.reload}>{t('ownership.reload')}</Button>
  {claims.length?<div className="ownership-cards">{claims.map(claim=><article className="surface ownership-section" key={claim.id}>
   <h3>{claim.school.name}</h3><OwnershipState status={claim.status} deliveryStatus={claim.offer?.deliveryStatus}/>
   {claim.claimant&&<p>{claim.claimant.name} · <span className="ownership-email">{claim.claimant.email}</span></p>}
   <Button onClick={()=>setSelected(claim.id)}>{t(view==='review'?'ownership.review':'ownership.claimStatus')}</Button>
  </article>)}</div>:<p>{t(view==='review'?'ownership.noReviews':'ownership.noClaims')}</p>}
 </section>;
}
function ClaimDetail({claim,review,onBack,onSaved}){
 const{locale,t}=useLocale(),[reason,setReason]=useState(''),[caseReference,setCaseReference]=useState(''),[password,setPassword]=useState('');
 const[decision,setDecision]=useState(''),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false),ids=useRef(new Map());
 useEffect(()=>{setPassword('');setConfirm(false);},[locale]);
 const canReview=review&&claim.canReview&&claim.status==='submitted',canWithdraw=!review&&['submitted','approved'].includes(claim.status);
 function requestId(payload){const key=JSON.stringify(payload);if(!ids.current.has(key))ids.current.set(key,crypto.randomUUID());return ids.current.get(key);}
 async function act(event){event.preventDefault();if(lock.current||!confirm)return;lock.current=true;setBusy(true);setError('');const currentPassword=password;setPassword('');
  const payload=review?{action:'review',claimId:claim.id,revision:claim.revision,decision,reason,caseReference,locale}:{action:'withdraw',claimId:claim.id,revision:claim.revision};
  try{await ownershipRequest('/api/school-ownership/claims',{body:{...payload,requestId:requestId(payload),...(review?{currentPassword}:{})}});onSaved();}
  catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}
 }
 return <section className="surface ownership-section"><OwnershipHeading>{claim.school.name}</OwnershipHeading>
  <OwnershipState status={claim.status} deliveryStatus={claim.offer?.deliveryStatus}/>
  {claim.claimant&&<p>{t('ownership.claimant')}: {claim.claimant.name} · <span className="ownership-email">{claim.claimant.email}</span></p>}
  {claim.statement&&<p className="ownership-statement">{claim.statement}</p>}
  {claim.decisionReason&&<p>{t('ownership.decisionReason')}: {claim.decisionReason}</p>}
  {claim.status==='approved'&&<p>{t('ownership.claimApproved')}</p>}
  {review&&!claim.canReview&&claim.status==='submitted'&&<p>{t('ownership.selfReview')}</p>}
  {(canReview||canWithdraw)&&<form onSubmit={act}>
   {canReview&&<><p>{t('ownership.approvalNoAccess')}</p>
    <OwnershipField label={t('ownership.reviewReason')} hint={t('ownership.reviewReasonHelp')} multiline rows={4} maxLength={1000} minLength={10} required disabled={busy} value={reason} onChange={event=>setReason(event.target.value)}/>
    <OwnershipField label={t('ownership.caseReference')} maxLength={160} required disabled={busy} value={caseReference} onChange={event=>setCaseReference(event.target.value)}/>
    <div className="ownership-actions"><Button disabled={busy} aria-pressed={decision==='approve'} onClick={()=>{setDecision('approve');setConfirm(false);setPassword('');}}>{t('ownership.approveOffer')}</Button>
     <Button disabled={busy} aria-pressed={decision==='reject'} onClick={()=>{setDecision('reject');setConfirm(false);setPassword('');}}>{t('ownership.rejectClaim')}</Button></div>
   </>}
   {(canWithdraw||decision)&&<>
    <OwnershipCheck checked={confirm} disabled={busy} onChange={event=>setConfirm(event.target.checked)}>{t(canWithdraw?'ownership.withdrawReview':decision==='approve'?'ownership.approvalNoAccess':'ownership.rejectClaim',{school:claim.school.name})}</OwnershipCheck>
    {canReview&&<OwnershipField label={t('ownership.currentPassword')} type="password" autoComplete="current-password" required maxLength={256} value={password} disabled={busy} onChange={event=>setPassword(event.target.value)}/>}
    <OwnershipFeedback error={error}/><div className="ownership-actions"><Button type="submit" tone="primary" disabled={busy||!confirm||canReview&&(!password||reason.trim().length<10||!caseReference.trim())}>{t(busy?'ownership.busy':canWithdraw?'ownership.withdrawClaim':decision==='approve'?'ownership.approveOffer':'ownership.rejectClaim')}</Button>
     {error==='ownership.conflict'&&<Button onClick={onSaved} disabled={busy}>{t('ownership.reload')}</Button>}
    </div>
   </>}
  </form>}
  <Button onClick={onBack} disabled={busy}>{t('ownership.back')}</Button>
 </section>;
}
