import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {connect,fingerprint} from './membership-migration-support.mjs';
import {verifySchoolLocationsSpots} from './verify-school-locations-spots.mjs';

const [environment,action='--audit',...flags]=process.argv.slice(2);
assert(['rehearsal','staging','production'].includes(environment));
assert(['--audit','--rehearse','--apply'].includes(action));
assert(action!=='--apply'||environment==='rehearsal'||flags.includes(`--${environment}-approved`));
const id='20261111_school_locations_spots';
const client=await connect(environment);
try{
 await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='60s'");
 await client.query('SELECT pg_advisory_xact_lock(20261111)');
 assert.equal((await client.query("SELECT count(*)::int AS n FROM identity_schema_migrations WHERE id='20261111_school_onboarding'")).rows[0].n,1);
 const before=await fingerprint(client);
 const associations=(await client.query('SELECT school_id,spot_id FROM school_operating_spots ORDER BY school_id,spot_id')).rows;
 const legacyPairs=(await client.query("SELECT DISTINCT l.school_id,l.spot_id FROM lessons l JOIN schools s ON s.id=l.school_id WHERE l.deleted_at IS NULL AND l.spot_id IS NOT NULL AND s.workspace_kind='legacy' ORDER BY l.school_id,l.spot_id")).rows;
 const ddl=await fs.readFile(new URL(`../db/migrations/${id}.sql`,import.meta.url),'utf8');
 const checksum=createHash('sha256').update(ddl).digest('hex');
 const prior=(await client.query('SELECT checksum FROM identity_schema_migrations WHERE id=$1',[id])).rows[0];
 if(prior)assert.equal(prior.checksum,checksum,'Installed SQL is immutable');
 if(!prior&&action!=='--audit'){
  await client.query(ddl);await client.query('INSERT INTO identity_schema_migrations(id,checksum) VALUES($1,$2)',[id,checksum]);
 }
 let checks=[];
 if(action!=='--audit'){
  const expected=new Set([...associations,...legacyPairs].map(r=>r.school_id+':'+r.spot_id));
  const actual=new Set((await client.query('SELECT school_id,spot_id FROM school_operating_spots')).rows.map(r=>r.school_id+':'+r.spot_id));
  assert.deepEqual([...actual].sort(),[...expected].sort(),'Association backfill must add only existing legacy lesson pairs');
  await client.query('SAVEPOINT synthetic_location_checks');checks=await verifySchoolLocationsSpots(client);
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');await client.query('ROLLBACK TO SAVEPOINT synthetic_location_checks');
  assert.deepEqual(await fingerprint(client),before,'Existing application data changed');
 }
 await client.query(action==='--apply'?'COMMIT':'ROLLBACK');
 console.log(JSON.stringify({environment,migration:id,action,previouslyInstalled:Boolean(prior),checks,existingDataUnchanged:action!=='--audit',associationBackfill:'legacy lesson pairs only'}));
}catch(error){await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({environment,migration:id,error:error.message,code:error.code}));process.exitCode=1;}
finally{await client.end();}
