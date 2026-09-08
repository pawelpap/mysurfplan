// Run only against an isolated rehearsal branch, never a live app database.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import {loginBuckets,consumeLoginAttempt} from '../lib/login-limits.mjs';
if (!process.argv[2] || process.argv[3] !== '--isolated-rehearsal') throw new Error('Private connection file and --isolated-rehearsal required');
const pool=new pg.Pool({connectionString:(await fs.readFile(process.argv[2],'utf8')).trim().replace('sslmode=require','sslmode=verify-full'),max:10});
const sql=async(strings,...values)=>(await pool.query(strings.reduce((q,s,i)=>q+(i?'$'+i:'')+s,''),values)).rows;
const secret=crypto.randomBytes(40).toString('hex'),keys=new Set();
const buckets=(id,ip)=>{const b=loginBuckets(id,ip,secret);b.forEach(x=>keys.add(x.key));return b;};
let passed=0;
const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
try {
 const fingerprint=async()=>(await pool.query("SELECT md5(string_agg(row_to_json(u)::text,',' ORDER BY id)) AS hash FROM users u")).rows[0].hash;
 const before=await fingerprint();
 const migration=await fs.readFile(new URL('../db/migrations/20260908_login_limits.sql',import.meta.url),'utf8');
 await pool.query(migration);await pool.query(migration);
 await check('migration is repeatable and preserves users',async()=>assert.equal(await fingerprint(),before));
 const pair=buckets('parallel','192.0.2.1').slice(1);
 await check('20 concurrent requests admit exactly 10 for the same identifier/network',async()=>{
   const results=await Promise.all(Array.from({length:20},()=>consumeLoginAttempt(sql,pair)));
   assert.equal(results.filter(x=>x.allowed).length,10);
   assert(results.filter(x=>!x.allowed).every(x=>x.retrySeconds>0&&x.retrySeconds<=900));
 });
 await check('blocked attempts do not extend the window',async()=>{
   const expiry=(await pool.query('SELECT expires_at FROM auth_login_limits WHERE key=$1',[pair[1].key])).rows[0].expires_at.getTime();
   assert.equal((await consumeLoginAttempt(sql,pair)).allowed,false);
   assert.equal((await pool.query('SELECT expires_at FROM auth_login_limits WHERE key=$1',[pair[1].key])).rows[0].expires_at.getTime(),expiry);
 });
 await check('expiry permits another attempt and resets the counter',async()=>{
   await pool.query("UPDATE auth_login_limits SET expires_at=now()-interval '1 second' WHERE key=ANY($1::text[])",[pair.map(x=>x.key)]);
   assert.equal((await consumeLoginAttempt(sql,pair)).allowed,true);
   assert((await pool.query('SELECT attempts FROM auth_login_limits WHERE key=ANY($1::text[])',[pair.map(x=>x.key)])).rows.every(x=>x.attempts===1));
 });
 await check('identifier limit applies across 41 independent networks',async()=>{
   const results=await Promise.all(Array.from({length:41},(_,i)=>consumeLoginAttempt(sql,buckets('distributed',`192.0.2.${i+1}`).slice(1))));
   assert.equal(results.filter(x=>x.allowed).length,40);
 });
 await check('network limit applies across 81 different identifiers',async()=>{
   const results=await Promise.all(Array.from({length:81},(_,i)=>consumeLoginAttempt(sql,buckets(`guess-${i}`,'198.51.100.1').slice(0,1))));
   assert.equal(results.filter(x=>x.allowed).length,80);
 });
 await check('cleanup cannot delete the current expired bucket while resetting it',async()=>{
   const old=buckets('old','203.0.113.1');await consumeLoginAttempt(sql,old);
   await pool.query("UPDATE auth_login_limits SET expires_at=now()-interval '25 hours' WHERE key=ANY($1::text[])",[old.map(x=>x.key)]);
   assert.equal((await consumeLoginAttempt(sql,old)).allowed,true);
   assert.equal((await pool.query('SELECT * FROM auth_login_limits WHERE key=ANY($1::text[])',[old.map(x=>x.key)])).rowCount,3);
 });
 assert.equal(await fingerprint(),before);
 console.log(JSON.stringify({passed,userDataUnchanged:true}));
} finally {
 await pool.query('DELETE FROM auth_login_limits WHERE key=ANY($1::text[])',[[...keys]]);
 await pool.end();
}
