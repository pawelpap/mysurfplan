import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
process.env.SESSION_SECRET='handler-test-secret-with-at-least-32-bytes';
let user, passwordCalls, queries, blocked, storageFails, sessions;
const reset=()=>{user=null;passwordCalls=[];queries=[];blocked=false;storageFails=false;sessions=0;};
reset();
globalThis.__loginSql=async(strings,...values)=>{
 const query=strings.join('?');queries.push(query);
 if(query.includes('auth_login_limits')) {if(storageFails)throw new Error('private storage error');return[{allowed:!blocked,retry_seconds:123}];}
 if(query.includes('FROM users')) return user?[user]:[];
 return [];
};
globalThis.__loginAuth={normalizeEmail:v=>typeof v==='string'?v.trim().toLowerCase():'',
 verifyPassword:async(p,h)=>{passwordCalls.push(h);return p==='correct';},
 setUserAuthSession:async(res,u)=>{sessions++;res.setHeader('Set-Cookie','test-cookie');return{userId:u.id};}};
const source=(await fs.readFile(new URL('../pages/api/auth/login.js',import.meta.url),'utf8'))
 .replace('import { sql } from "../../../lib/db";','const sql=globalThis.__loginSql;')
 .replace(/import \{\s*normalizeEmail,\s*setUserAuthSession,\s*verifyPassword,\s*\} from "\.\.\/\.\.\/\.\.\/lib\/auth";/,'const {normalizeEmail,setUserAuthSession,verifyPassword}=globalThis.__loginAuth;')
 .replaceAll('"../../../lib/request-security.mjs"',JSON.stringify(new URL('../lib/request-security.mjs',import.meta.url).href))
 .replaceAll('"../../../lib/login-limits.mjs"',JSON.stringify(new URL('../lib/login-limits.mjs',import.meta.url).href));
const {default:handler}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const call=async(body={email:'teststudent',password:'wrong'},headers={'x-mywaveplan-request':'1'})=>{
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};
 await handler({method:'POST',headers,body,socket:{remoteAddress:'192.0.2.1'}},res);return res;
};
test('nonexistent and incorrect-password logins have identical errors and both verify a password',async()=>{
 reset();const missing=await call();assert.equal(passwordCalls.length,1);assert.match(passwordCalls[0],/^msp-scrypt-v1\$16384\$8\$1\$/);
 user={id:'known',password_hash:'stored-password-hash'};
 const known=await call();assert.equal(passwordCalls.length,2);assert.equal(passwordCalls[1],'stored-password-hash');
 assert.equal(missing.statusCode,401);assert.deepEqual(known.body,missing.body);assert.equal(sessions,0);
 assert(queries.some(q=>q.includes('u.disabled_at IS NULL')&&q.includes('u.deleted_at IS NULL')));
});
test('a successful dummy verification can never create a missing-account session',async()=>{
 reset();assert.equal((await call({email:'missing',password:'correct'})).statusCode,401);assert.equal(sessions,0);
 user={id:'existing',password_hash:'stored-password-hash'};const good=await call({email:'teststudent',password:'correct'});
 assert.equal(good.statusCode,200);assert.equal(sessions,1);assert(good.headers['Set-Cookie']);
});
test('network limits run before account lookup, password work or creation of identifier counters',async()=>{
 reset();blocked=true;const denied=await call();assert.equal(denied.statusCode,429);assert.equal(denied.headers['Retry-After'],'123');
 assert.equal(queries.length,1);assert.equal(passwordCalls.length,0);assert.equal(sessions,0);
});
test('unverified requests and database outages fail closed with safe errors',async()=>{
 reset();assert.equal((await call(undefined,{})).statusCode,403);assert.equal(queries.length,0);
 storageFails=true;const unavailable=await call();assert.equal(unavailable.statusCode,503);
 assert.doesNotMatch(JSON.stringify(unavailable.body),/private storage error/);assert.equal(sessions,0);
});
