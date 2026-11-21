import test from'node:test';import assert from'node:assert/strict';import{schoolArtworkChoice,schoolDefaultArtwork}from'../lib/school-artwork.mjs';
const id='12345678-1234-4123-8123-123456789012',logo=`/api/media/${id}?variant=w512`,cover=`/api/media/${id}?variant=w1600`;
test('shared defaults apply independently without creating per-school asset copies',()=>{
 const a={logo:schoolArtworkChoice('logo'),cover:schoolArtworkChoice('cover')},b={logo:schoolArtworkChoice('logo'),cover:schoolArtworkChoice('cover')};
 assert.equal(a.logo.src,b.logo.src);assert.equal(a.cover.src,b.cover.src);
 assert.equal(schoolArtworkChoice('logo',{customUrl:logo,hasCustom:true}).isDefault,false);
 assert.equal(schoolArtworkChoice('cover').isDefault,true);
 assert.equal(schoolArtworkChoice('logo').isDefault,true);
 assert.equal(schoolArtworkChoice('cover',{customUrl:cover,hasCustom:true}).isDefault,false);
 assert.equal(a.cover.width/a.cover.height,2.5);assert.equal(a.logo.width,a.logo.height);
 assert.match(a.cover.srcSet,/640w/);assert.match(a.cover.srcSet,/1920w/);
});
test('removal/reset restores shared defaults while a failed custom source is explicitly distinguished',()=>{
 const removed=schoolArtworkChoice('logo',{customUrl:null,hasCustom:false});assert.equal(removed.failedCustom,false);assert.equal(removed.src,schoolDefaultArtwork.v1.logo.src);
 const failed=schoolArtworkChoice('cover',{customUrl:cover,hasCustom:true,failed:true});assert.equal(failed.isDefault,true);assert.equal(failed.failedCustom,true);
 assert.equal(schoolArtworkChoice('cover',{customUrl:null,hasCustom:true}).failedCustom,true);
 assert.equal(schoolArtworkChoice('cover',{customUrl:'https://untrusted.invalid/a.png',hasCustom:true}).failedCustom,true);
 assert.equal(schoolArtworkChoice('logo',{version:'v1'}).src,removed.src);
});
