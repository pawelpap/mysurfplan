import test from 'node:test';
import assert from 'node:assert/strict';
import {clientNetwork,networkIdentity,loginBuckets,consumeLoginAttempt} from '../lib/login-limits.mjs';
const secret='unit-test-rate-secret-with-at-least-32-bytes';
test('network identity normalises IPv6 /64 and mapped IPv4; forwarding is trusted only on Vercel',()=>{
  assert.equal(networkIdentity('2001:db8::1'),networkIdentity('2001:0db8:0000:0000::ffff'));
  assert.notEqual(networkIdentity('2001:db8:1::1'),networkIdentity('2001:db8:2::1'));
  assert.equal(networkIdentity('::ffff:192.0.2.1'),'192.0.2.1');
  for(const value of ['','not-ip','192.0.2.1, 192.0.2.2']) assert.equal(networkIdentity(value),'unknown');
  const request={socket:{remoteAddress:'127.0.0.1'},headers:{'x-forwarded-for':'192.0.2.99','x-vercel-forwarded-for':'192.0.2.1'}};
  assert.equal(clientNetwork(request,{}),'127.0.0.1');
  assert.equal(clientNetwork(request,{VERCEL:'1'}),'192.0.2.1');
  delete request.headers['x-vercel-forwarded-for'];
  assert.equal(clientNetwork(request,{VERCEL:'1'}),'unknown');
});
test('counter keys are private, normalised and cover network, identifier and pair independently',()=>{
  const a=loginBuckets(' TestStudent ','192.0.2.1',secret),b=loginBuckets('teststudent','192.0.2.1',secret);
  assert.deepEqual(a,b);assert.equal(new Set(a.map(x=>x.key)).size,3);
  for(const x of a) assert.match(x.key,/^[a-f0-9]{64}$/);
  assert.equal(a[1].key,loginBuckets('teststudent','192.0.2.2',secret)[1].key);
  assert.notEqual(a[2].key,loginBuckets('teststudent','192.0.2.2',secret)[2].key);
  assert.equal(a[0].key,loginBuckets('someone-else','192.0.2.1',secret)[0].key);
  assert.throws(()=>loginBuckets('name','ip','short'));
});
test('rate-limit storage failure does not permit a login',async()=>{
  await assert.rejects(consumeLoginAttempt(async()=>[],[]));
  await assert.rejects(consumeLoginAttempt(async()=>{throw new Error('offline');},[]));
});
