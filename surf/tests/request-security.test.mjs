import test from 'node:test';
import assert from 'node:assert/strict';
import { mutationAllowed } from '../lib/request-security.mjs';
const env = {NODE_ENV:'production',VERCEL_URL:'specific-deployment.vercel.app'};
const req = (headers={}, method='POST') => ({method,headers:{host:'mywaveplan.com',...headers}});

test('same-origin mutations work; cross-origin, opaque and malformed origins fail closed', () => {
  assert(mutationAllowed(req({origin:'https://mywaveplan.com','sec-fetch-site':'same-origin'}),env));
  for (const origin of ['https://evil.example','https://staging.mywaveplan.com','http://mywaveplan.com','null','https://mywaveplan.com.evil.example','https://mywaveplan.com/path','https://user@mywaveplan.com',['https://mywaveplan.com']])
    assert.equal(mutationAllowed(req({origin,'x-mywaveplan-request':'1'}),env),false,JSON.stringify(origin));
  for (const method of ['POST','PUT','PATCH','DELETE']) {
    assert.equal(mutationAllowed(req({},method),env),false);
    assert(mutationAllowed(req({'x-mywaveplan-request':'1'},method),env));
    assert.equal(mutationAllowed(req({'sec-fetch-site':'cross-site','x-mywaveplan-request':'1'},method),env),false);
    assert.equal(mutationAllowed(req({origin:'https://mywaveplan.com','sec-fetch-site':'same-site'},method),env),false);
  }
});
test('forwarded hosts cannot grant trust, exact preview host is allowed, localhost is development-only', () => {
  assert.equal(mutationAllowed(req({origin:'https://evil.example',host:'evil.example','x-forwarded-host':'mywaveplan.com'}),env),false);
  assert(mutationAllowed(req({host:env.VERCEL_URL,origin:'https://'+env.VERCEL_URL}),env));
  assert.equal(mutationAllowed(req({host:'other.vercel.app',origin:'https://other.vercel.app'}),env),false);
  const local=req({host:'localhost:3000',origin:'http://localhost:3000'});
  assert.equal(mutationAllowed(local,env),false);
  assert(mutationAllowed(local,{NODE_ENV:'development'}));
  for (const method of ['GET','HEAD','OPTIONS']) assert(mutationAllowed(req({},method),env));
});
