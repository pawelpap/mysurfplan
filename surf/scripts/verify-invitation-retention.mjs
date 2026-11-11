import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';

// Caller owns the transaction and must roll it back. No independent connection or commit.
export async function verifyInvitationRetention(client) {
 const scalar=async(q,p=[])=>Object.values((await client.query(q,p)).rows[0])[0];
 const school=randomUUID(),person=randomUUID(),job=randomUUID(),old=randomUUID(),current=randomUUID(),recent=randomUUID();
 const hash=()=>createHash('sha256').update(randomUUID()).digest('hex');
 const environment=await scalar('SELECT environment FROM job_environment WHERE singleton');
 await client.query("INSERT INTO schools(id,name,workspace_status) VALUES($1,$2,'active')",[school,`retention-${school}`]);
 await client.query("INSERT INTO users(id,name,email,role) VALUES($1,'Retention fixture',$2,'student')",[person,`${person}@example.invalid`]);
 await client.query(`INSERT INTO job_outbox(id,environment,type,idempotency_key,recipient_hash,payload,created_at,expires_at)
 VALUES($1::uuid,$2,'email.staff_invitation',$1::text,$3,'{}',now()-interval '40 days',now()-interval '33 days')`,[job,environment,hash()]);
 await client.query(`INSERT INTO school_invitations(id,school_id,invited_email,requested_roles,token_hash,created_at,expires_at,
 status,accepted_by_user_id,accepted_at,email_job_id) VALUES($1,$2,$3,ARRAY['coach'], $4,now()-interval '40 days',now()-interval '33 days',
 'accepted',$5,now()-interval '39 days',$6)`,[old,school,`old-${person}@example.invalid`,hash(),person,job]);
 const event=await scalar(`INSERT INTO school_access_events(school_id,actor_id,person_id,invitation_id,action)
 VALUES($1,$2,$2,$3,'invitation_accepted') RETURNING id`,[school,person,old]);
 await client.query(`INSERT INTO school_invitations(id,school_id,invited_email,requested_roles,token_hash,expires_at)
 VALUES($1,$2,$3,ARRAY['coach'],$4,now()+interval '7 days')`,[current,school,`current-${person}@example.invalid`,hash()]);
 await client.query(`INSERT INTO school_invitations(id,school_id,invited_email,requested_roles,token_hash,created_at,expires_at)
 VALUES($1,$2,$3,ARRAY['coach'],$4,now()-interval '8 days',now()-interval '1 day')`,[recent,school,`recent-${person}@example.invalid`,hash()]);
 // Repeated bounded batches accommodate existing historical rehearsal rows without changing production.
 for(let n=0;n<20;n++) {
  const {rows:[result]}=await client.query('SELECT * FROM maintain_staff_invitations($1)',[environment]);
  assert(result.expired<=100 && result.removed<=100);
  if(!await scalar('SELECT EXISTS(SELECT 1 FROM school_invitations WHERE id=$1)',[old]))break;
 }
 assert.equal(await scalar('SELECT EXISTS(SELECT 1 FROM school_invitations WHERE id=$1)',[old]),false);
 assert.equal(await scalar('SELECT status FROM school_invitations WHERE id=$1',[current]),'pending');
 assert.equal(await scalar('SELECT status FROM school_invitations WHERE id=$1',[recent]),'expired');
 const {rows:[audit]}=await client.query('SELECT invitation_id,details FROM school_access_events WHERE id=$1',[event]);
 assert.equal(audit.invitation_id,null);assert.deepEqual(audit.details.roles,['coach']);
 const {rows:[outbox]}=await client.query('SELECT status,payload FROM job_outbox WHERE id=$1',[job]);
 assert.equal(outbox.payload,null);assert.equal(outbox.status,'expired');
 // Maintenance must not make the expired invitation's Resend action unusable.
 const membership=await scalar('INSERT INTO school_memberships(school_id,user_id) VALUES($1,$2) RETURNING id',[school,person]);
 await client.query('UPDATE schools SET owner_membership_id=$1 WHERE id=$2',[membership,school]);
 const replacementJob=randomUUID(),replacementHash=hash();
 await client.query(`SELECT manage_staff_invitation($1,$2,'reissue',$3,NULL,NULL,NULL,$4,$5,$6,$7,'{}')`,
  [person,school,recent,replacementHash,replacementJob,environment,hash()]);
 assert.equal(await scalar('SELECT status FROM school_invitations WHERE token_hash=$1',[replacementHash]),'pending');
 // Reusing the older expired ID must not replace that newer pending invitation.
 await client.query('SAVEPOINT stale_reissue');
 try {
  await client.query(`SELECT manage_staff_invitation($1,$2,'reissue',$3,NULL,NULL,NULL,$4,$5,$6,$7,'{}')`,
   [person,school,recent,hash(),randomUUID(),environment,hash()]);
  assert.fail('Expected stale invitation conflict');
 } catch(error) { assert.equal(error.code,'23514'); }
 finally { await client.query('ROLLBACK TO SAVEPOINT stale_reissue'); }
 assert.equal(await scalar('SELECT status FROM school_invitations WHERE token_hash=$1',[replacementHash]),'pending');
 return ['maintenance-expired invitation can be reissued; stale expired ID cannot replace newer pending invitation',
  'old invitation recipient/token removed; grant role evidence retained with null invitation FK',
  'current pending and recently expired invitations retained; orphaned encrypted job payload cleared; batches bounded'];
}
