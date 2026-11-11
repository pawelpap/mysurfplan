import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { MEDIA_LIMITS, mediaCrop, processMediaImage,processSanitisedMaster } from '../lib/image-media.mjs';
import { maxCropZoom } from '../lib/media-crop-controls.mjs';

const image = async (format = 'png') => sharp({ create: { width: 320, height: 200, channels: 4, background: '#096b75' } })
  .withMetadata({ orientation: 6, exif: { IFD0: { ImageDescription: 'PRIVATE GPS/identity test marker' } } })[format]().toBuffer();

test('decoded JPEG, PNG and WebP produce oriented bounded real WebP images without inherited metadata', async () => {
  for (const [format, contentType] of [['jpeg','image/jpeg'],['png','image/png'],['webp','image/webp']]) {
    const source = await image(format);
    for (const purpose of ['profile','logo','cover','gallery']) {
      const result = await processMediaImage(source, { contentType, purpose });
      assert.equal(result.variants.length, 3);
      assert.equal(result.sourceWidth, 200); assert.equal(result.sourceHeight, 320);
      assert(result.byteCount <= MEDIA_LIMITS.assetBytes);
      for (const variant of result.variants) {
        const metadata = await sharp(variant.bytes).metadata();
        assert.equal(metadata.format, 'webp');
        assert.equal(metadata.width, variant.width); assert.equal(metadata.height, variant.height);
        for (const field of ['exif','xmp','iptc','icc','orientation']) assert.equal(metadata[field], undefined);
        assert.doesNotMatch(variant.bytes.toString('latin1'), /PRIVATE GPS/);
      }
    }
  }
});

test('crop controls stay within oriented bounds including extreme positions, zooms and aspect ratios', () => {
  for (const purpose of ['profile','logo','cover','gallery']) for (const x of [0,50,100]) for (const y of [0,50,100]) for (const zoom of [1,4]) {
    const crop = mediaCrop(320, 200, purpose, { x, y, zoom });
    assert(crop.left >= 0 && crop.top >= 0 && crop.width >= 16 && crop.height >= 16);
    assert(crop.left + crop.width <= 320); assert(crop.top + crop.height <= 200);
  }
  for (const controls of [{x:0,y:0,zoom:NaN},{x:Infinity,y:0,zoom:1},{x:-1,y:50,zoom:1},
    {x:50,y:101,zoom:1},{x:50,y:50,zoom:4.01},{x:50,y:50,zoom:1,path:'forged'},null])
    assert.throws(() => mediaCrop(320,200,'profile',controls), /media.invalidCrop/);
});

test('unsupported/spoofed/truncated/oversized images, animation and dimensions are rejected', async () => {
  const png = await image();
  await assert.rejects(processMediaImage(png, {contentType:'image/jpeg',purpose:'profile'}), /media.unsupportedFormat/);
  for (const bytes of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), Buffer.from('GIF89a'), Buffer.from('not an image')])
    await assert.rejects(processMediaImage(bytes,{contentType:'image/png',purpose:'profile'}), /media.unsupportedFormat/);
  await assert.rejects(processMediaImage(Buffer.alloc(MEDIA_LIMITS.inputBytes+1),{contentType:'image/png',purpose:'profile'}), /media.fileTooLarge/);
  await assert.rejects(processMediaImage(png.subarray(0,40),{contentType:'image/png',purpose:'profile'}), /media.invalidImage/);
  const chunk = Buffer.alloc(20); chunk.writeUInt32BE(8); chunk.write('acTL',4);
  const apng = Buffer.concat([png.subarray(0,33),chunk,png.subarray(33)]);
  await assert.rejects(processMediaImage(apng,{contentType:'image/png',purpose:'profile'}), /media.animationUnsupported/);
  const tooWide = await sharp({create:{width:8193,height:64,channels:3,background:'white'}}).png().toBuffer();
  await assert.rejects(processMediaImage(tooWide,{contentType:'image/png',purpose:'profile'}), /media.imageDimensions/);
  const tooManyPixels = await sharp({create:{width:4100,height:4100,channels:3,background:'white'}}).png().toBuffer();
  await assert.rejects(processMediaImage(tooManyPixels,{contentType:'image/png',purpose:'profile'}), /media.invalidImage/);
});

test('wide and tall accepted sources preserve a recroppable master through maximum supported crop zoom',async()=>{
  for(const [width,height] of [[8192,64],[64,8192],[8192,65],[65,8192]]) {
    const source=await sharp({create:{width,height,channels:3,background:'#096b75'}}).png().toBuffer();
    for(const purpose of ['profile','logo','cover','gallery']) {
      const original=await processMediaImage(source,{contentType:'image/png',purpose});
      const master=original.variants.find(v=>v.role==='master');
      assert(master.width>=64&&master.height>=64);
      assert(master.width<=width&&master.height<=height);
      assert(Math.max(master.width,master.height)<=MEDIA_LIMITS.dimension);
      const recropped=await processSanitisedMaster(master.bytes,{purpose,crop:{zoom:maxCropZoom(master.width,master.height,purpose),x:0,y:100}});
      assert.equal(recropped.variants.length,3);
      assert(recropped.sourceWidth>=64&&recropped.sourceHeight>=64);
      assert(recropped.variants.filter(v=>v.role!=='master').every(v=>v.width<=2560&&v.height<=2560));
    }
  }
});

test('browser crop maximum matches server integer geometry and never clamps invalid requests silently',()=>{
  for(const width of [64,65,100,2560,8192])for(const height of [64,65,100,2560,8192]) {
    if(width*height>MEDIA_LIMITS.pixels)continue;
    for(const purpose of ['profile','logo','cover','gallery']) {
      const zoom=maxCropZoom(width,height,purpose);
      assert(zoom>=1&&zoom<=4);assert.equal(Math.round(zoom*100),zoom*100);
      const crop=mediaCrop(width,height,purpose,{zoom,x:100,y:100});
      assert(crop.width>=16&&crop.height>=16);
      assert(crop.left+crop.width<=width&&crop.top+crop.height<=height);
    }
  }
  assert.equal(maxCropZoom(64,8192,'cover'),1.6);
  assert.equal(maxCropZoom(8192,64,'gallery'),3.87);
  assert.throws(()=>mediaCrop(64,8192,'cover',{zoom:4,x:50,y:50}),/media.invalidCrop/);
});
