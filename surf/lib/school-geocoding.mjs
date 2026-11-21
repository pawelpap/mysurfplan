import { isUuid } from './school-access.mjs';

export const GEOAPIFY_ENDPOINT = 'https://api-eu.geoapify.com/v1/geocode/search';
export const GEOCODING_LIMITS = Object.freeze({ addressCharacters: 400, results: 5, responseBytes: 524288, timeoutMs: 6000 });
const languages = Object.freeze({ 'en-GB': 'en', 'pt-PT': 'pt', es: 'es', fr: 'fr' });
export class GeocodingError extends Error {
  constructor(code = 'schoolLocation.lookupUnavailable', status = 503) {
    super(code); this.status = status;
  }
}

export function geocodingInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['schoolId', 'address', 'language'].includes(key)) ||
      !isUuid(body.schoolId) || typeof body.address !== 'string' ||
      !Object.hasOwn(languages, body.language)) throw new GeocodingError('schoolLocation.invalidLookup', 400);
  const address = body.address.trim();
  if (address.length < 3 || address.length > GEOCODING_LIMITS.addressCharacters || /[\u0000-\u001f\u007f]/.test(address))
    throw new GeocodingError('schoolLocation.invalidLookup', 400);
  return { schoolId: body.schoolId.toLowerCase(), address, language: languages[body.language] };
}

function label(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 800 && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
}
export function geocodingResults(payload) {
  if (!payload || payload.type !== 'FeatureCollection' || !Array.isArray(payload.features)) throw new GeocodingError();
  const seen = new Set();
  const results = [];
  for (const feature of payload.features.slice(0, GEOCODING_LIMITS.results)) {
    const coordinates = feature?.geometry?.coordinates;
    const address = label(feature?.properties?.formatted);
    if (!address || feature?.geometry?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length !== 2) continue;
    const [longitude, latitude] = coordinates;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) continue;
    const key = JSON.stringify([address, longitude, latitude]);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ address, longitude, latitude });
  }
  // Never return provider-generated URLs, arbitrary properties, query echoes or keys.
  return { results, attribution: [
    { label: 'Powered by Geoapify', url: 'https://www.geoapify.com/' },
    { label: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' },
  ] };
}

export async function lookupSchoolAddress(input, { key, fetchImpl = fetch } = {}) {
  if (typeof key !== 'string' || !/^[a-f0-9]{32}$/i.test(key)) throw new GeocodingError();
  const url = new URL(GEOAPIFY_ENDPOINT);
  url.searchParams.set('text', input.address);
  url.searchParams.set('lang', input.language);
  url.searchParams.set('limit', String(GEOCODING_LIMITS.results));
  url.searchParams.set('apiKey', key);
  let reader;
  try {
    const response = await fetchImpl(url, { method: 'GET', redirect: 'error', cache: 'no-store',
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(GEOCODING_LIMITS.timeoutMs) });
    if (!response.ok || !/^application\/(?:geo\+)?json(?:;|$)/i.test(response.headers.get('content-type') || ''))
      throw new GeocodingError();
    const declared = Number(response.headers.get('content-length'));
    if (declared > GEOCODING_LIMITS.responseBytes) throw new GeocodingError();
    reader = response.body?.getReader();
    if (!reader) throw new GeocodingError();
    const chunks = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > GEOCODING_LIMITS.responseBytes) throw new GeocodingError();
      chunks.push(value);
    }
    return geocodingResults(JSON.parse(Buffer.concat(chunks, size).toString('utf8')));
  } catch {
    // Fetch exceptions may contain the request URL, key and private address.
    throw new GeocodingError();
  } finally {
    await reader?.cancel().catch(() => {});
  }
}
