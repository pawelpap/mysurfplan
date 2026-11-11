export const schoolDefaultArtwork=Object.freeze({
 v1:Object.freeze({
  logo:Object.freeze({src:'/images/schools/default-logo-v1.svg',width:256,height:256}),
  cover:Object.freeze({src:'/images/schools/default-cover-v1-1280.webp',width:1280,height:512,
   srcSet:'/images/schools/default-cover-v1-640.webp 640w, /images/schools/default-cover-v1-1280.webp 1280w, /images/schools/default-cover-v1-1920.webp 1920w'}),
 }),
});
export function schoolArtworkChoice(kind,{customUrl=null,hasCustom=false,failed=false,version='v1'}={}){
 const selected=schoolDefaultArtwork[version]||schoolDefaultArtwork.v1;
 if(!['logo','cover','gallery'].includes(kind))throw new Error('Unknown artwork purpose');
 const valid=typeof customUrl==='string'&&(/^\/api\/media\/[a-f0-9-]{36}\?variant=(?:master|w\d+)$/.test(customUrl)||
  /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/(?:staging|production)\/public\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.webp$/i.test(customUrl));
 if(valid&&!failed)return{src:customUrl,isDefault:false,failedCustom:false};
 if(kind==='gallery')return{src:null,isDefault:false,failedCustom:true};
 return{...selected[kind==='logo'?'logo':'cover'],isDefault:true,failedCustom:Boolean(hasCustom&&(failed||!valid))};
}
