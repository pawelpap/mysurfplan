import { isUuid } from './school-access.mjs';

export const brandingAccents = Object.freeze({
  sea: { light: '#096B75', dark: '#79DAD2' }, atlantic: { light: '#275D8C', dark: '#9FC9F0' },
  forest: { light: '#30694B', dark: '#9CD9AE' }, clay: { light: '#8A4632', dark: '#F2B49C' },
});
export class BrandingInputError extends Error {
  constructor(code = 'branding.invalid') { super(code); }
}
const invalid = () => { throw new BrandingInputError(); };
function alt(value, required = false) {
  if (typeof value !== 'string' || value.trim().length > 300 || /[\u0000-\u001f\u007f]/.test(value)) invalid();
  const result = value.trim();
  if (required && !result) invalid();
  return result;
}
const optionalAsset = value => value === null ? null : isUuid(value) ? value.toLowerCase() : invalid();
const revision = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;

export function brandingInput(body, operation = 'save') {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !isUuid(body.schoolId) ||
      !revision(body.revision) || !revision(body.settingsRevision)) invalid();
  const scope = { schoolId: body.schoolId.toLowerCase(), revision: body.revision, settingsRevision: body.settingsRevision };
  if (operation === 'publish') {
    if (Object.keys(body).some(key => !['schoolId','revision','settingsRevision','requestId'].includes(key)) || !isUuid(body.requestId)) invalid();
    return { ...scope, requestId: body.requestId.toLowerCase() };
  }
  if (Object.keys(body).some(key => !['schoolId','revision','settingsRevision','accent','logoAssetId','logoAlt','coverAssetId','coverAlt','gallery'].includes(key)) ||
      !Object.hasOwn(brandingAccents, body.accent) || !Array.isArray(body.gallery) || body.gallery.length > 6) invalid();
  const logoAssetId = optionalAsset(body.logoAssetId), coverAssetId = optionalAsset(body.coverAssetId);
  const gallery = body.gallery.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        Object.keys(item).some(key => !['assetId','alt'].includes(key)) || !isUuid(item.assetId)) invalid();
    return { assetId: item.assetId.toLowerCase(), alt: alt(item.alt, true) };
  });
  if (new Set(gallery.map(item => item.assetId)).size !== gallery.length) invalid();
  return { ...scope, details: { accent: body.accent, logoAssetId, logoAlt: alt(body.logoAlt, Boolean(logoAssetId)),
    coverAssetId, coverAlt: alt(body.coverAlt, Boolean(coverAssetId)), gallery } };
}

export function publicMediaUrl(object) {
  if (!object || object.access !== 'public' || object.state !== 'written' ||
      !/^store_[a-z0-9]+$/i.test(object.store_id) || typeof object.pathname !== 'string' ||
      !/^[a-z0-9/_-]+\.webp$/i.test(object.pathname) || object.pathname.includes('..')) throw new BrandingInputError('branding.unavailable');
  return `https://${object.store_id.slice(6).toLowerCase()}.public.blob.vercel-storage.com/${object.pathname}`;
}
