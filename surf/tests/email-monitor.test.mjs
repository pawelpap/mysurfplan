import test from 'node:test';
import assert from 'node:assert/strict';
import { monitorPingUrl, reportEmailHealth } from '../lib/email/monitor.mjs';

const url = 'https://hc-ping.com/0dbf7488-2e4e-4a44-8a3f-57a3af5c5619';
const config = { environment: 'production', monitorUrl: url, dailyLimit: 20, monthlyLimit: 100 };
const stageUrl = 'https://hc-ping.com/4378803f-520a-4e4e-9dbf-9b8b2ff5c2e5';
test('monitor accepts only the HTTPS Healthchecks UUID endpoint', () => {
  assert.equal(monitorPingUrl(url), url);
  for (const invalid of [url + '/fail', url + '?token=key', url.replace('https:', 'http:'), url.replace('hc-ping.com', 'example.invalid')])
    assert.equal(monitorPingUrl(invalid), null);
});
test('health signals use the configured environment and skip an unconfigured monitor', async () => {
  const sent = [];
  const fetch = async (endpoint, request) => { sent.push([endpoint, request.body]); return { ok: true }; };
  await reportEmailHealth(() => assert.fail('unconfigured monitor queried'), { ...config, environment: 'staging', monitorUrl: null }, fetch);
  await reportEmailHealth(async (_query, values) => {
    assert.deepEqual(values, ['production', 20, 100]);
    return [{ backlog: true, quota: true }];
  }, config, fetch);
  await reportEmailHealth(async () => [{}], config, fetch);
  await reportEmailHealth(async (_query, values) => {
    assert.deepEqual(values, ['staging', 20, 100]);
    return [{}];
  }, { ...config, environment: 'staging', monitorUrl: stageUrl }, fetch);
  assert.deepEqual(sent, [[url + '/fail', 'backlog,quota'], [url, ''], [stageUrl, '']]);
});
