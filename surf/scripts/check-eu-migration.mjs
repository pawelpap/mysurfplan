// A8 recovery-branch checks. Never run against a live environment.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';

const file=process.argv[2], mode=process.argv[3];
assert.equal((await fs.stat(file)).mode & 0o077,0);
const url=new URL((await fs.readFile(file,'utf8')).trim());
assert.equal(url.hostname,'ep-holy-breeze-b2bby6tz.c-6.eu-central-1.aws.neon.tech');
const c=new pg.Client({connectionString:url.toString()});await c.connect();
const migration=async id=>fs.readFile(new URL(`../db/migrations/${id}.sql`,import.meta.url),'utf8');
const cleanup=await migration('20260912_remove_unused_legacy');
const legacy=await migration('20260905_preserve_legacy_tables');
let passed=0;
async function check(name,fn){await fn();console.log('PASS '+name);passed++;}
try {
  await c.query("SET lock_timeout='5s'; SET statement_timeout='60s'");
  if(mode==='bootstrap' || mode==='finish-bootstrap') {
   if(mode==='bootstrap') {
    assert.equal((await c.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'")).rows[0].n,0);
    await c.query(await fs.readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
    // The historical bootstrap already includes the early additive changes.
    // Replay those idempotent migrations, then B1 and B2 in their release order.
    for(const id of ['20260905_conditions','20260905_login_usernames','20260905_preserve_legacy_tables','20260905_caparica_wave_sample','20260905_sao_pedro_exposure','20260906_calibration_profiles','20260907_revocable_sessions','20260908_login_limits','20260909_global_memberships','20260909_membership_runtime','20260909_membership_authority']) await c.query(await migration(id));
   }
    assert.equal((await c.query('SELECT count(*)::int AS n FROM users')).rows[0].n,0);
    await c.query("INSERT INTO schools(name) VALUES('Demo Surf School')");
    await c.query(await migration('20260912_public_demo'));
    await c.query(cleanup);
    await check('fresh bootstrap and historical migration replay end without legacy tables',async()=>{
      assert.equal((await c.query("SELECT to_regclass('public.surf_lessons') IS NULL AND to_regclass('public.surf_bookings') IS NULL AND to_regnamespace('neon_auth') IS NULL AS absent")).rows[0].absent,true);
      assert.equal((await c.query('SELECT authority FROM identity_migration_state')).rows[0].authority,'memberships');
      assert.equal((await c.query('SELECT account_demo_eligible(id) AS ok FROM users WHERE is_demo')).rows[0].ok,true);
    });
  }
  await c.query('BEGIN');
  await check('legacy cleanup is repeatable',async()=>{await c.query(cleanup);await c.query(cleanup);});
  await c.query('ROLLBACK');
  for(const [table,insert] of [
    ['surf_lessons',"INSERT INTO surf_lessons(start_iso,difficulty,place) VALUES(now(),'Beginner','A8 fixture')"],
    ['surf_bookings',"INSERT INTO surf_bookings(lesson_id,email) VALUES('A8 fixture','a8@example.invalid')"],
    ['neon_auth.users_sync',"INSERT INTO neon_auth.users_sync VALUES('A8 fixture')"],
  ]) await check(`cleanup refuses a populated ${table}`,async()=>{
    await c.query('BEGIN');await c.query(legacy);await c.query('CREATE SCHEMA neon_auth; CREATE TABLE neon_auth.users_sync(id text)');await c.query(insert);
    let error;try{await c.query(cleanup);}catch(e){error=e;}await c.query('ROLLBACK');assert.match(error?.message||'',/Legacy cleanup refused/);
  });
  await check('cleanup refuses an unexpected dependent view',async()=>{
    await c.query('BEGIN');await c.query(legacy);await c.query('CREATE VIEW a8_dependency_check AS SELECT * FROM surf_lessons');
    let error;try{await c.query(cleanup);}catch(e){error=e;}await c.query('ROLLBACK');assert.equal(error?.code,'2BP01');
  });
  await check('live session queries preserve expiry and revocation on PG18',async()=>{
    const {createSessionStore}=await import('../lib/auth-store.mjs');
    await c.query('BEGIN');
    const id=(await c.query("SELECT id FROM users WHERE is_demo AND deleted_at IS NULL")).rows[0].id;
    const sql=async(parts,...values)=>(await c.query(parts.reduce((q,p,i)=>q+(i?`$${i}`:'')+p,''),values)).rows;
    const store=createSessionStore(sql),a=await store.create(id,null,{demo:true}),b=await store.create(id,null,{demo:true});
    assert.equal((await store.find(a)).id,id);await store.revoke(a);assert.equal(await store.find(a),null);assert.equal((await store.find(b)).id,id);
    await c.query("UPDATE auth_sessions SET created_at=now()-interval '2 seconds',expires_at=now()-interval '1 second' WHERE token_hash=$1",[crypto.createHash('sha256').update(b).digest('hex')]);
    assert.equal(await store.find(b),null);await c.query('ROLLBACK');
  });
  console.log(`${passed} A8 database checks passed; temporary checks rolled back.`);
} finally {await c.query('ROLLBACK').catch(()=>{});await c.end();}
