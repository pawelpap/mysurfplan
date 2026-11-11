import {useEffect,useRef,useState} from 'react';
import {useLocale} from '../locale';
import {Button,Field,Message,request} from './ui';
import SchoolBaseMap,{validBasePoint} from './school-base-map';

export default function SchoolBaseLocation({schoolId,value,onChange,disabled=false,savedValue}) {
 const {locale,t}=useLocale();
 const [results,setResults]=useState([]),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 const requestId=useRef(0),controller=useRef(null);
 useEffect(()=>{requestId.current++;controller.current?.abort();setResults([]);setBusy(false);setStatus('');return()=>controller.current?.abort();},[schoolId,locale]);
 function change(patch){requestId.current++;controller.current?.abort();setBusy(false);setResults([]);setStatus('');onChange({...value,...patch});}
 async function lookup(){
  if(disabled||busy||!value.address.trim())return;
  controller.current?.abort();controller.current=new AbortController();const current=++requestId.current;
  setBusy(true);setStatus('');setResults([]);
  try{
   const response=await request('/api/school-onboarding/lookup',{method:'POST',signal:controller.current.signal,body:JSON.stringify({schoolId,address:value.address,language:locale})});
   if(current!==requestId.current)return;
   setResults(response.results||[]);setStatus(response.results?.length?'schoolLocation.chooseSuggestion':'schoolLocation.noResults');
  }catch(error){if(current===requestId.current&&error.name!=='AbortError')setStatus(error.message?.startsWith('schoolLocation.')?error.message:'schoolLocation.lookupUnavailable');}
  finally{if(current===requestId.current)setBusy(false);}
 }
 function coordinate(field,event){const next={...value,[field]:event.target.value};if(!validBasePoint(next))next.publicVisible=false;change(next);}
 return <section className="surface school-setup-section school-base-location" id="school-location">
  <div><h2>{t('schoolLocation.title')}</h2><p className="muted-note">{t('schoolLocation.intro')}</p></div>
  <label className="school-location-choice"><input type="checkbox" checked={!value.hasFixedBase} disabled={disabled} onChange={event=>change(event.target.checked?{hasFixedBase:false,address:'',latitude:null,longitude:null,publicVisible:false}:{hasFixedBase:true})}/><span>{t('schoolLocation.noFixedBase')}<small>{t('schoolLocation.noFixedBaseHelp')}</small></span></label>
  {value.hasFixedBase&&<>
   <Field label={t('schoolLocation.address')} hint={t('schoolLocation.addressHelp')} maxLength={400} value={value.address} disabled={disabled} onChange={event=>change({address:event.target.value})} autoComplete="off" />
   <div className="school-lookup-control"><p className="muted-note">{t('schoolLocation.lookupDisclosure')}</p><Button disabled={disabled||busy||value.address.trim().length<3} onClick={lookup}>{t(busy?'schoolLocation.lookingUp':'schoolLocation.lookup')}</Button></div>
   <div className="school-lookup-status" aria-live="polite">{status&&(['schoolLocation.chooseSuggestion','schoolLocation.noResults'].includes(status)?<p>{t(status)}</p>:<Message>{status}</Message>)}</div>
   {results.length>0&&<fieldset className="school-location-results"><legend>{t('schoolLocation.chooseSuggestion')}</legend>{results.map((result,index)=><Button key={`${result.latitude}:${result.longitude}:${index}`} disabled={disabled} onClick={()=>change({address:result.address,latitude:result.latitude,longitude:result.longitude})}>{result.address}</Button>)}</fieldset>}
   <p className="school-location-attribution"><a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Powered by Geoapify</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></p>
   <div className="form-grid"><Field label={t('schoolLocation.latitude')} type="number" min={-90} max={90} step="any" value={value.latitude??''} data-error-key="schoolLocation.invalid" required={value.longitude!==null&&value.longitude!==''} disabled={disabled} onInvalid={event=>event.target.setCustomValidity(t('schoolLocation.invalid'))} onChange={event=>{event.target.setCustomValidity('');coordinate('latitude',event);}} />
    <Field label={t('schoolLocation.longitude')} type="number" min={-180} max={180} step="any" value={value.longitude??''} data-error-key="schoolLocation.invalid" required={value.latitude!==null&&value.latitude!==''} disabled={disabled} onInvalid={event=>event.target.setCustomValidity(t('schoolLocation.invalid'))} onChange={event=>{event.target.setCustomValidity('');coordinate('longitude',event);}} /></div>
   <p className="muted-note">{t('schoolLocation.coordinatesHelp')}</p>
   <SchoolBaseMap value={value} disabled={disabled} onChange={patch=>change(patch)} />
   <div className="school-map-tools"><Button disabled={disabled||(!value.latitude&&!value.longitude&&value.latitude!==0&&value.longitude!==0)} onClick={()=>change({latitude:null,longitude:null,publicVisible:false})}>{t('schoolLocation.removePin')}</Button>
    <Button disabled={disabled} onClick={()=>change(savedValue||{hasFixedBase:false,address:'',latitude:null,longitude:null,publicVisible:false})}>{t('schoolLocation.resetSaved')}</Button></div>
   <label className="school-location-choice"><input type="checkbox" checked={value.publicVisible} disabled={disabled||!validBasePoint(value)} onChange={event=>change({publicVisible:event.target.checked})}/><span>{t('schoolLocation.publicVisible')}<small>{t('schoolLocation.visibilityHelp')}</small></span></label>
   <p className="school-scope-note">{t(value.publicVisible?'schoolLocation.publicReview':'schoolLocation.privateReview')}</p>
  </>}
 </section>;
}
