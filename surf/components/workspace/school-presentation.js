import { useLocale } from '../locale';
import { brandingAccents } from '../../lib/school-branding.mjs';
import SchoolArtwork from './school-artwork';

export default function SchoolPresentation({data,privatePreview=false,email=false,compact=false}) {
  const {t}=useLocale();if(!data)return null;
  const brand=data.branding||{},accent=brandingAccents[brand.accent]||brandingAccents.sea;
  const image=(assetId,role)=>assetId?(privatePreview?`/api/media/${assetId}?variant=${role}`:data.images?.find(item=>item.assetId===assetId&&item.role===role)?.url):null;
  const cover=image(brand.coverAssetId,'w1600'),logo=image(brand.logoAssetId,'w512');
  return <article className={`school-presentation ${compact?'is-compact':''} ${email?'is-email':''}`}
    style={{'--brand-accent-light':accent.light,'--brand-accent-dark':accent.dark}}>
    <SchoolArtwork kind="cover" customUrl={cover} hasCustom={Boolean(brand.coverAssetId)} alt={brand.coverAlt||''} version={data.defaultArtworkVersion}/>
    <div className="school-presentation-body">
      <SchoolArtwork kind="logo" customUrl={logo} hasCustom={Boolean(brand.logoAssetId)} alt={brand.logoAlt||data.name} version={data.defaultArtworkVersion}/>
      {data.demo&&<p className="branding-demo-label">{t('branding.demo')}</p>}
      <h2>{email?t('branding.sampleSubject'):data.name}</h2>
      {email?<><strong>{data.name}</strong><p>{t('branding.sampleBody')}</p></>:<>
        {data.description&&<p className="branding-description">{data.description}</p>}
        {data.demo&&<p>{t('branding.demoHelp')}</p>}
        {!compact&&<>
          <div className="branding-contact-links">
            {data.contactEmail&&<a href={`mailto:${encodeURIComponent(data.contactEmail)}`}>{data.contactEmail}</a>}
            {data.contactPhone&&<a href={`tel:${data.contactPhone.replace(/[^+0-9]/g,'')}`}>{data.contactPhone}</a>}
            {data.website&&<a href={data.website} rel="noreferrer">{t('Website')}</a>}
            {data.socialLinks?.map(link=><a href={link} key={link} rel="noreferrer">{new URL(link).hostname}</a>)}
          </div>
          {data.baseLocation?<div className="branding-base"><p>{data.baseLocation.address}</p>
            <p>{data.baseLocation.latitude}, {data.baseLocation.longitude}</p>
            <small><a href="https://www.geoapify.com/" rel="noreferrer">Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">© OpenStreetMap</a></small>
          </div>:<p className="muted-note">{t('branding.noBase')}</p>}
          {!!data.operatingSpots?.length&&<div><h3>{t('branding.spots')}</h3><ul>{data.operatingSpots.map(spot=><li key={spot.id}>{spot.name}</li>)}</ul></div>}
          {!!brand.gallery?.length&&<div className="branding-public-gallery">{brand.gallery.map(item=>{
            const url=image(item.assetId,'w1200');
            return <SchoolArtwork key={item.assetId} kind="gallery" customUrl={url} hasCustom alt={item.alt}/>;
          })}</div>}
        </>}
      </>}
    </div>
  </article>;
}
