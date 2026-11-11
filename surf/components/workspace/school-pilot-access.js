import{useEffect,useState}from'react';import{useLocale}from'../locale';import{Button,Field,Loading,Message,request,useData}from'./ui';
export default function SchoolPilotAccess({school,onSaved,onAgreements}){
 const{locale,t}=useLocale(),source=useData('/api/school-onboarding/pilot?schoolId='+school.id+'&revision='+school.revision);
 const[saved,setSaved]=useState(null),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>setPassword(''),[locale]);
 const review=saved||source.data;if(school.workspaceKind!=='self_service')return null;
 async function approve(event){event.preventDefault();if(busy)return;const currentPassword=password;setPassword('');setError('');setBusy(true);try{
  const result=await request('/api/school-onboarding/pilot',{method:'POST',body:JSON.stringify({schoolId:school.id,revision:review.settingsRevision,acceptanceId:review.acceptanceId,requestId:crypto.randomUUID(),currentPassword})});
  setSaved({...review,status:'approved'});onSaved?.(result.school);
 }catch(e){setError(e.message?.includes('.')?e.message:'pilot.unavailable');}finally{setBusy(false);}}
 return <section className="surface school-setup-section school-pilot-access"><h2>{t('pilot.title')}</h2>
 {source.loading&&!review?.schoolId?<Loading/>:source.error?<Message>{t('pilot.unavailable')}</Message>:review.status==='approved'?<Message success>{t('pilot.approved')}</Message>:<>
  <p>{t('pilot.help')}</p><ul>{!review.detailsReady&&<li>{t('pilot.details')}</li>}{!review.legalReady&&<li>{t('pilot.legal')}</li>}{!review.agreementAccepted&&<li>{t('pilot.agreement')}</li>}</ul>
  {review.detailsReady&&review.legalReady&&review.agreementAccepted&&<p className="muted-note">{t('pilot.ready')}</p>}
  {onAgreements&&!review.agreementAccepted&&<Button onClick={onAgreements}>{t('school.reviewAgreement')}</Button>}
  {review.canApprove?<form onSubmit={approve} className="auth-form"><Field label={t('pilot.password')} type="password" autoComplete="current-password" value={password} maxLength={256} required disabled={busy} onChange={e=>setPassword(e.target.value)}/>
   <div className="branding-status" role="status"><Message>{error&&t(error)}</Message></div><Button type="submit" tone="primary" disabled={busy||!review.detailsReady||!review.legalReady||!review.agreementAccepted}>{t('pilot.approve')}</Button></form>:
   <p><a href="mailto:support@mywaveplan.com">{t('pilot.support')}</a></p>}
  {error==='pilot.conflict'&&<Button onClick={()=>{setSaved(null);setError('');source.reload();}}>{t('school.reload')}</Button>}
 </>}
 </section>;
}
