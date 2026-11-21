import {useEffect,useId,useRef}from'react';
import {useLocale}from'../locale';
import {ownershipStatusKey,ownershipDeliveryKey}from'../../lib/ownership-client.mjs';

export function OwnershipField({label,hint,error,children,multiline=false,onChange,required,...props}){
 const id=useId(),{locale,t}=useLocale(),input=useRef(null);
 useEffect(()=>{input.current?.setCustomValidity('');},[locale]);
 const common={...props,id,ref:input,required,onChange:event=>{event.target.setCustomValidity('');onChange?.(event);},
  'aria-describedby':[hint&&id+'-hint',error&&id+'-error'].filter(Boolean).join(' ')||undefined,'aria-invalid':error?true:undefined,
  onInvalid:event=>event.target.setCustomValidity(t(props.type==='email'?'school.invalidEmail':props.type==='password'?'account.currentPasswordInvalid':'ownership.invalid'))};
 return <div className="field ownership-field"><label htmlFor={id}>{label}</label>
  {children?children(id):multiline?<textarea {...common}/>:<input {...common}/>}
  {hint&&<small id={id+'-hint'}>{hint}</small>}{error&&<small id={id+'-error'} role="alert">{error}</small>}
 </div>;
}
export function OwnershipFeedback({error,notice}){
 const{t}=useLocale(),ref=useRef(null);
 useEffect(()=>{if(error)ref.current?.focus({preventScroll:true});},[error]);
 return <div className="ownership-feedback" aria-live="polite">
  {error?<p className="message" role="alert" tabIndex={-1} ref={ref}>{t(error)}</p>:notice?<p className="message success" role="status">{t(notice)}</p>:null}
 </div>;
}
export function OwnershipHeading({children}){
 const ref=useRef(null);useEffect(()=>{ref.current?.focus({preventScroll:true});},[]);
 return <h2 ref={ref} tabIndex={-1}>{children}</h2>;
}
export function OwnershipState({status,deliveryStatus}){
 const{t}=useLocale(),delivery=ownershipDeliveryKey(deliveryStatus);
 return <div className="ownership-state"><span className="status-badge">{t(ownershipStatusKey(status))}</span>{delivery&&<span>{t(delivery)}</span>}</div>;
}
export function OwnershipCheck({children,...props}){return <label className="ownership-check"><input type="checkbox" {...props}/><span>{children}</span></label>;}
export function OwnershipClosure({school}){
 const{t}=useLocale();return <section className="surface ownership-section"><h2>{t('ownership.closureTitle')}</h2>
  <p>{t('ownership.closureHelp')}</p><p>{t('ownership.closureNotErasure')}</p>
  <a className="button" href={'mailto:support@mywaveplan.com?subject='+encodeURIComponent('MyWavePlan school closure: '+school.name)}>{t('ownership.closureSupport')}</a>
  <p><a href="mailto:support@mywaveplan.com">support@mywaveplan.com</a></p></section>;
}
