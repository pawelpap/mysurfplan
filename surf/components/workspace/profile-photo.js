import { useState } from 'react';
import { useLocale } from '../locale';
import { Avatar,Button,Loading,Message,request,useData } from './ui';
import MediaUpload from './media-upload';

export default function ProfilePhoto({session,onSaved}) {
  const {t}=useLocale(),source=useData('/api/media/profile');
  const [saved,setSaved]=useState(null),[notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const photo=saved||source.data;
  async function complete(result){setSaved(result.photo||result);setNotice('media.saved');setError('');onSaved?.();}
  async function remove(){setBusy(true);setNotice('');setError('');try{
    const result=await request('/api/media/profile',{method:'DELETE',body:JSON.stringify({revision:photo.revision})});
    setSaved(result);setNotice('media.removed');onSaved?.();
  }catch(e){setError(e.message?.startsWith('media.')?e.message:'media.unavailable');}finally{setBusy(false);}}
  return <section className="surface padded profile-photo-card">
    <h2>{t('media.profile')}</h2>
    {source.loading&&!photo?.revision?<Loading/>:source.error?<Message>{t('media.unavailable')}</Message>:<>
      <Avatar person={{...session,photoUrl:photo?.url||null}} />
      <div className="profile-photo-actions"><MediaUpload purpose="profile" revision={photo.revision} replaceAssetId={photo.assetId}
        disabled={busy} label={t(photo.url?'media.replace':'media.upload')} onSaved={complete}/>
        {photo.mode!=='none'&&(photo.url||photo.assetId)&&<Button disabled={busy} onClick={remove}>{t('media.remove')}</Button>}
      </div>
      <div className="branding-status" role="status"><Message success={Boolean(notice)}>{error?t(error):notice?t(notice):''}</Message></div>
    </>}
  </section>;
}
