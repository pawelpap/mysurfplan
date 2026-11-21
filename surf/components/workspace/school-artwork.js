import{useState}from'react';import{useLocale}from'../locale';import{schoolArtworkChoice}from'../../lib/school-artwork.mjs';
export default function SchoolArtwork({kind,customUrl,hasCustom=false,alt='',version='v1',schoolId=null,className='',note=true}){
 const{t}=useLocale(),[failedSource,setFailedSource]=useState(null),[failedDefault,setFailedDefault]=useState(null);
 const choice=schoolArtworkChoice(kind,{customUrl,hasCustom,failed:failedSource===customUrl&&Boolean(customUrl),version,schoolId});
 const artworkFailed=!choice.src||failedDefault===choice.src;
 const demoArtwork=choice.isDefault&&choice.artworkVersion==='demo-v1';
 const unavailable=demoArtwork?'demoArtwork.imageUnavailable':'branding.imageUnavailable';
 return <figure className={`school-artwork artwork-${kind} ${className}`}>
  <div className="school-artwork-frame">
   {!artworkFailed?
    // eslint-disable-next-line @next/next/no-img-element
    <img src={choice.src} srcSet={choice.isDefault?choice.srcSet:undefined} sizes={kind==='logo'?'96px':'(max-width: 700px) 100vw, 1200px'} width={choice.width} height={choice.height}
     alt={choice.isDefault?(kind==='logo'?'':t(demoArtwork?'demoArtwork.coverAlt':'branding.defaultCoverAlt')):alt} loading={kind==='gallery'?'lazy':undefined}
     onError={()=>choice.isDefault?setFailedDefault(choice.src):setFailedSource(customUrl)}/>:
    <div className="artwork-unavailable" role="img" aria-label={t(unavailable)}><svg viewBox="0 0 100 60" aria-hidden="true"><path d="M5 39Q20 14 38 32T73 30T96 34" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/></svg></div>}
  </div>
  {note&&<figcaption>{artworkFailed?t(unavailable):choice.failedCustom?t('branding.imageUnavailable'):choice.isDefault?t(demoArtwork?'demoArtwork.caption':'branding.defaultArtwork'):'\u00a0'}</figcaption>}
 </figure>;
}
