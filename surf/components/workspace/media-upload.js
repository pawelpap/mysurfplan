import { useEffect,useId,useRef,useState } from 'react';
import { useLocale } from '../locale';
import { Button,Field,Message,request } from './ui';
import {maxCropZoom}from'../../lib/media-crop-controls.mjs';

export default function MediaUpload({purpose,schoolId,revision,replaceAssetId,onSaved,disabled=false,label}) {
  const {t}=useLocale();const id=useId(),dialog=useRef(null),opener=useRef(null);
  const [file,setFile]=useState(null),[existing,setExisting]=useState(null),[url,setUrl]=useState(''),[crop,setCrop]=useState({zoom:1,x:50,y:50});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [maximumZoom,setMaximumZoom]=useState(4),[imageReady,setImageReady]=useState(false);
  useEffect(()=>{if(existing){setUrl(`/api/media/${existing}?variant=master`);return;}if(!file)return;const value=URL.createObjectURL(file);setUrl(value);return()=>URL.revokeObjectURL(value);},[file,existing]);
  useEffect(()=>{if(file||existing){dialog.current?.showModal();}else{dialog.current?.close();}},[file,existing]);
  function close(){if(busy)return;setFile(null);setExisting(null);setUrl('');setError('');opener.current?.focus();}
  async function choose(event){
    const chosen=event.target.files?.[0];event.target.value='';if(!chosen)return;
    setError('');if(chosen.size>3*1024*1024){setError('media.fileTooLarge');return;}
    if(!['image/jpeg','image/png','image/webp'].includes(chosen.type)){setError('media.unsupportedFormat');return;}
    const bytes=new Uint8Array(await chosen.slice(0,12).arrayBuffer());
    const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
    const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    if(!png&&!jpeg&&!webp){setError('media.unsupportedFormat');return;}
    setExisting(null);setImageReady(false);setCrop({zoom:1,x:50,y:50});setFile(chosen);
  }
  async function upload(){
    if((!file&&!existing)||busy||!imageReady)return;setBusy(true);setError('');
    try{
      const result=existing?await request('/api/media/recrop',{method:'POST',body:JSON.stringify({assetId:existing,requestId:crypto.randomUUID(),crop,...(revision?{revision}:{})})}):await request('/api/media/upload',{method:'POST',body:file,headers:{'Content-Type':file.type,
        'X-Media-Options':JSON.stringify({requestId:crypto.randomUUID(),purpose,...(schoolId?{schoolId}:{}),
          ...(revision?{revision}:{}),...(replaceAssetId?{replaceAssetId}:{}),crop})}});
      setFile(null);setExisting(null);setUrl('');await onSaved(result);opener.current?.focus();
    }catch(e){setError(e.message?.startsWith('media.')?e.message:'media.unavailable');}finally{setBusy(false);}
  }
  return <div className="media-upload">
    <label className={`button media-file-button ${disabled?'is-disabled':''}`} ref={opener} tabIndex={disabled?-1:0}
      onKeyDown={event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();document.getElementById(id)?.click();}}}>
      {label||t(replaceAssetId?'media.replace':'media.upload')}<input id={id} type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} disabled={disabled} />
    </label>
    {replaceAssetId&&<Button disabled={disabled} onClick={()=>{setFile(null);setError('');setImageReady(false);setCrop({zoom:1,x:50,y:50});setExisting(replaceAssetId);}}>{t('media.adjust')}</Button>}
    <small className="muted-note">{t('media.hint')}</small>
    {!file&&!existing&&<Message>{error&&t(error)}</Message>}
    <dialog ref={dialog} className="media-crop-dialog" aria-labelledby={`${id}-title`} onCancel={event=>{event.preventDefault();close();}}>
      <h2 id={`${id}-title`}>{t('media.cropTitle')}</h2><p>{t('media.cropHelp')}</p>
      <div className={`media-crop-preview ${purpose==='profile'?'is-profile':''}`} style={{aspectRatio:purpose==='cover'?'5 / 2':purpose==='gallery'?'4 / 3':'1'}}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url&&(file||existing)&&<img src={url} alt="" onLoad={event=>{const {naturalWidth:width,naturalHeight:height}=event.currentTarget;if(width<64||height<64||width>8192||height>8192||width*height>16000000){setImageReady(false);setError('media.imageDimensions');return;}const maximum=maxCropZoom(width,height,purpose);setMaximumZoom(maximum);setCrop(old=>({...old,zoom:Math.min(old.zoom,maximum)}));setImageReady(true);}}
          onError={()=>{setImageReady(false);setError('media.invalidImage');}} style={{objectPosition:`${crop.x}% ${crop.y}%`,transform:`scale(${crop.zoom})`,transformOrigin:`${crop.x}% ${crop.y}%`}} />}
      </div>
      {[['zoom','media.zoom',1,maximumZoom,0.01],['x','media.horizontal',0,100,1],['y','media.vertical',0,100,1]].map(([name,key,min,max,step])=>
        <Field key={name} label={`${t(key)}: ${name==='zoom'?crop[name].toFixed(2):crop[name]+'%'}`}>
          {fieldId=><input id={fieldId} type="range" min={min} max={max} step={step} value={crop[name]} disabled={busy||!imageReady}
            onChange={event=>setCrop({...crop,[name]:Number(event.target.value)})} />}
        </Field>)}
      <Button onClick={()=>setCrop({zoom:1,x:50,y:50})} disabled={busy}>{t('media.resetCrop')}</Button>
      <Message>{error&&t(error)}</Message>
      <div className="form-actions"><Button tone="primary" disabled={busy||!imageReady} onClick={upload}>{t(busy?'Saving…':'media.use')}</Button><Button onClick={close} disabled={busy}>{t('Cancel')}</Button></div>
    </dialog>
  </div>;
}
