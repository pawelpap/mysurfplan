// Explicit isolated branch only. node scripts/check-session-concurrency.mjs /private/connection-file
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createSessionStore} from '../lib/auth-store.mjs';
if(!process.argv[2])throw new Error('Supply the isolated branch connection file.');
const connectionString=(await fs.readFile(process.argv[2],'utf8')).trim();
const a=new pg.Client({connectionString}),b=new pg.Client({connectionString});
await a.connect();await b.connect();
const make=c=>createSessionStore(async(parts,...values)=>(await c.query(parts.reduce((s,p,i)=>s+(i?`$${i}`:'')+p,''),values)).rows);
const sa=make(a),sb=make(b);let school,user;
const blocked=async promise=>{let done=false;promise.then(()=>done=true,()=>done=true);await new Promise(r=>setTimeout(r,200));assert.equal(done,false,'Competing operation should wait on user row');};
try{
 await b.query("SET statement_timeout='5s'");
 school=(await a.query("INSERT INTO schools(name) VALUES('Session concurrency check ' || gen_random_uuid()) RETURNING id")).rows[0].id;
 user=(await a.query("INSERT INTO users(school_id,name,email,role,password_hash) VALUES($1,'Concurrency',gen_random_uuid() || '@example.invalid','student','test-hash') RETURNING id",[school])).rows[0].id;
 await a.query('BEGIN');const before=await sa.create(user,'test-hash');
 const revoke=sb.revokeAll(user);await blocked(revoke);await a.query('COMMIT');await revoke;
 assert.equal(await sa.find(before),null);console.log('PASS a concurrent logout invalidates the in-flight login session');
 await a.query('BEGIN');await sa.revokeAll(user);
 const create=sb.create(user,'test-hash');await blocked(create);await a.query('COMMIT');const after=await create;
 assert.equal((await sa.find(after)).id,user);console.log('PASS login serialised after logout uses the new session version');
}finally{
 await a.query('ROLLBACK').catch(()=>{});await b.query('ROLLBACK').catch(()=>{});
 if(user)await a.query("DELETE FROM users WHERE id=$1 AND name='Concurrency'",[user]);
 if(school)await a.query("DELETE FROM schools WHERE id=$1 AND name LIKE 'Session concurrency check %'",[school]);
 await a.end();await b.end();
}
