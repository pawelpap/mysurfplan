import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {connect,fingerprint} from './membership-migration-support.mjs';
import {verifyMediaSafety} from './verify-media-safety.mjs';

const[environment,action='--audit',...flags]=process.argv.slice(2);
assert(['rehearsal','staging','production'].includes(environment));assert(['--audit','--rehearse','--apply'].includes(action));
assert(action!=='--apply'||environment==='rehearsal'||flags.includes(`--${environment}-approved`));
const id='20261111_media_safety',client=await connect(environment);
try{
 await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='60s'");
 await client.query('SELECT pg_advisory_xact_lock(20261111)');
 assert.equal((await client.query("SELECT count(*)::int AS n FROM identity_schema_migrations WHERE id='20261111_school_media'")).rows[0].n,1);
 const before=await fingerprint(client);const ddl=await fs.readFile(new URL(`../db/migrations/${id}.sql`,import.meta.url),'utf8');
 const checksum=createHash('sha256').update(ddl).digest('hex');
 const prior=(await client.query('SELECT checksum FROM identity_schema_migrations WHERE id=$1',[id])).rows[0];
 if(prior)assert.equal(prior.checksum,checksum,'Installed migration is immutable');
 if(!prior&&action!=='--audit'){await client.query(ddl);await client.query('INSERT INTO identity_schema_migrations(id,checksum) VALUES($1,$2)',[id,checksum]);}
 let checks=[];if(action!=='--audit'){await client.query('SAVEPOINT wide_media_fixtures');checks=await verifyMediaSafety(client);
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');await client.query('ROLLBACK TO SAVEPOINT wide_media_fixtures');assert.deepEqual(await fingerprint(client),before);}
 await client.query(action==='--apply'?'COMMIT':'ROLLBACK');
 console.log(JSON.stringify({environment,migration:id,action,previouslyInstalled:Boolean(prior),checks,existingDataUnchanged:action!=='--audit'}));
}catch(error){await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({environment,migration:id,error:error.message,code:error.code,where:error.where}));process.exitCode=1;}
finally{await client.end();}
