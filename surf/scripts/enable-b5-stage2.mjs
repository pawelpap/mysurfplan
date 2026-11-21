import assert from 'node:assert/strict';
import {connect} from './membership-migration-support.mjs';
const [environment,action='--rehearse',...flags]=process.argv.slice(2);
assert(['staging','production'].includes(environment));
assert(['--rehearse','--apply'].includes(action));
assert(environment!=='production'||flags.includes('--production-approved'),'Integrated owner approval is required');
const version=environment==='staging'?'2026-11-11.2-staging-test':'2026-11-11.2';
const client=await connect(environment);
try{
 await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s'");
 assert.equal((await client.query('SELECT environment FROM job_environment WHERE singleton')).rows[0].environment,environment);
 const documents=(await client.query(`SELECT document_id,count(DISTINCT language)::int AS languages FROM legal_documents
 WHERE document_id=ANY($1::text[]) AND version=$2 AND status='published' AND effective_at<=now() AND environment=$3
 AND language=ANY($4::text[]) GROUP BY document_id`,[['mywaveplan.privacy','mywaveplan.school-processing'],version,environment,['en-GB','pt-PT','es','fr']])).rows;
 assert.equal(documents.length,2);assert(documents.every(d=>d.languages===4),'Eight effective translations required');
 // Provider review evidence is recorded in GEOAPIFY_SETUP.md and the separate legal review.
 await client.query('UPDATE school_geocoding_policy SET enabled=true,provider_reviewed_at=COALESCE(provider_reviewed_at,now()),required_agreement_version=$1,required_privacy_version=$1 WHERE singleton',[version]);
 await client.query('UPDATE school_onboarding_policy SET ready=true,required_agreement_version=$1,required_privacy_version=$1 WHERE singleton',[version]);
 assert.equal((await client.query('SELECT school_required_documents_ready() AS ready')).rows[0].ready,true);
 await client.query(action==='--apply'?'COMMIT':'ROLLBACK');
 console.log(JSON.stringify({environment,action,version,translatedDocuments:8,lookupEnabled:action==='--apply',pilotGateReady:action==='--apply',schoolAgreementStillRequired:true}));
}catch(e){await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({environment,error:e.message,code:e.code}));process.exitCode=1;}finally{await client.end();}
