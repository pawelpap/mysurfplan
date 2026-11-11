import assert from 'node:assert/strict';
import {connect,fingerprint} from './membership-migration-support.mjs';
import {verifyTaskMediaCleanup} from './verify-task-media-cleanup.mjs';
assert(process.argv.length===2,'Rehearsal rollback only; no live environment override');
const client=await connect('rehearsal');
try{await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='60s'");
 await client.query('SELECT pg_advisory_xact_lock(20261111)');const before=await fingerprint(client);
 const checks=await verifyTaskMediaCleanup(client);await client.query('ROLLBACK');assert.deepEqual(await fingerprint(client),before);
 console.log(JSON.stringify({environment:'rehearsal',checks,rolledBack:true,existingDataUnchanged:true,realStorageRequests:0}));
}catch(error){await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({error:error.message,code:error.code,where:error.where}));process.exitCode=1;}
finally{await client.end();}
