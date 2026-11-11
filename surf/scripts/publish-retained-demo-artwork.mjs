import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {randomUUID} from 'node:crypto';
import {connect} from './membership-migration-support.mjs';
import {publishRetainedDemoArtwork} from './demo-artwork-publication-support.mjs';

const{values,positionals}=parseArgs({allowPositionals:true,options:{
 'operator-id':{type:'string'},'operator-email':{type:'string'},'qa-user-ids':{type:'string'},'request-id':{type:'string'},
 'expected-preview-hash':{type:'string'},'receipt':{type:'string'},'apply':{type:'boolean'},'rehearse':{type:'boolean'},
 'staging-approved':{type:'boolean'},'production-approved':{type:'boolean'},
}});
const[environment]=positionals;
assert(positionals.length===1&&['rehearsal','staging','production'].includes(environment),'Specify rehearsal, staging or production');
assert(!(values.apply&&values.rehearse),'Choose apply or rehearsal');
assert(values['operator-id']&&values['operator-email']&&values['qa-user-ids']!==undefined&&values.receipt,
 'Supply the independently verified operator ID/email, exact QA exclusion IDs, and a new private receipt path');
const apply=Boolean(values.apply);
assert(!apply||environment==='rehearsal'||values[`${environment}-approved`],'Explicit environment release approval required');
assert(!apply||(values['request-id']&&values['expected-preview-hash']),'Apply requires the recorded request UUID and reviewed preview hash');
const options={environment,operatorId:values['operator-id'],expectedOperatorEmail:values['operator-email'],
 qaUserIds:values['qa-user-ids']?values['qa-user-ids'].split(','):[],requestId:values['request-id']||randomUUID(),
 expectedPreviewHash:values['expected-preview-hash'],rehearse:!apply};
const client=await connect(environment);
let transactionOutcome='not_started';
try{
 await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='60s'");
 transactionOutcome='open';
 await client.query('SELECT pg_advisory_xact_lock(20261111)');
 const receipt=await publishRetainedDemoArtwork(client,options);
 // A private review/receipt file must exist before a live commit. Never overwrite
 // earlier audit evidence or report a rollback rehearsal as a live publication.
 const record={...receipt,requestId:options.requestId,action:apply?'apply':'rehearse'};
 await fs.writeFile(values.receipt,JSON.stringify({...record,transactionOutcome:'pending'},null,2),{mode:0o600,flag:'wx'});
 await client.query(apply?'COMMIT':'ROLLBACK');
 transactionOutcome=apply?'committed':'rolled_back';
 await fs.writeFile(values.receipt,JSON.stringify({...record,transactionOutcome},null,2),{mode:0o600});
 console.log(JSON.stringify({environment,action:apply?'apply':'rehearse',schoolId:receipt.schoolId,publicationId:receipt.publicationId,
  replayed:receipt.replayed,previewHash:receipt.previewHash,protectedStateUnchanged:true,receiptPath:values.receipt}));
}catch(error){await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({environment,error:error.message,code:error.code,transactionOutcome}));process.exitCode=1;}
finally{await client.end();}
