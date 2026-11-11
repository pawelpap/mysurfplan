import assert from 'node:assert/strict';
import test from 'node:test';
import { geocodingInput, geocodingResults, lookupSchoolAddress, GEOCODING_LIMITS } from '../lib/school-geocoding.mjs';
import { schoolGeocodingHandler } from '../lib/school-geocoding-server.mjs';

const schoolId = '12345678-1234-4123-8123-123456789012';
const userId = '22345678-1234-4123-8123-123456789012';
const body = { schoolId, address: 'Lisbon, Portugal', language: 'pt-PT' };
const key = 'a'.repeat(32);
const valid = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-9.139, 38.722] },
  properties: { formatted: 'Lisboa, Portugal', datasource: { url: 'https://evil.invalid/' }, privateProperty: 'never returned' } }] };
const reply = () => ({ headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; },
  status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } });

test('lookup input accepts four languages and rejects forged scope, control characters and oversized addresses', () => {
  for (const [language, expected] of [['en-GB', 'en'], ['pt-PT', 'pt'], ['es', 'es'], ['fr', 'fr']])
    assert.equal(geocodingInput({ ...body, language }).language, expected);
  assert.equal(geocodingInput({ ...body, address: '  Lisboa  ' }).address, 'Lisboa');
  for (const change of [{ language: 'de' }, { language: '__proto__' }, { schoolId: 'bad' }, { address: 'ab' },
    { address: 'x'.repeat(401) }, { address: 'abc\nprivate' }, { providerUrl: 'https://evil.invalid' }, { actorId: userId }])
    assert.throws(() => geocodingInput({ ...body, ...change }), e => e.status === 400);
});

test('provider results are bounded coordinate/address projections with fixed safe attribution', () => {
  const result = geocodingResults({ ...valid, features: [valid.features[0], valid.features[0],
    { ...valid.features[0], geometry: { type: 'Point', coordinates: [Infinity, 42] } },
    { ...valid.features[0], geometry: { type: 'Point', coordinates: [20, 91] } },
    { ...valid.features[0], properties: { formatted: 'bad\u0000label' } }] });
  assert.deepEqual(result.results, [{ address: 'Lisboa, Portugal', longitude: -9.139, latitude: 38.722 }]);
  assert.equal(result.attribution.length, 2);
  assert.doesNotMatch(JSON.stringify(result), /evil|privateProperty|never returned/);
  assert.deepEqual(geocodingResults({ type: 'FeatureCollection', features: [] }).results, []);
  assert.throws(() => geocodingResults({ results: valid.features }));
});

test('server lookup uses only fixed EU destination, safe parameters and headers without client metadata', async () => {
  let captured;
  const result = await lookupSchoolAddress(geocodingInput(body), { key, fetchImpl: async (url, options) => {
    captured = { url: new URL(url), options };
    return new Response(JSON.stringify(valid), { headers: { 'content-type': 'application/json' } });
  } });
  assert.equal(captured.url.origin, 'https://api-eu.geoapify.com');
  assert.equal(captured.url.pathname, '/v1/geocode/search');
  assert.deepEqual([...captured.url.searchParams.keys()], ['text', 'lang', 'limit', 'apiKey']);
  assert.equal(captured.url.searchParams.get('lang'), 'pt');
  assert.equal(captured.options.redirect, 'error');
  assert.equal(captured.options.cache, 'no-store');
  assert.deepEqual(captured.options.headers, { Accept: 'application/json' });
  assert.equal(result.results.length, 1);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(key));
});

test('provider failures never expose key, address or upstream details and bounded streams reject oversized replies', async () => {
  const failure = async fetchImpl => assert.rejects(lookupSchoolAddress(geocodingInput(body), { key, fetchImpl }),
    e => e.message === 'schoolLocation.lookupUnavailable' && !e.stack.includes(key));
  await failure(async () => { throw new Error(`${key} ${body.address} upstream diagnostic`); });
  await failure(async () => new Response('private error', { status: 429 }));
  await failure(async () => new Response(JSON.stringify(valid), { headers: { 'content-type': 'text/html' } }));
  await failure(async () => new Response('invalid json', { headers: { 'content-type': 'application/json' } }));
  await failure(async () => new Response('x', { headers: { 'content-type': 'application/json', 'content-length': String(GEOCODING_LIMITS.responseBytes + 1) } }));
  await failure(async () => new Response('x'.repeat(GEOCODING_LIMITS.responseBytes + 1), { headers: { 'content-type': 'application/json' } }));
});

test('API makes no provider request before authentication, school authority, legal policy and durable budget', async () => {
  let calls = 0, sqlCalls = 0;
  let session = null, decision = { allowed: false, reason: 'not_ready' }, dbError;
  const env = { APP_ENVIRONMENT: 'staging', GEOAPIFY_API_KEY: key };
  const handler = schoolGeocodingHandler({ env, requireAuth: async (_, res) => {
    if (!session) { res.status(401).json({ ok: false }); return null; } return session;
  }, sql: async (_, ...args) => {
    sqlCalls++; assert.deepEqual(args, [userId, schoolId, 'staging']);
    if (dbError) throw dbError; return [{ result: decision }];
  }, lookup: async () => { calls++; return { results: [] }; } });
  async function request(method = 'POST', input = body) {
    const res = reply(); await handler({ method, body: input }, res);
    assert.equal(res.headers['Cache-Control'], 'private, no-store'); return res;
  }
  assert.equal((await request('GET')).statusCode, 405);
  assert.equal((await request()).statusCode, 401);
  session = { userId, demo: true }; assert.equal((await request()).statusCode, 403);
  session = { userId }; assert.equal((await request('POST', { ...body, language: 'de' })).statusCode, 400);
  assert.equal(sqlCalls, 0);
  assert.equal((await request()).statusCode, 409);
  decision = { allowed: false, reason: 'limited' };
  const limited = await request(); assert.equal(limited.statusCode, 429); assert.equal(limited.headers['Retry-After'], '60');
  dbError = { code: '42501', message: 'private database details' }; assert.equal((await request()).statusCode, 403);
  dbError = { code: '40P01' }; assert.equal((await request()).statusCode, 409);
  assert.equal(calls, 0);
  dbError = null; decision = { allowed: true };
  assert.equal((await request()).statusCode, 200); assert.equal(calls, 1);
  env.GEOAPIFY_API_KEY = ''; assert.equal((await request()).statusCode, 503); assert.equal(calls, 1);
});
