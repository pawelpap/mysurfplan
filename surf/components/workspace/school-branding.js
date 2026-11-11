import { useEffect,useRef,useState } from 'react';
import { useLocale } from '../locale';
import { brandingAccents } from '../../lib/school-branding.mjs';
import { Button,Field,Loading,Message,PageHeading,request,useData } from './ui';
import MediaUpload from './media-upload';
import SchoolPresentation from './school-presentation';
import SchoolArtwork from './school-artwork';

const defaults=()=>({accent:'sea',logoAssetId:null,logoAlt:'',coverAssetId:null,coverAlt:'',gallery:[]});
export default function SchoolBranding({school,onBack,onSaved,onAgreements,session}) {
  const {t}=useLocale(),source=useData('/api/school-branding?schoolId='+school.id);
  const [record,setRecord]=useState(null),[form,setForm]=useState(null),[busy,setBusy]=useState(false);
  const [notice,setNotice]=useState(''),[error,setError]=useState(''),[mode,setMode]=useState('');
  const dialog=useRef(null);
  useEffect(()=>{if(source.data?.schoolId){setRecord(source.data);setForm(source.data.details);}},[source.data]);
  useEffect(()=>{if(mode){dialog.current?.showModal();dialog.current?.querySelector('h2')?.focus({preventScroll:true});if(dialog.current)dialog.current.scrollTop=0;}else dialog.current?.close();},[mode]);
  const dirty=Boolean(form&&record&&JSON.stringify(form)!==JSON.stringify(record.details));
  useEffect(()=>{if(!dirty)return;const warn=event=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  if(source.loading&&!record)return <Loading/>;
  if(source.error||!record||!form)return <><Message>{t('branding.unavailable')}</Message><Button onClick={source.reload}>{t('Try again')}</Button></>;
  const editable=record.canEdit&&!busy,preview={...record.preview,branding:form};
  const change=next=>{setForm(next);setNotice('');setError('');};
  async function save(details=form){
    setBusy(true);setNotice('');setError('');
    try{const result=await request('/api/school-branding',{method:'PATCH',body:JSON.stringify({schoolId:school.id,revision:record.revision,settingsRevision:record.settingsRevision,...details})});
      setRecord(result);setForm(result.details);setNotice('branding.saved');setMode('');onSaved?.();
    }catch(e){setError(e.message?.startsWith('branding.')?e.message:'branding.unavailable');}finally{setBusy(false);}
  }
  async function publish(){
    setBusy(true);setNotice('');setError('');
    try{const result=await request('/api/school-branding',{method:'POST',body:JSON.stringify({schoolId:school.id,revision:record.revision,settingsRevision:record.settingsRevision,requestId:crypto.randomUUID()})});
      setRecord(result);setForm(result.details);setNotice('branding.published');setMode('');onSaved?.();
    }catch(e){setError(e.message?.startsWith('branding.')?e.message:'branding.unavailable');}finally{setBusy(false);}
  }
  function swap(index,offset){const gallery=[...form.gallery];[gallery[index],gallery[index+offset]]=[gallery[index+offset],gallery[index]];change({...form,gallery});}
  const imageField=(purpose)=>{
    const asset=form[`${purpose}AssetId`],alt=form[`${purpose}Alt`];
    return <section className="surface branding-section" key={purpose}>
      <h2>{t(`branding.${purpose}`)}</h2>
      <SchoolArtwork kind={purpose} customUrl={asset?`/api/media/${asset}?variant=${purpose==='logo'?'w512':'w1600'}`:null} hasCustom={Boolean(asset)} alt={alt||''} version={record.preview.defaultArtworkVersion} schoolId={record.preview.schoolId}/>
      <div className="branding-image-actions"><MediaUpload purpose={purpose} schoolId={school.id} replaceAssetId={asset} disabled={!editable}
        onSaved={result=>change({...form,[`${purpose}AssetId`]:result.assetId,[`${purpose}Alt`]:alt||(purpose==='logo'?school.name:'')})}/>
        {asset&&<Button disabled={!editable} onClick={()=>change({...form,[`${purpose}AssetId`]:null,[`${purpose}Alt`]:''})}>{t('media.remove')}</Button>}
      </div>
      {asset&&<Field label={t('branding.alt')} hint={t('branding.altHelp')} required maxLength={300} value={alt} disabled={!editable}
        onChange={event=>change({...form,[`${purpose}Alt`]:event.target.value})}/>}
    </section>;
  };
  return <div className="school-branding">
    <PageHeading title={t('branding.title')} description={school.name} back={{label:t('school.settings'),onClick:()=>{if(!dirty||window.confirm(t('school.unsaved')))onBack();}}}/>
    <p>{t('branding.intro')}</p>
    <div className="branding-version"><strong>{record.publishedVersion?t('branding.publishedVersion',{version:record.publishedVersion}):t('branding.notPublished')}</strong>
      <span>{t('school.draft')} · {record.revision}</span></div>
    <div className="branding-editor-layout">
      <form onSubmit={event=>{event.preventDefault();save();}} className="branding-editor">
        {imageField('logo')}{imageField('cover')}
        <section className="surface branding-section"><h2>{t('branding.gallery')}</h2><p>{t('branding.galleryHelp')}</p>
          {form.gallery.map((item,index)=><div className="branding-gallery-item" key={item.assetId}>
            <SchoolArtwork kind="gallery" customUrl={`/api/media/${item.assetId}?variant=w1200`} hasCustom alt={item.alt||''}/>
            <Field label={`${t('branding.alt')} ${index+1}`} required maxLength={300} value={item.alt} disabled={!editable}
              onChange={event=>change({...form,gallery:form.gallery.map((value,i)=>i===index?{...value,alt:event.target.value}:value)})}/>
            <div className="branding-gallery-controls"><MediaUpload purpose="gallery" schoolId={school.id} replaceAssetId={item.assetId} disabled={!editable}
              onSaved={result=>change({...form,gallery:form.gallery.map((value,i)=>i===index?{...value,assetId:result.assetId}:value)})}/>
              <Button disabled={!editable} onClick={()=>change({...form,gallery:form.gallery.filter((_,i)=>i!==index)})}>{t('media.remove')}</Button>
              <Button disabled={!editable||index===0} onClick={()=>swap(index,-1)}>{t('media.earlier')}</Button>
              <Button disabled={!editable||index===form.gallery.length-1} onClick={()=>swap(index,1)}>{t('media.later')}</Button>
            </div>
          </div>)}
          {form.gallery.length<6&&<MediaUpload purpose="gallery" schoolId={school.id} disabled={!editable}
            onSaved={result=>change({...form,gallery:[...form.gallery,{assetId:result.assetId,alt:''}]})}/>}
        </section>
        <section className="surface branding-section"><fieldset disabled={!editable}><legend>{t('branding.accent')}</legend><div className="branding-palette">
          {Object.entries(brandingAccents).map(([name,colours])=><label key={name}><input type="radio" name="accent" value={name} checked={form.accent===name} onChange={()=>change({...form,accent:name})}/>
            <span style={{backgroundColor:colours.light}} aria-hidden="true"/>{t('branding.'+name)}</label>)}
        </div></fieldset></section>
        <section className="surface branding-section branding-publication-actions"><p>{t('branding.publishHelp')}</p>
          <div className="branding-status" role="status"><Message success={!error&&Boolean(notice)}>{error?t(error):notice?t(notice):''}</Message></div>
          {error==='branding.conflict'&&<Button onClick={()=>{setError('');setNotice('');source.reload();}}>{t('school.reload')}</Button>}
          <div className="branding-primary-actions"><Button type="submit" tone="primary" disabled={!editable||!dirty}>{t(busy?'Saving…':'branding.save')}</Button>
            <Button onClick={()=>setMode('preview')} disabled={busy}>{t('branding.preview')}</Button>
            <Button onClick={()=>setMode('publish')} disabled={!editable||dirty}>{t('branding.publish')}</Button>
            <Button onClick={()=>setMode('reset')} disabled={!editable}>{t('branding.reset')}</Button></div>
          {dirty&&<p className="muted-note">{t('branding.unsaved')}</p>}
          {onAgreements&&<Button tone="quiet" onClick={onAgreements}>{t('school.reviewAgreement')}</Button>}
        </section>
      </form>
      <aside className="branding-preview-rail"><h2>{t('branding.publicPreview')}</h2><SchoolPresentation data={preview} privatePreview compact/>
        <Button onClick={()=>setMode('preview')}>{t('branding.preview')}</Button></aside>
    </div>
    <dialog ref={dialog} className="branding-review-dialog" aria-labelledby="branding-review-title" onCancel={event=>{event.preventDefault();if(!busy)setMode('');}}>
      <h2 id="branding-review-title" tabIndex={-1}>{t(mode==='publish'?'branding.publishReview':mode==='reset'?'branding.reset':'branding.preview')}</h2>
      {mode==='reset'?<p>{t('branding.resetReview')}</p>:<>
        {mode==='publish'&&<p>{t('branding.publishHelp')}</p>}
        <SchoolPresentation data={mode==='publish'?record.preview:preview} privatePreview/>
        <h3>{t('branding.emailPreview')}</h3><p className="muted-note">{t('branding.sampleEmail')}</p>
        <SchoolPresentation data={mode==='publish'?record.preview:preview} privatePreview email/>
      </>}
      <Message>{error&&t(error)}</Message>
      <div className="form-actions">{mode==='publish'&&<Button tone="primary" onClick={publish} disabled={busy}>{t('branding.publish')}</Button>}
        {mode==='reset'&&<Button tone="primary" onClick={()=>save(defaults())} disabled={busy}>{t('branding.reset')}</Button>}
        <Button onClick={()=>setMode('')} disabled={busy}>{t('Close')}</Button></div>
    </dialog>
  </div>;
}
