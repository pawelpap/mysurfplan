import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { MEDIA_CROP_ASPECTS } from './media-crop-controls.mjs';

export const MEDIA_LIMITS = Object.freeze({
  inputBytes: 3 * 1024 * 1024, pixels: 16000000, dimension: 8192,
  assetBytes: 16 * 1024 * 1024, profileOwnerBytes: 24 * 1024 * 1024,
  schoolOwnerBytes: 160 * 1024 * 1024, pendingPerOwner: 2, galleryImages: 6,
  processingSeconds: 5, masterDimension: 2560,
});
const purposes = Object.freeze({
  profile: { ratio: MEDIA_CROP_ASPECTS.profile, widths: [128, 384] }, logo: { ratio: MEDIA_CROP_ASPECTS.logo, widths: [128, 512] },
  cover: { ratio: MEDIA_CROP_ASPECTS.cover, widths: [800, 1600] }, gallery: { ratio: MEDIA_CROP_ASPECTS.gallery, widths: [600, 1200] },
});
const mimeTypes = Object.freeze({ jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' });
const checksum = buffer => createHash('sha256').update(buffer).digest('hex');
export class MediaInputError extends Error {
  constructor(code = 'media.invalidImage') { super(code); }
}

// Reject unsupported containers before libvips sees them. Re-encoding later
// removes trailers, metadata and any non-image data from permitted containers.
function imageFormat(bytes) {
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'webp';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    // libvips can render only the first APNG frame. Reject the animation rather
    // than silently accepting it as an ordinary still PNG.
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const size = bytes.readUInt32BE(offset);
      if (offset + 12 + size > bytes.length) throw new MediaInputError();
      const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
      if (type === 'acTL') throw new MediaInputError('media.animationUnsupported');
      offset += 12 + size;
      if (type === 'IEND') break;
    }
    return 'png';
  }
  throw new MediaInputError('media.unsupportedFormat');
}

export function mediaCrop(width, height, purpose, controls = { zoom: 1, x: 50, y: 50 }) {
  const config = Object.hasOwn(purposes, purpose) ? purposes[purpose] : null;
  if (!config || !Number.isInteger(width) || !Number.isInteger(height) || width < 64 || height < 64 ||
      !controls || typeof controls !== 'object' || Array.isArray(controls) ||
      Object.keys(controls).some(key => !['zoom','x','y'].includes(key)) ||
      !Number.isFinite(controls.zoom) || controls.zoom < 1 || controls.zoom > 4 ||
      !Number.isFinite(controls.x) || controls.x < 0 || controls.x > 100 ||
      !Number.isFinite(controls.y) || controls.y < 0 || controls.y > 100) throw new MediaInputError('media.invalidCrop');
  const cropWidth = Math.floor(Math.min(width, height * config.ratio) / controls.zoom);
  const cropHeight = Math.floor(cropWidth / config.ratio);
  if (cropWidth < 16 || cropHeight < 16) throw new MediaInputError('media.invalidCrop');
  return { left: Math.round((width - cropWidth) * controls.x / 100),
    top: Math.round((height - cropHeight) * controls.y / 100), width: cropWidth, height: cropHeight };
}

const decoder = bytes => sharp(bytes, { limitInputPixels: MEDIA_LIMITS.pixels, failOn: 'warning' })
  .timeout({ seconds: MEDIA_LIMITS.processingSeconds });

export async function processMediaImage(bytes, options = {}) {
  return processImage(bytes, options, MEDIA_LIMITS.inputBytes);
}

// Only for an authenticated, checksum-verified master read from our private
// journal. External uploads always use processMediaImage's smaller HTTP limit.
export async function processSanitisedMaster(bytes, { purpose, crop } = {}) {
  return processImage(bytes, { contentType: 'image/webp', purpose, crop }, MEDIA_LIMITS.assetBytes);
}

async function processImage(bytes, { contentType, purpose, crop } = {}, inputLimit) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw new MediaInputError();
  if (bytes.length > inputLimit) throw new MediaInputError('media.fileTooLarge');
  if (!Object.hasOwn(purposes, purpose)) throw new MediaInputError();
  const format = imageFormat(bytes);
  if (contentType !== mimeTypes[format]) throw new MediaInputError('media.unsupportedFormat');
  try {
    const metadata = await decoder(bytes).metadata();
    if (metadata.format !== format || (metadata.pages || 1) !== 1) throw new MediaInputError('media.animationUnsupported');
    if (!Number.isInteger(metadata.width) || !Number.isInteger(metadata.height) || metadata.width < 64 || metadata.height < 64 ||
        metadata.width > MEDIA_LIMITS.dimension || metadata.height > MEDIA_LIMITS.dimension ||
        metadata.width * metadata.height > MEDIA_LIMITS.pixels) throw new MediaInputError('media.imageDimensions');
    const oriented = metadata.autoOrient || { width: metadata.width, height: metadata.height };
    // Crop is computed against the oriented input, never EXIF-rotated raw axes.
    const rectangle = mediaCrop(oriented.width, oriented.height, purpose, crop);
    const outputs = [];
    // Keep every accepted source recroppable. Extreme aspect ratios need a
    // longer master to preserve the minimum64-pixel shorter side. The existing
    //8192-axis/16MP/source and16MiB-output limits still apply, without enlargement.
    const masterBound=Math.max(MEDIA_LIMITS.masterDimension,
      Math.ceil(Math.max(oriented.width,oriented.height)*64/Math.min(oriented.width,oriented.height)));
    const master = await decoder(bytes).autoOrient().resize({ width: masterBound,
      height: masterBound, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
    outputs.push({ role: 'master', ...master });
    for (const width of purposes[purpose].widths) {
      const result = await decoder(bytes).autoOrient().extract(rectangle)
        .resize({ width, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer({ resolveWithObject: true });
      outputs.push({ role: `w${width}`, ...result });
    }
    const byteCount = outputs.reduce((total, output) => total + output.data.length, 0);
    if (byteCount > MEDIA_LIMITS.assetBytes) throw new MediaInputError('media.fileTooLarge');
    return { purpose, sourceHash: checksum(bytes), sourceWidth: oriented.width, sourceHeight: oriented.height,
      crop: rectangle, byteCount, variants: outputs.map(output => ({ role: output.role, bytes: output.data,
        byteCount: output.data.length, width: output.info.width, height: output.info.height,
        contentType: 'image/webp', checksum: checksum(output.data) })) };
  } catch (error) {
    // Decoder diagnostics can contain input metadata; expose only stable codes.
    if (error instanceof MediaInputError) throw error;
    throw new MediaInputError();
  }
}
