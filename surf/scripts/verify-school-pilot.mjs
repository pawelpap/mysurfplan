import assert from'node:assert/strict';import{randomUUID,createHash}from'node:crypto';
export async function verifySchoolPilot(client,{returnFixture=false}={}){
 const checks=[],prefix='b5-pilot-'+randomUUID(),hash=createHash('sha256').update('Synthetic non-binding legal test').digest('hex');
 const value=async(q,p=[])=>Object.values((await client.query(q,p)).rows[0])[0];
 const denied=async(q,p,code)=>{await client.query('SAVEPOINT pilot_denial');try{await client.query(q,p);assert.fail('Expected denial');}catch(e){assert.equal(e.code,code,e.message);}finally{await client.query('ROLLBACK TO SAVEPOINT pilot_denial');}};
 const person=async label=>value("INSERT INTO users(name,email,role,email_verified_at,password_hash,auth_version)VALUES($1,$2,'student',now(),$3,1)RETURNING id",[label,prefix+label+'@example.invalid','synthetic-'+label]);
 const owner=await person('owner'),platform=await person('platform'),other=await person('other');
 await client.query('INSERT INTO platform_role_assignments(user_id)VALUES($1)',[platform]);
 const sessionHash=createHash('sha256').update(randomUUID()).digest('hex');
 await client.query("INSERT INTO auth_sessions(token_hash,user_id,auth_version,expires_at)VALUES($1,$2,1,now()+interval '1 hour')",[sessionHash,platform]);
 const spot=await value('SELECT id FROM surf_spots WHERE active ORDER BY id LIMIT 1');
 const settings={name:prefix,description:'Pilot description',timezone:'Europe/Lisbon',contactEmail:'school@example.invalid',contactPhone:'',website:'',socialLinks:[],operatingSpotIds:[spot]};
 const school=(await value('SELECT create_draft_school($1,$2,$3)',[owner,randomUUID(),settings])).data.id;
 const membership=await value('SELECT owner_membership_id FROM schools WHERE id=$1',[school]);
 const environment=await value('SELECT environment FROM job_environment WHERE singleton');
 for(const id of['mywaveplan.privacy','mywaveplan.school-processing'])for(const language of['en-GB','pt-PT','es','fr'])await client.query(`INSERT INTO legal_documents(document_id,version,language,kind,title,content,content_hash,status,environment,effective_at,reviewed_at)
 VALUES($1,$2,$3,$4,'Synthetic test only','Synthetic non-binding legal test',$5,'published',$6,now()-interval '1 minute',now())`,[id,prefix,language,id==='mywaveplan.privacy'?'privacy_notice':'school_processing',hash,environment]);
 await client.query('UPDATE school_onboarding_policy SET ready=true,required_agreement_version=$1,required_privacy_version=$1',[prefix]);
 const approve='SELECT approve_school_pilot($1,$2,1,$3,$4,$5,1,$6)';
 const args=(evidence,request=randomUUID())=>[platform,school,evidence,request,'synthetic-platform',sessionHash];
 await denied(approve,args(randomUUID()),'23514');
 const acceptance=await value(`INSERT INTO legal_acceptances(user_id,document_id,version,language,content_hash,kind,school_id,membership_id)
 VALUES($1,'mywaveplan.school-processing',$2,'en-GB',$3,'school_processing',$4,$5)RETURNING id`,[owner,prefix,hash,school,membership]);
 await denied(approve,[other,school,acceptance,randomUUID(),'synthetic-other',sessionHash],'42501');
 await denied(approve,[platform,school,acceptance,randomUUID(),'changed-password',sessionHash],'42501');
 await denied(approve,[platform,school,acceptance,randomUUID(),'synthetic-platform','0'.repeat(64)],'42501');
 await client.query('SAVEPOINT owner_cannot_approve');await client.query('INSERT INTO platform_role_assignments(user_id)VALUES($1)',[owner]);
 await denied(approve,[owner,school,acceptance,randomUUID(),'synthetic-owner',sessionHash],'42501');await client.query('ROLLBACK TO SAVEPOINT owner_cannot_approve');
 checks.push('no self-approval or forged actor/session/password proof; exact owner agreement required');
 for(const id of['mywaveplan.privacy','mywaveplan.school-processing']){
  await client.query('SAVEPOINT missing_locale');await client.query("DELETE FROM legal_documents WHERE document_id=$1 AND version=$2 AND language='fr'",[id,prefix]);
  await denied(approve,args(acceptance),'23514');await client.query('ROLLBACK TO SAVEPOINT missing_locale');
 }
 await client.query('SAVEPOINT owner_inactive');await client.query("UPDATE school_memberships SET status='suspended' WHERE id=$1",[membership]);
 await denied(approve,args(acceptance),'42501');await client.query('ROLLBACK TO SAVEPOINT owner_inactive');
 await client.query('SAVEPOINT missing_details');await client.query("UPDATE schools SET description='' WHERE id=$1",[school]);
 await denied(approve,args(acceptance),'23514');await client.query('ROLLBACK TO SAVEPOINT missing_details');
 checks.push('each translated document gate, current owner status and complete saved details independently enforced');
 if(returnFixture)return{checks,fixture:{users:[owner,platform,other],owner,platform,school,acceptance,sessionHash,version:prefix}};
 const before=await value('SELECT count(*)::int FROM legal_acceptances');const request=randomUUID();
 const result=await value(approve,args(acceptance,request));assert(result.approvalId);assert.equal(result.school.workspaceStatus,'active');assert.equal(result.school.pilotAccessStatus,'approved');assert.equal(result.school.listingStatus,'unlisted');
 assert.equal(await value('SELECT school_is_operational(s)FROM schools s WHERE id=$1',[school]),true);
 assert.equal(await value('SELECT account_manages_school($1,$2)',[owner,school]),true);
 assert.equal(await value('SELECT count(*)::int FROM membership_roles WHERE membership_id=$1',[membership]),0);
 assert.equal(await value('SELECT count(*)::int FROM legal_acceptances'),before);
 const replay=await value(approve,args(acceptance,request));assert.equal(replay.approvalId,result.approvalId);assert.equal(replay.replayed,true);
 assert.equal(await value('SELECT count(*)::int FROM school_pilot_approvals WHERE school_id=$1',[school]),1);
 checks.push('approval binds evidence, activates only operational access, preserves unlisted state and replays without extra grants/evidence');
 return checks;
}
