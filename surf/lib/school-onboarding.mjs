import { isUuid } from './school-access.mjs';

const fields = ['name', 'description', 'timezone', 'contactEmail', 'contactPhone', 'website', 'socialLinks', 'operatingSpotIds'];
export class SchoolInputError extends Error {
  constructor(code = 'schoolSetup.invalidInput') { super(code); this.code = code; }
}
function invalid() { throw new SchoolInputError(); }
function text(value, max, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') invalid();
  const result = value.trim();
  if ((required && !result) || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) invalid();
  return result;
}
function webUrl(value) {
  const result = text(value, 2048);
  if (!result) return '';
  let url;
  try { url = new URL(result); } catch { invalid(); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) invalid();
  return url.href;
}
// Full replacement keeps both revision checks and request fingerprints unambiguous.
export function schoolSettingsInput(body, operation) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid();
  const allowed = [...fields, ...(operation === 'create' ? ['requestId'] : ['id', 'revision'])];
  if (Object.keys(body).some(key => !allowed.includes(key))) invalid();
  if (operation === 'create' ? !isUuid(body.requestId) : !isUuid(body.id) || !Number.isSafeInteger(body.revision) || body.revision < 1 || body.revision > 2147483647) invalid();
  const name = text(body.name, 160, true);
  // The current generated slug must contain at least one ASCII letter or number.
  if (!/[a-z0-9]/i.test(name)) invalid();
  const timezone = text(body.timezone, 100, true);
  try { new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format(); } catch { invalid(); }
  const contactEmail = text(body.contactEmail, 254).toLowerCase();
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) invalid();
  const contactPhone = text(body.contactPhone, 40);
  if (contactPhone && !/^\+?[0-9 ()\-./]{3,40}$/.test(contactPhone)) invalid();
  if (body.socialLinks !== undefined && (!Array.isArray(body.socialLinks) || body.socialLinks.length > 5)) invalid();
  const socialLinks = [...new Set((body.socialLinks || []).map(webUrl))].sort();
  if (socialLinks.some(link => !link)) invalid();
  if (body.operatingSpotIds !== undefined && (!Array.isArray(body.operatingSpotIds) || body.operatingSpotIds.length > 30 || body.operatingSpotIds.some(id => !isUuid(id)))) invalid();
  const operatingSpotIds = [...new Set((body.operatingSpotIds || []).map(id => id.toLowerCase()))].sort();
  return {
    name, description: text(body.description, 5000), timezone, contactEmail, contactPhone,
    website: webUrl(body.website), socialLinks, operatingSpotIds,
  };
}
