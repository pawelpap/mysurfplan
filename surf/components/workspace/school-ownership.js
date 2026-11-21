import{useEffect,useRef,useState}from'react';
import{useLocale}from'../locale';
import{Button,Loading,PageHeading,roleName,useData}from'./ui';
import{ownershipRequest,ownershipReviewIdentity}from'../../lib/ownership-client.mjs';
import{OwnershipCheck,OwnershipClosure,OwnershipFeedback,OwnershipField,OwnershipHeading,OwnershipState}from'./ownership-ui';

export default function SchoolOwnership({school,onBack,onSaved}){
 const{locale,t,formatDate}=useLocale(),source=useData('/api/school-ownership?schoolId='+school.id);
 const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[mode,setMode]=useState(''),[confirm,setConfirm]=useState(false);
 const[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[result,setResult]=useState(null);
 const[reviewTarget,setReviewTarget]=useState(null);
 const lock=useRef(false),request=useRef({key:'',id:''});
 useEffect(()=>{setPassword('');setConfirm(false);},[locale]);
 const record=source.data,offer=result?.offer||record.pendingOffer;
 const pending=offer?.status==='pending';
 const identity=mode?ownershipReviewIdentity(record,mode,email,offer):null;
 const reviewMatches=Boolean(reviewTarget&&identity===reviewTarget.key);
 useEffect(()=>{if(source.data.school)setResult(null);},[source.data]);
 useEffect(()=>{
  if(!offer?.id||!['queued','pending','leased'].includes(offer.deliveryStatus))return;
  let attempts=0;const timer=setInterval(()=>{source.reload();if(++attempts>=6)clearInterval(timer);},5000);
  return()=>clearInterval(timer);
 },[offer?.id,offer?.deliveryStatus,source.reload]);
 useEffect(()=>{if(mode&&reviewTarget&&!reviewMatches){setMode('');setReviewTarget(null);setPassword('');setConfirm(false);setError('ownership.conflict');}},[mode,reviewTarget,reviewMatches]);
 function review(action){const key=ownershipReviewIdentity(record,action,email,offer);if(!key){setError('ownership.conflict');return;}
  setReviewTarget({key,action,schoolId:record.school.id,schoolName:record.school.name,ownershipRevision:record.school.ownershipRevision,
   recipientEmail:action==='transfer'?email.trim().toLowerCase():offer.recipientEmail,offerId:action==='transfer'?null:offer.id,roleIds:[...(record.formerOwnerRoles||[])]});
  setMode(action);setConfirm(false);setPassword('');setError('');setNotice('');}
 async function submit(event){event.preventDefault();if(lock.current||!confirm||!record.canTransfer||!reviewMatches)return;
  lock.current=true;setBusy(true);setError('');const currentPassword=password;setPassword('');
  const payload={action:reviewTarget.action,schoolId:reviewTarget.schoolId,ownershipRevision:reviewTarget.ownershipRevision,locale,
   ...(mode==='transfer'?{recipientEmail:reviewTarget.recipientEmail}:{offerId:reviewTarget.offerId})};
  const key=JSON.stringify(payload);if(request.current.key!==key)request.current={key,id:crypto.randomUUID()};
  try{const saved=await ownershipRequest('/api/school-ownership',{body:{...payload,requestId:request.current.id,currentPassword}});
   setResult(saved);setMode('');setReviewTarget(null);setConfirm(false);setEmail('');setNotice(mode==='cancel'?'ownership.offerCancelled':'ownership.offerSent');source.reload();onSaved?.();
  }catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}
 }
 const reload=()=>{setResult(null);setMode('');setReviewTarget(null);setError('');setPassword('');setConfirm(false);source.reload();onSaved?.();};
 return <div className="ownership-page"><PageHeading title={t('ownership.title')} description={school.name} back={{label:t('school.settings'),onClick:()=>{if(!busy)onBack();}}}/>
  <p>{t('ownership.scope')}</p>
  {source.loading&&!record.school?<Loading/>:source.error?<><OwnershipFeedback error="ownership.unavailable"/><Button onClick={reload}>{t('ownership.tryAgain')}</Button></>:record.school&&<>
   <section className="surface ownership-section"><h2>{t('ownership.currentOwner')}</h2>
    <p>{record.owner?`${record.owner.name} · ${record.owner.email}`:t('ownership.noOwner')}</p>
    {!record.canTransfer&&<p>{t('ownership.readOnly')}</p>}
    {offer&&<div className="ownership-offer-summary"><OwnershipState status={offer.status} deliveryStatus={offer.deliveryStatus}/>
     <p className="ownership-email">{offer.recipientEmail}</p><p>{t('ownership.offerExpires',{date:formatDate(offer.expiresAt,{dateStyle:'medium',timeStyle:'short'})})}</p>
     {pending&&<p>{t('ownership.remainOwner')}</p>}
     {pending&&record.canTransfer&&<div className="ownership-actions"><Button disabled={busy} onClick={()=>review('cancel')}>{t('ownership.cancelOffer')}</Button>
      <Button disabled={busy} onClick={()=>review('reissue')}>{t('ownership.reissueOffer')}</Button></div>}
    </div>}
    {record.canTransfer&&!pending&&!mode&&<form onSubmit={event=>{event.preventDefault();review('transfer');}}>
     <OwnershipField label={t('ownership.recipientEmail')} hint={t('ownership.recipientHelp')} type="email" required autoComplete="off" maxLength={254} value={email} disabled={busy} onChange={event=>{setEmail(event.target.value);setResult(null);setConfirm(false);setPassword('');}}/>
     <div className="ownership-actions"><Button type="submit" disabled={!email.trim()}>{t('ownership.reviewTransfer')}</Button></div>
    </form>}
    <OwnershipFeedback error={error} notice={notice}/>
    <Button onClick={reload} disabled={busy}>{t('ownership.reload')}</Button>
   </section>
   {mode&&reviewTarget&&record.canTransfer&&<section className="surface ownership-section"><OwnershipHeading>{t(mode==='transfer'?'ownership.transferTitle':mode==='cancel'?'ownership.cancelOffer':'ownership.reissueOffer')}</OwnershipHeading>
    <p><strong>{reviewTarget.schoolName}</strong></p><p className="ownership-email">{reviewTarget.recipientEmail}</p>
    <p>{t('ownership.remainOwner')}</p><p>{reviewTarget.roleIds.length?t('ownership.retainedRoles',{roles:reviewTarget.roleIds.map(role=>t(roleName(role))).join(', ')}):t('ownership.noAddedRoles')}</p>
    {mode==='reissue'&&<p>{t('ownership.reissueHelp')}</p>}
    <form onSubmit={submit}>
     <OwnershipCheck checked={confirm} disabled={busy||!reviewMatches} onChange={event=>setConfirm(event.target.checked)}>{t(mode==='transfer'?'ownership.transferConfirm':mode==='cancel'?'ownership.cancelOfferReview':'ownership.reissueReview',{school:reviewTarget.schoolName,email:reviewTarget.recipientEmail})}</OwnershipCheck>
     <OwnershipField label={t('ownership.currentPassword')} type="password" autoComplete="current-password" required maxLength={256} value={password} disabled={busy||!reviewMatches} onChange={event=>setPassword(event.target.value)}/>
     <OwnershipFeedback error={error}/><div className="ownership-actions"><Button type="submit" tone="primary" disabled={busy||!confirm||!password||!reviewMatches}>{t(busy?'ownership.busy':mode==='transfer'?'ownership.sendOffer':mode==='cancel'?'ownership.cancelOffer':'ownership.reissueOffer')}</Button>
      <Button disabled={busy} onClick={()=>{setMode('');setReviewTarget(null);setPassword('');setConfirm(false);setError('');}}>{t('ownership.cancel')}</Button>
      {error==='ownership.conflict'&&<Button onClick={reload} disabled={busy}>{t('ownership.reload')}</Button>}
     </div>
    </form>
   </section>}
   <OwnershipClosure school={school}/>
  </>}
 </div>;
}
