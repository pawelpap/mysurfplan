import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {verifySchoolBranding} from './verify-school-branding.mjs';
export async function verifyBrandingSafety(client){
 const value=async(q,p=[])=>(Object.values((await client.query(q,p)).rows[0])[0]);
 const {fixture}=await verifySchoolBranding(client,{returnFixture:true});
 const {owner,school,revision,settingsRevision,withLogo}=fixture;
 const empty={accent:'sea',logoAssetId:null,logoAlt:'',coverAssetId:null,coverAlt:'',gallery:[]};
 // Create aged versions directly as new synthetic records. Never disable the
 // immutable trigger or rewrite an existing version's publication timestamp.
 const agedPinned=randomUUID(),agedUnpinned=randomUUID();
 for(const id of[agedPinned,agedUnpinned])await client.query(`INSERT INTO school_branding_versions(id,school_id,version_number,source_revision,source_settings_revision,snapshot,published_by,published_at)
  VALUES($1,$2,$3,1,1,$4,$5,now()-interval '31 days')`,[id,school,id===agedPinned?30:31,{name:'Synthetic old version'},owner]);
 const pin=randomUUID();await client.query('INSERT INTO school_branding_version_pins(version_id,reference_id) VALUES($1,$2)',[agedPinned,pin]);
 assert.equal(await value('SELECT prune_school_branding_versions(20)'),1);
 assert.equal(await value('SELECT count(*)::int FROM school_branding_versions WHERE id=$1',[agedPinned]),1);
 assert.equal(await value('SELECT count(*)::int FROM school_branding_versions WHERE id=$1',[agedUnpinned]),0);
 await client.query('DELETE FROM school_branding_version_pins WHERE version_id=$1 AND reference_id=$2',[agedPinned,pin]);
 assert.equal(await value('SELECT prune_school_branding_versions(20)'),1);
 const current=await value('SELECT published_branding_version_id FROM schools WHERE id=$1',[school]);
 assert(current);assert.equal(await value('SELECT count(*)::int FROM school_branding_versions WHERE id=$1',[current]),1);
 const intent=await value('SELECT begin_school_publication($1,$2,$3,$4,$5)',[owner,school,revision,settingsRevision,randomUUID()]);
 await client.query("UPDATE school_publication_intents SET expires_at=now()-interval '1 second' WHERE id=$1",[intent.id]);
 await client.query('SAVEPOINT expected_expiry');try{await client.query('SELECT finish_school_publication($1,$2)',[owner,intent.id]);assert.fail('Expected expiry');}catch(e){assert.equal(e.code,'40001');}finally{await client.query('ROLLBACK TO SAVEPOINT expected_expiry');}
 assert.equal(await value('SELECT expire_school_publication_intents(20)'),1);
 assert.equal(await value('SELECT state FROM school_publication_intents WHERE id=$1',[intent.id]),'failed');
 assert.equal(await value('SELECT published_branding_version_id FROM schools WHERE id=$1',[school]),current);
 return ['30-day version retention preserves active pointer and exact retry pin; released pin permits bounded pruning','expired publication cannot finish; maintenance withdraws intent and retains current public version'];
}
