import assert from 'node:assert/strict';
import test from 'node:test';
import { brandingInput, brandingAccents, publicMediaUrl } from '../lib/school-branding.mjs';
const id = '12345678-1234-4123-8123-123456789012';
const body = { schoolId:id,revision:1,settingsRevision:1,accent:'sea',logoAssetId:null,logoAlt:'',coverAssetId:null,coverAlt:'',gallery:[] };
test('branding validates public choices without accepting state, ownership or provider URLs',()=>{
  for(const accent of Object.keys(brandingAccents)) assert.equal(brandingInput({...body,accent}).details.accent,accent);
  for(const change of [{owner:id},{published:true},{accent:'#ff0000'},{accent:'__proto__'},{revision:0},{settingsRevision:Infinity},
    {logoAssetId:'https://evil.invalid/a.png'},{logoAssetId:id,logoAlt:''},{coverAssetId:id,coverAlt:'\n'},
    {gallery:[{assetId:id,alt:''}]},{gallery:Array(7).fill({assetId:id,alt:'Image'})},
    {gallery:[{assetId:id,alt:'One'},{assetId:id,alt:'Two'}]}]) assert.throws(()=>brandingInput({...body,...change}));
  assert.equal(brandingInput({...body,logoAssetId:id,logoAlt:'  School logo  '}).details.logoAlt,'School logo');
  assert.equal(brandingInput({schoolId:id,revision:1,settingsRevision:1,requestId:id},'publish').requestId,id);
  assert.throws(()=>brandingInput({...body,requestId:id},'publish'));
});
test('public object links are derived only from written public records and safe server paths',()=>{
  const object={access:'public',state:'written',store_id:'store_AbC123',pathname:'staging/public/school/cover.webp'};
  assert.equal(publicMediaUrl(object),'https://abc123.public.blob.vercel-storage.com/staging/public/school/cover.webp');
  for(const change of [{access:'private'},{state:'planned'},{store_id:'evil.invalid'},{pathname:'../secret.webp'},
    {pathname:'https://evil.invalid/a.webp'},{pathname:'a.webp?token=secret'}]) assert.throws(()=>publicMediaUrl({...object,...change}));
});
