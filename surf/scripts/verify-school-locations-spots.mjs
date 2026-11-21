import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function verifySchoolLocationsSpots(client) {
 const checks=[];
 const scalar=async(q,p=[])=>Object.values((await client.query(q,p)).rows[0])[0];
 async function denied(q,p,code='42501') {
  await client.query('SAVEPOINT expected_location_denial');
  try{await client.query(q,p);assert.fail('Expected rejection');}catch(error){assert.equal(error.code,code,error.message);}
  finally{await client.query('ROLLBACK TO SAVEPOINT expected_location_denial');}
 }
 const prefix='b5-location-'+randomUUID();
 async function user(label){return scalar("INSERT INTO users(name,email,role,email_verified_at) VALUES($1,$2,'student',now()) RETURNING id",[prefix+label,prefix+label+'@example.invalid']);}
 const owner=await user('owner'),other=await user('other'),platform=await user('platform'),teacher=await user('teacher');
 await client.query('INSERT INTO platform_role_assignments(user_id) VALUES($1)',[platform]);
 const spots=(await client.query('SELECT id FROM surf_spots WHERE active ORDER BY id LIMIT 3')).rows.map(r=>r.id);
 assert.equal(spots.length,3,'Three catalogue spots are required');
 const details={name:prefix,description:'',timezone:'Europe/Lisbon',contactEmail:'',contactPhone:'',website:'',socialLinks:[],operatingSpotIds:[spots[0],spots[1]]};
 const create='SELECT create_draft_school($1,$2,$3::jsonb)';
 const update='SELECT update_school_settings($1,$2,$3,$4::jsonb)';
 const request=randomUUID();
 const draft=(await scalar(create,[owner,request,details])).data;
 assert.deepEqual(draft.baseLocation,{hasFixedBase:false,address:'',latitude:null,longitude:null,publicVisible:false});
 const base={hasFixedBase:true,address:'Private synthetic school base',latitude:38.7,longitude:-9.1,publicVisible:false};
 const changed=(await scalar(update,[owner,draft.id,1,{...details,baseLocation:base}])).data;
 assert.equal(changed.revision,2);assert.deepEqual(changed.baseLocation,base);
 await denied(update,[other,draft.id,2,{...details,baseLocation:base}]);
 await denied(update,[owner,draft.id,2,{...details,baseLocation:{...base,latitude:null,longitude:null,publicVisible:true}}],'22023');
 const preserved=(await scalar(update,[owner,draft.id,2,{...details,description:'Old client omitted base'}])).data;
 assert.deepEqual(preserved.baseLocation,base);
 await denied(create,[owner,request,{...details,baseLocation:base}],'23514');
 checks.push('private separate base, canonical default, old-client preservation, authority, public-pin requirement and changed retry protection');

 await client.query('UPDATE surf_spots SET active=false WHERE id=$1',[spots[0]]);
 const retained=(await scalar(update,[owner,draft.id,3,{...details,baseLocation:base}])).data;
 assert.deepEqual(retained.operatingSpotIds.slice().sort(),details.operatingSpotIds.slice().sort());
 await denied(create,[owner,randomUUID(),{...details,name:prefix+'-new-inactive'}],'22023');
 await client.query('UPDATE surf_spots SET active=true WHERE id=$1',[spots[0]]);
 checks.push('retained inactive operating selection survives unrelated save; new inactive association rejected');

 const school=await scalar('INSERT INTO schools(name) VALUES($1) RETURNING id',[prefix+'-operational']);
 const foreign=await scalar('INSERT INTO schools(name) VALUES($1) RETURNING id',[prefix+'-foreign']);
 await client.query("SELECT set_school_access($1,$2,$3,ARRAY['school_admin'],'active')",[platform,owner,school]);
 await client.query("SELECT set_school_access($1,$2,$3,ARRAY['coach'],'active')",[platform,teacher,school]);
 const coach=await scalar('SELECT id FROM coaches WHERE school_id=$1 AND user_id=$2',[school,teacher]);
 const schoolDetails={...details,name:prefix+'-operational'};
 await scalar(update,[owner,school,1,schoolDetails]);
 const lesson=(spot,extra={})=>({startAt:new Date(Date.now()+86400000).toISOString(),durationMin:90,difficulty:'Beginner',place:'Synthetic meeting point',capacity:2,spotId:spot,coachIds:[],...extra});
 const mutate='SELECT mutate_school_lesson($1,$2,$3,$4,$5::jsonb)';
 const first=await scalar(mutate,[owner,school,'create',null,lesson(spots[0],{coachIds:[coach]})]);
 const second=await scalar(mutate,[owner,school,'create',null,lesson(spots[1])]);
 await denied(mutate,[owner,school,'create',null,lesson(spots[2])],'22023');
 await denied(mutate,[other,school,'create',null,lesson(spots[0])]);
 await denied(mutate,[owner,foreign,'create',null,lesson(spots[0])]);
 await denied(mutate,[owner,draft.id,'create',null,lesson(spots[0])]);
 await client.query("UPDATE school_memberships SET status='suspended' WHERE school_id=$1 AND user_id=$2",[school,teacher]);
 await denied('SELECT set_school_lesson_coaches($1,$2,$3,$4::uuid[])',[owner,school,second.id,[coach]],'22023');
 checks.push('two chosen spots permit lessons; third/foreign/draft/unauthorised choices and inactive teaching assignment rejected transactionally');

 await denied(update,[owner,school,2,{...schoolDetails,operatingSpotIds:[spots[1]]}],'P0004');
 await scalar(mutate,[owner,school,'delete',first.id,null]);
 const ongoing=await scalar(mutate,[owner,school,'create',null,lesson(spots[0],{startAt:new Date(Date.now()-600000).toISOString()})]);
 await denied(update,[owner,school,2,{...schoolDetails,operatingSpotIds:[spots[1]]}],'P0004');
 await scalar(mutate,[owner,school,'delete',ongoing.id,null]);
 const past=await scalar(mutate,[owner,school,'create',null,lesson(spots[0],{startAt:new Date(Date.now()-7200000).toISOString(),durationMin:30})]);
 await scalar(update,[owner,school,2,{...schoolDetails,operatingSpotIds:[spots[1]]}]);
 assert.equal(await scalar('SELECT spot_id FROM lessons WHERE id=$1 AND deleted_at IS NULL',[past.id]),spots[0]);
 await denied(mutate,[owner,school,'update',past.id,lesson(spots[0])],'22023');
 checks.push('future and ongoing lessons block spot removal; ended history survives removal and cannot reschedule into an unselected spot');

 const studentA=await scalar('INSERT INTO students(school_id,name,email) VALUES($1,$2,$3) RETURNING id',[school,prefix+'-a',prefix+'-a@example.invalid']);
 const studentB=await scalar('INSERT INTO students(school_id,name,email) VALUES($1,$2,$3) RETURNING id',[school,prefix+'-b',prefix+'-b@example.invalid']);
 await client.query("INSERT INTO bookings(lesson_id,student_id,status) VALUES($1,$2,'booked'),($1,$3,'booked')",[second.id,studentA,studentB]);
 await denied(mutate,[owner,school,'update',second.id,lesson(spots[1],{capacity:1})],'23514');
 assert.equal(await scalar('SELECT capacity FROM lessons WHERE id=$1',[second.id]),2);
 checks.push('capacity cannot fall below booked count and failed writes preserve the lesson');
 return checks;
}
