import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { createLegalStore } from '../lib/legal/store.mjs';
import { validateLegalAction,preferenceVersion } from '../lib/legal/contracts.mjs';

export async function verifyLegalSchema(client) {
  const tag = async (strings,...values) => (await client.query(strings.reduce((s,v,i)=>s+v+(i<values.length?'$'+(i+1):''),''),values)).rows;
  const store = createLegalStore(tag),userId=randomUUID(),otherId=randomUUID(),schoolId=randomUUID(),membershipId=randomUUID();
  await client.query(`INSERT INTO users(id,name,email,role) VALUES($1,'Synthetic legal fixture',$2,'student'),($3,'Other legal fixture',$4,'student')`,[userId,`${userId}@example.invalid`,otherId,`${otherId}@example.invalid`]);
  await client.query(`INSERT INTO schools(id,name,workspace_status) VALUES($1,$2,'active')`,[schoolId,'Synthetic legal '+schoolId]);
  await client.query(`INSERT INTO school_memberships(id,user_id,school_id,status) VALUES($1,$2,$3,'active')`,[membershipId,userId,schoolId]);
  await client.query(`INSERT INTO membership_roles(membership_id,role) VALUES($1,'school_admin')`,[membershipId]);
  const session={userId,role:'student',schools:[{id:schoolId,membershipId,status:'active',open:true,roles:['school_admin']}]};
  const checks=[];
  for (const [id,kind] of [['mywaveplan.adult-pilot-terms','terms'],['mywaveplan.privacy','privacy_notice'],['mywaveplan.school-processing','school_processing']]) {
    const content='Synthetic fixture '+kind,hash=createHash('sha256').update(content).digest('hex');
    await client.query(`INSERT INTO legal_documents(document_id,version,language,kind,title,content,content_hash,status,environment,effective_at,reviewed_at)
      VALUES($1,'synthetic-1','en-GB',$2,$2,$3,$4,'published',(SELECT environment FROM job_environment),now(),now())`,[id,kind,content,hash]);
    const document=await store.document(id,{version:'synthetic-1'});
    const body={action:kind==='terms'?'accept_terms':kind==='privacy_notice'?'notice_delivery':'accept_school',documentId:id,version:document.version,language:document.language,contentHash:hash,accepted:true,...(kind==='school_processing'?{schoolId,authorisedRepresentative:true}:{})};
    const action=validateLegalAction(body,session,document);
    await store.record(action);await store.record(action);
    checks.push(kind+' exact version/language and idempotence');
    assert.throws(()=>validateLegalAction({...body,language:'pt-PT'},session,document),{statusCode:409});
  }
  let records=await store.records(userId);
  assert.equal(records.acceptances.length,2);assert.equal(records.notices.length,1);
  assert.equal((await store.records(otherId)).acceptances.length,0);
  assert.equal((await store.records(otherId)).notices.length,0);
  checks.push('notice, agreement, optional preference and other-account separation');
  await store.record(validateLegalAction({action:'optional_preference',purpose:'analytics',selected:false,version:preferenceVersion,language:'en-GB'},session));
  records=await store.records(userId);assert.equal(records.preferences.analytics,false);
  assert.equal(records.acceptances.length,2);assert.equal(records.notices.length,1);
  checks.push('withdrawal cannot change agreement or notice evidence');
  // Change authority after the server check. The insert must check the DB again.
  await client.query('UPDATE membership_roles SET revoked_at=now() WHERE membership_id=$1',[membershipId]);
  const schoolDoc=await store.document('mywaveplan.school-processing',{version:'synthetic-1'});
  await client.query('SAVEPOINT race_fixture');
  await client.query('DELETE FROM legal_acceptances WHERE school_id=$1',[schoolId]);
  await assert.rejects(store.record({action:'accept_school',userId,documentId:schoolDoc.document_id,version:schoolDoc.version,language:schoolDoc.language,contentHash:schoolDoc.content_hash,schoolId,membershipId}),{statusCode:409});
  await client.query('ROLLBACK TO SAVEPOINT race_fixture');
  checks.push('revoked school authority checked at write');
  for (const query of ["UPDATE legal_documents SET content='changed' WHERE version='synthetic-1'", "INSERT INTO optional_preference_events(user_id,purpose,selected,version,language) VALUES($1,'analytics',true,'optional-preferences/1','en-GB')"]) {
    await client.query('SAVEPOINT rejected_write');
    await assert.rejects(client.query(query,query.includes('$1')?[userId]:[]));
    await client.query('ROLLBACK TO SAVEPOINT rejected_write');
  }
  checks.push('immutable document and disabled-purpose database constraints');
  return checks;
}
