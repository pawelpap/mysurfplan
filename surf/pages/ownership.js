import Head from'next/head';
import Link from'next/link';
import{useCallback,useEffect,useRef,useState}from'react';
import{LanguageSelector,LocaleProvider,useLocale}from'../components/locale';
import{ThemeSelector}from'../components/theme';
import{Brand,Button,Loading,roleName}from'../components/workspace/ui';
import{LegalText}from'../components/legal';
import{OwnershipCheck,OwnershipFeedback,OwnershipField,OwnershipHeading,OwnershipState}from'../components/workspace/ownership-ui';
import{ownershipRequest,ownershipConsequenceVersion,ownershipRecovery}from'../lib/ownership-client.mjs';
import{clearOwnership,ownershipContinuation,ownershipNext}from'../lib/ownership-continuation.mjs';
import{isLocale}from'../lib/locale/preferences.mjs';

export async function getServerSideProps({query,res}){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');
 return{props:{linkLocale:isLocale(query.language)?query.language:null}};
}
const tabStorage=()=>{try{return window.sessionStorage;}catch{return null;}};
export default function OwnershipPage({linkLocale}){
 const{locale}=useLocale(),[selected,setSelected]=useState(linkLocale);
 function choose(value){setSelected(value);window.history.replaceState(window.history.state,'','/ownership'+(value?'?language='+encodeURIComponent(value):''));}
 return <LocaleProvider pageLocale={selected??locale}><OwnershipContent selected={selected} onLanguage={choose}/></LocaleProvider>;
}
function OwnershipContent({selected,onLanguage}){
 const{locale,t,formatDate}=useLocale();
 const[continuation,setContinuation]=useState(null),[session,setSession]=useState(null),[preview,setPreview]=useState(null);
 const[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const[password,setPassword]=useState(''),[acceptance,setAcceptance]=useState(false),[representation,setRepresentation]=useState(false),[agreement,setAgreement]=useState(false);
 const[declining,setDeclining]=useState(false),[declineConfirm,setDeclineConfirm]=useState(false),[completed,setCompleted]=useState(null);
 const[notice,setNotice]=useState('');
 const lock=useRef(false),loadContext=useRef(null),forget=useCallback(()=>clearOwnership(tabStorage()),[]);
 useEffect(()=>{
  function capture(){const fragment=window.location.hash;if(fragment){window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);setCompleted(null);setPreview(null);setError('');setNotice('');setPassword('');setAcceptance(false);setRepresentation(false);setAgreement(false);setDeclining(false);setDeclineConfirm(false);}
   setContinuation(old=>!fragment&&old?old:ownershipContinuation(fragment,tabStorage()));}
  capture();window.addEventListener('hashchange',capture);return()=>window.removeEventListener('hashchange',capture);
 },[]);
 useEffect(()=>{setPassword('');setAcceptance(false);setRepresentation(false);setAgreement(false);setDeclineConfirm(false);},[locale]);
 const documentKey=preview?.agreement?[preview.agreement.documentId,preview.agreement.version,preview.agreement.language,preview.agreement.contentHash].join(':'):'';
 const identityMatches=Boolean(session?.userId&&preview?.account?.id===session.userId);
 const canAccept=Boolean(identityMatches&&!loading&&preview?.canAccept&&preview.agreement?.language===locale&&preview.consequences?.version===ownershipConsequenceVersion);
 useEffect(()=>{setPassword('');setAgreement(false);setAcceptance(false);setRepresentation(false);},[documentKey]);
 useEffect(()=>{
  if(!continuation?.token||!continuation.expires||completed)return;
  const timer=setTimeout(()=>{forget();setContinuation({token:'',stored:false});setPreview(null);setPassword('');setError('ownership.offerExpired');},Math.max(0,continuation.expires-Date.now()));
  return()=>clearTimeout(timer);
 },[continuation,completed,forget]);
 useEffect(()=>{
  const refresh=()=>{if(document.visibilityState==='visible')setAttempt(n=>n+1);};
  window.addEventListener('focus',refresh);window.addEventListener('account-access-changed',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('account-access-changed',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 useEffect(()=>{
  if(!completed)return;const controller=new AbortController();
  ownershipRequest('/api/auth/session',{signal:controller.signal}).then(current=>{
   if(controller.signal.aborted)return;
   if(current?.userId!==completed.accountId){setCompleted(null);setPreview(null);setSession(current);setPassword('');setError('');}
  }).catch(e=>{if(!controller.signal.aborted&&e.status===401){setCompleted(null);setPreview(null);setSession(null);setPassword('');setError('');}});
  return()=>controller.abort();
 },[completed,attempt]);
 useEffect(()=>{
  if(!continuation)return;
  if(!continuation.token||completed){setLoading(false);return;}
  const localeOnly=loadContext.current?.token===continuation.token&&loadContext.current.attempt===attempt&&loadContext.current.locale!==locale;
  loadContext.current={token:continuation.token,attempt,locale};
  const controller=new AbortController();setLoading(true);if(!localeOnly)setPreview(null);setError('');setPassword('');setDeclining(false);setDeclineConfirm(false);
  async function load(){try{
   const current=await ownershipRequest('/api/auth/session',{signal:controller.signal});if(controller.signal.aborted)return;setSession(current);
   if(!current||current.demo){setPreview(null);return;}
   setPreview(previous=>previous?.account?.id===current.userId?previous:null);
   const result=await ownershipRequest('/api/school-ownership/offer',{body:{action:'preview',token:continuation.token,locale},signal:controller.signal});
   if(!controller.signal.aborted)setPreview(result);
  }catch(e){if(controller.signal.aborted)return;setPreview(null);if(e.status===401)setSession(null);else{setError(e.message);if(['ownership.offerExpired','ownership.offerRevoked'].includes(e.message)){forget();setContinuation({token:'',stored:false});}}}
  finally{if(!controller.signal.aborted)setLoading(false);}}
  load();return()=>controller.abort();
 },[continuation,locale,attempt,completed,forget]);
 function exit(){if(busy)return;forget();setPassword('');setContinuation({token:'',stored:false});setPreview(null);window.location.assign('/');}
 async function switchAccount(){if(lock.current)return;lock.current=true;setBusy(true);setPassword('');
  try{await ownershipRequest('/api/auth/session',{method:'DELETE'});window.location.assign('/login?next='+encodeURIComponent(ownershipNext(locale))+'&language='+encodeURIComponent(locale));}
  catch(e){setError(e.message);lock.current=false;setBusy(false);}
 }
 async function act(event){event.preventDefault();if(lock.current||!preview||!continuation?.token)return;
  if(declining?!declineConfirm:!acceptance||!representation||!agreement||!password||!canAccept)return;
  lock.current=true;setBusy(true);setError('');setNotice('');const currentPassword=password;setPassword('');
  const body=declining?{action:'decline',token:continuation.token,offerId:preview.offer.id}:
   {action:'accept',token:continuation.token,offerId:preview.offer.id,ownershipRevision:preview.school.ownershipRevision,
    documentId:preview.agreement.documentId,version:preview.agreement.version,language:preview.agreement.language,contentHash:preview.agreement.contentHash,
    acceptedOwnership:true,authorisedRepresentative:true,acceptedAgreement:true,consequencesVersion:ownershipConsequenceVersion,currentPassword,locale};
  try{const result=await ownershipRequest('/api/school-ownership/offer',{body});setCompleted({...result,school:result.school||preview.school,accountId:preview.account.id});forget();setContinuation({token:'',stored:false});setPreview(null);
   window.dispatchEvent(new Event('account-access-changed'));try{const channel=new BroadcastChannel('account-access');channel.postMessage('changed');channel.close();}catch{}
  }catch(e){const recovery=ownershipRecovery(e);setError(recovery.signIn?'':e.message);
   if(recovery.clearPreview)setPreview(null);
   if(recovery.clearConsents){setAgreement(false);setAcceptance(false);setRepresentation(false);setDeclineConfirm(false);setDeclining(false);}
   if(recovery.signIn)setSession(null);
   if(recovery.clearToken){forget();setContinuation({token:'',stored:false});}
   if(recovery.reload){setLoading(true);if(e.message==='ownership.agreementChanged')setNotice(e.message);setAttempt(n=>n+1);}
  }finally{lock.current=false;setBusy(false);}
 }
 const login='/login?next='+encodeURIComponent(ownershipNext(locale))+'&language='+encodeURIComponent(locale);
 const historical=identityMatches?preview?.completed:null,receipt=completed||historical;
 const roles=preview?.consequences?.formerOwnerRoles?.map(role=>t(roleName(role))).join(', ');
 const recipientRoles=preview?.consequences?.recipientRoles?.map(role=>t(roleName(role))).join(', ');
 return <><Head><title>{t('ownership.acceptTitle')} · MyWavePlan</title><meta name="referrer" content="no-referrer"/></Head>
  <header className="public-header" lang={locale}><div><Brand/><div className="public-header-actions"><ThemeSelector compact/><LanguageSelector compact selection={selected??''} onLocaleChange={onLanguage}/></div></div></header>
  <main className="ownership-page ownership-offer-page" lang={locale}><h1>{t('ownership.acceptTitle')}</h1><p>{t('ownership.scope')}</p>
   <OwnershipFeedback error={error} notice={notice}/>
   {receipt?<section className="surface ownership-section"><OwnershipHeading>{t(completed?.status==='declined'?'ownership.declined':completed?'ownership.accepted':'ownership.offerCompleted')}</OwnershipHeading>
    <p>{completed?.school?.name||preview?.school?.name}</p>
    {receipt.currentlyOwner&&<Link className="button primary" href={'/?view=schools&record='+encodeURIComponent(completed?.school?.id||preview.school.id)}>{t('school.settings')}</Link>}
    <Link className="button" href="/">{t('Back to workspace')}</Link>
   </section>:loading&&!preview?<Loading/>:!continuation?.token?<section className="surface ownership-section"><p>{t('ownership.openEmail')}</p><Link className="button" href="/">{t('Back to workspace')}</Link></section>:
    !session||session.demo?<section className="surface ownership-section"><p>{t('ownership.signInHelp')}</p>
     {!continuation.stored&&<p>{t('ownership.reopenEmail')}</p>}
     {session?.demo?<Button onClick={switchAccount} disabled={busy}>{t('ownership.useAnotherAccount')}</Button>:<Link className="button primary" href={login}>{t('ownership.signIn')}</Link>}
     <Button onClick={exit} disabled={busy}>{t('ownership.exit')}</Button>
    </section>:!preview||!identityMatches?<section className="surface ownership-section"><p>{t('ownership.signedInAs',{email:session.email})}</p><p>{t('ownership.wrongAccount')}</p>
     {!continuation.stored&&<p>{t('ownership.reopenEmail')}</p>}
     <div className="ownership-actions"><Button onClick={switchAccount} disabled={busy}>{t('ownership.useAnotherAccount')}</Button><Button onClick={()=>setAttempt(n=>n+1)} disabled={busy}>{t('ownership.tryAgain')}</Button><Button onClick={exit} disabled={busy}>{t('ownership.exit')}</Button></div>
    </section>:<section className="surface ownership-section"><OwnershipHeading>{preview.school.name}</OwnershipHeading><OwnershipState status={preview.offer.status}/>
     <p>{t(preview.offer.kind==='claim'?'ownership.claimOfferHelp':'ownership.transferOfferHelp',{school:preview.school.name})}</p><p>{t('ownership.signedInAs',{email:preview.account.email})}</p>
     <p>{t('ownership.offerExpires',{date:formatDate(preview.offer.expiresAt,{dateStyle:'medium',timeStyle:'short'})})}</p>
     <p>{roles?t('ownership.formerOwnerRoles',{roles}):t('ownership.noAddedRoles')}</p>{recipientRoles&&<p>{t('ownership.recipientRoles',{roles:recipientRoles})}</p>}
     {preview.agreement?<section className="ownership-agreement"><h2>{t('ownership.requiredAgreement')}</h2><h3>{preview.agreement.title}</h3>
      <p>{t('ownership.agreementVersion',{version:preview.agreement.version})} · {t('ownership.agreementLanguage',{language:preview.agreement.language})}</p>
      <div className="ownership-agreement-body" tabIndex={0} role="region" aria-label={t('ownership.requiredAgreement')}><LegalText content={preview.agreement.content} language={preview.agreement.language}/></div>
     </section>:<p className="message">{t('ownership.requiredDocsUnavailable')}</p>}
     <form onSubmit={act}>
      {declining?<OwnershipCheck checked={declineConfirm} disabled={busy} onChange={event=>setDeclineConfirm(event.target.checked)}>{t('ownership.declineReview',{school:preview.school.name})}</OwnershipCheck>:<>
       <OwnershipCheck checked={acceptance} disabled={busy||!canAccept} onChange={event=>setAcceptance(event.target.checked)}>{t('ownership.acceptConfirm',{school:preview.school.name})}</OwnershipCheck>
       <OwnershipCheck checked={representation} disabled={busy||!canAccept} onChange={event=>setRepresentation(event.target.checked)}>{t('ownership.representationConfirm',{school:preview.school.name})}</OwnershipCheck>
       <OwnershipCheck checked={agreement} disabled={busy||!preview.agreement||!preview.canAccept} onChange={event=>setAgreement(event.target.checked)}>{t('ownership.agreementConfirm',{version:preview.agreement?.version||'',language:preview.agreement?.language||''})}</OwnershipCheck>
       <OwnershipField label={t('ownership.currentPassword')} type="password" autoComplete="current-password" required maxLength={256} value={password} disabled={busy||!canAccept} onChange={event=>setPassword(event.target.value)}/>
      </>}
      <OwnershipFeedback error={error}/><div className="ownership-actions"><Button type="submit" tone="primary" disabled={busy||(declining?!declineConfirm:!acceptance||!representation||!agreement||!password||!canAccept)}>{t(busy?'ownership.busy':declining?'ownership.decline':'ownership.accept')}</Button>
       <Button disabled={busy} onClick={()=>{setDeclining(!declining);setDeclineConfirm(false);setPassword('');}}>{t(declining?'ownership.cancel':'ownership.decline')}</Button>
       {error&&<Button disabled={busy} onClick={()=>{setError('');setAttempt(n=>n+1);}}>{t('ownership.reload')}</Button>}
       <Button disabled={busy} onClick={exit}>{t('ownership.exit')}</Button></div>
     </form>
    </section>}
  </main>
 </>;
}
