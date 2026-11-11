// Browser-safe crop geometry. Keep controls within the server's minimum
//16-pixel integer rectangle without silently changing submitted controls.
export const MEDIA_CROP_ASPECTS=Object.freeze({profile:1,logo:1,cover:2.5,gallery:4/3});

export function maxCropZoom(width,height,purpose) {
  const ratio=Object.hasOwn(MEDIA_CROP_ASPECTS,purpose)?MEDIA_CROP_ASPECTS[purpose]:null;
  if(!ratio||!Number.isInteger(width)||!Number.isInteger(height)||width<64||height<64)return 1;
  const baseWidth=Math.min(width,height*ratio);
  const minimumWidth=Math.max(16,Math.ceil(16*ratio));
  return Math.max(1,Math.floor(Math.min(4,baseWidth/minimumWidth)*100)/100);
}
