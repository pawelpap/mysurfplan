import {useEffect,useRef,useState} from 'react';
import {useLocale} from '../locale';
import {Button,Message} from './ui';
import {validBasePoint} from '../../lib/school-location.mjs';
export {validBasePoint} from '../../lib/school-location.mjs';

const tiles='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const displayable=value=>validBasePoint(value)&&Math.abs(Number(value.latitude))<=85.05112878;

export default function SchoolBaseMap({value,onChange,disabled=false}) {
 const {t,locale}=useLocale();
 const [loaded,setLoaded]=useState(false),[status,setStatus]=useState(''),[ready,setReady]=useState(false);
 const container=useRef(null),instance=useRef(null),marker=useRef(null),library=useRef(null);
 const current=useRef({value,onChange,disabled,t});
 useEffect(()=>{current.current={value,onChange,disabled,t};},[value,onChange,disabled,t]);
 useEffect(()=>{
  if(!loaded)return;
  let disposed=false,map;
  import('leaflet').then(module=>{
   if(disposed||!container.current)return;
   const L=module.default||module;library.current=L;
   const initial=current.current.value;
   const centre=validBasePoint(initial)?[Math.max(-85,Math.min(85,Number(initial.latitude))),Number(initial.longitude)]:[20,0];
   map=L.map(container.current,{center:centre,zoom:validBasePoint(initial)?12:2,zoomControl:false,keyboard:true,scrollWheelZoom:false});
   instance.current=map;map.attributionControl.setPrefix(false);
   const layer=L.tileLayer(tiles,{maxZoom:19,minZoom:1,keepBuffer:0,updateWhenIdle:true,updateWhenZooming:false,
    referrerPolicy:'origin',attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'});
   layer.on('tileerror',()=>{if(!disposed)setStatus('schoolLocation.mapUnavailable');});layer.addTo(map);
   const change=latlng=>{
    if(current.current.disabled)return;
    const point=map.wrapLatLng(latlng);
    current.current.onChange({latitude:Number(point.lat.toFixed(6)),longitude:Number(point.lng.toFixed(6))});
   };
   map.on('click',event=>change(event.latlng));
   map.on('keydown',event=>{if(event.originalEvent?.key==='Escape')container.current?.blur();});
   if(displayable(initial)) {
    marker.current=L.marker([Number(initial.latitude),Number(initial.longitude)],{draggable:!current.current.disabled,keyboard:true,
     title:current.current.t('schoolLocation.basePin'),alt:current.current.t('schoolLocation.basePin'),
     icon:L.divIcon({className:'school-base-pin',html:'<span aria-hidden="true">●</span>',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(map);
    marker.current.on('dragend',()=>change(marker.current.getLatLng()));
   }
   if(!disposed){setReady(true);setStatus('');}
  }).catch(()=>{if(!disposed)setStatus('schoolLocation.mapUnavailable');});
  return()=>{disposed=true;marker.current=null;instance.current=null;library.current=null;map?.remove();};
 },[loaded]);
 useEffect(()=>{
  const map=instance.current,L=library.current;
  if(!ready||!map||!L)return;
  if(!displayable(value)){marker.current?.remove();marker.current=null;return;}
  const point=[Number(value.latitude),Number(value.longitude)];
  if(marker.current)marker.current.setLatLng(point);
  else {
   marker.current=L.marker(point,{draggable:!disabled,keyboard:true,title:t('schoolLocation.basePin'),alt:t('schoolLocation.basePin'),
    icon:L.divIcon({className:'school-base-pin',html:'<span aria-hidden="true">●</span>',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(map);
   marker.current.on('dragend',()=>{
    if(current.current.disabled)return;
    const next=map.wrapLatLng(marker.current.getLatLng());
    current.current.onChange({latitude:Number(next.lat.toFixed(6)),longitude:Number(next.lng.toFixed(6))});
   });
  }
  if(disabled)marker.current.dragging?.disable();else marker.current.dragging?.enable();
  const element=marker.current.getElement();
  element?.setAttribute('title',t('schoolLocation.basePin'));element?.setAttribute('aria-label',t('schoolLocation.basePin'));
 },[value,disabled,t,ready]);
 function placeAtCentre(){const map=instance.current;if(!map||disabled)return;const point=map.wrapLatLng(map.getCenter());onChange({latitude:Number(point.lat.toFixed(6)),longitude:Number(point.lng.toFixed(6))});}
 return <div className="school-base-map-panel">
  {!loaded?<div className="school-map-disclosure"><p>{t('schoolLocation.mapDisclosure')}</p><Button disabled={disabled} onClick={()=>{setStatus('schoolLocation.mapLoading');setLoaded(true);}}>{t('schoolLocation.loadMap')}</Button></div>:<>
   <div ref={container} className="school-base-map" role="region" tabIndex={0} aria-label={t('schoolLocation.mapLabel')} />
   <div className="school-map-tools"><Button className="school-map-zoom" disabled={!ready} onClick={()=>instance.current?.zoomIn()} aria-label={t('schoolLocation.zoomIn')}>+</Button><Button className="school-map-zoom" disabled={!ready} onClick={()=>instance.current?.zoomOut()} aria-label={t('schoolLocation.zoomOut')}>−</Button>
    <Button disabled={!ready||disabled} onClick={placeAtCentre}>{t('schoolLocation.pinAtCentre')}</Button>
    <Button disabled={!ready||!displayable(value)} onClick={()=>instance.current?.setView([Number(value.latitude),Number(value.longitude)],Math.max(12,instance.current.getZoom()))}>{t('schoolLocation.showPin')}</Button>
    <Button onClick={()=>{setLoaded(false);setReady(false);setStatus('');}}>{t('schoolLocation.hideMap')}</Button></div>
   <p className="muted-note">{t('schoolLocation.mapKeyboardHelp')} <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">{t('schoolLocation.reportMapIssue')}</a></p>
  </>}
  <div className="school-map-status" aria-live="polite">{status==='schoolLocation.mapLoading'?<p>{t(status)}</p>:status?<Message>{status}</Message>:null}
   {loaded&&validBasePoint(value)&&<p>{t('schoolLocation.pinCoordinates',{latitude:new Intl.NumberFormat(locale,{maximumFractionDigits:6}).format(Number(value.latitude)),longitude:new Intl.NumberFormat(locale,{maximumFractionDigits:6}).format(Number(value.longitude))})}</p>}
   {loaded&&validBasePoint(value)&&!displayable(value)&&<p>{t('schoolLocation.mapLatitudeLimit')}</p>}</div>
 </div>;
}
