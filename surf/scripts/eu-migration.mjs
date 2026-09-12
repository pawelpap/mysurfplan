// A8 operator tool. URLs/archives stay in a private directory, never in git or logs.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import pg from 'pg';

const args = process.argv.slice(2);
const action = args[0];
const flag = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const legacy = new Set(['surf_bookings', 'surf_lessons']);
const fenceName = 'mwp_a8_write_fence';
const cleanupId = '20260912_remove_unused_legacy';
const archive = flag('--archive');
const bin = process.env.MWP_PG_BIN || '/opt/homebrew/opt/libpq/bin';
let client;
async function privateRead(file) {
  assert(file, 'A private input file is required');
  const stat = await fs.stat(file);
  assert.equal(stat.mode & 0o077, 0, 'Input file must be mode 0600');
  return fs.readFile(file);
}
async function privateWrite(file, content) {
  await fs.writeFile(file, content, { mode: 0o600 });
  await fs.chmod(file, 0o600);
}
const url = new URL((await privateRead(flag('--url-file'))).toString().trim());
assert.equal(url.hostname, flag('--expected-host'), 'Wrong endpoint');
assert.equal(url.pathname, '/neondb', 'Wrong database');
assert(!url.hostname.includes('-pooler'), 'Direct connection required');
assert.equal(url.searchParams.get('sslmode'), 'verify-full', 'TLS certificate verification required');
const isEu = url.hostname.endsWith('.eu-central-1.aws.neon.tech');
const subprocessEnv = {
  ...process.env, PGHOST: url.hostname, PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: 'neondb',
  PGSSLMODE: 'verify-full', PGSSLROOTCERT: 'system', PGCONNECT_TIMEOUT: '15',
};
async function command(name, flags, input) {
  return new Promise((resolve, reject) => {
    const proc = spawn(`${bin}/${name}`, flags, { env: subprocessEnv, stdio: ['pipe','pipe','pipe'] });
    const output = [], errors = [];
    const timeout = setTimeout(() => proc.kill('SIGTERM'), 300000);
    proc.stdout.on('data', b => output.push(b));
    proc.stderr.on('data', b => errors.push(b));
    proc.on('error', reject);
    proc.on('close', async code => {
      clearTimeout(timeout);
      if (code !== 0) {
        await privateWrite('/private/tmp/mwp-a8-private/last-client-error.log', Buffer.concat(errors));
        reject(new Error(`${name} failed (${code}); inspect private error log`));
      } else resolve(Buffer.concat(output));
    });
    proc.stdin.on('error', () => {});
    proc.stdin.end(input);
  });
}
async function tables() {
  return (await client.query("SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r => r.name);
}
async function manifest() {
  const result = { tables: [], objects: {}, server: (await client.query('SHOW server_version')).rows[0].server_version };
  for (const table of await tables()) {
    const r = (await client.query(`SELECT count(*)::int AS count, md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]')::text) AS digest FROM public.${quote(table)} t`)).rows[0];
    result.tables.push({ name: table, ...r });
  }
  const queries = {
    columns: "SELECT c.relname AS object,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS expression,a.attgenerated,a.attidentity FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN ('r','p','v') AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum",
    constraints: "SELECT c.relname AS object,k.conname AS name,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND k.contype<>'n' ORDER BY c.relname,k.conname",
    indexes: "SELECT tablename AS object,indexname AS name,indexdef AS definition FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
    triggers: "SELECT c.relname AS object,t.tgname AS name,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgname<>'mwp_a8_write_fence' ORDER BY c.relname,t.tgname",
    routines: "SELECT p.oid::regprocedure::text AS name,md5(pg_get_functiondef(p.oid)) AS digest FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p') AND p.proname<>'mwp_a8_write_fence' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.classid='pg_proc'::regclass AND d.deptype='e') ORDER BY 1",
    enums: "SELECT t.typname AS name,jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' GROUP BY t.typname ORDER BY t.typname",
    // PG18 prints a redundant alias in non-leading UNION arms. The UNION's
    // output names still come from its first SELECT. Normalise that exact
    // formatting difference only; keep all conditions and joins fingerprinted.
    views: "SELECT viewname AS name,md5(replace(definition,'''customer''::text AS text,','''customer''::text,')) AS digest FROM pg_views WHERE schemaname='public' ORDER BY viewname",
    grants: "SELECT grantee,table_name AS object,privilege_type,is_grantable FROM information_schema.role_table_grants WHERE table_schema='public' ORDER BY table_name,grantee,privilege_type",
    extensions: "SELECT extname AS name,extversion AS version FROM pg_extension ORDER BY extname",
    sequences: "SELECT sequencename AS name,sequenceowner,data_type::text,start_value,min_value,max_value,increment_by,cycle,cache_size,last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename",
    rowSecurity: "SELECT c.relname AS object,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname",
    policies: "SELECT tablename AS object,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname",
  };
  for (const [key, query] of Object.entries(queries)) result.objects[key] = (await client.query(query)).rows;
  return result;
}
async function unfence() {
  for (const t of await tables()) await client.query(`DROP TRIGGER IF EXISTS ${fenceName} ON public.${quote(t)}`);
  await client.query(`DROP FUNCTION IF EXISTS public.${fenceName}()`);
}
async function cleanup() {
  const source = await fs.readFile(new URL(`../db/migrations/${cleanupId}.sql`, import.meta.url), 'utf8');
  const checksum = crypto.createHash('sha256').update(source).digest('hex');
  const prior = (await client.query('SELECT checksum FROM identity_schema_migrations WHERE id=$1',[cleanupId])).rows[0];
  if(prior) assert.equal(prior.checksum,checksum);
  await client.query(source);
  if(!prior) await client.query('INSERT INTO identity_schema_migrations(id,checksum) VALUES($1,$2)',[cleanupId,checksum]);
}
try {
  client = new pg.Client({connectionString:url.toString(),connectionTimeoutMillis:15000,application_name:'mwp-a8-operator'});
  await client.connect();
  await client.query("SET timezone='UTC'; SET statement_timeout='120s'; SET lock_timeout='10s'");
  if(action==='audit') {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const data=await manifest();
    await client.query('COMMIT');
    await privateWrite(flag('--output'),JSON.stringify(data,null,2));
    console.log(JSON.stringify({action,host:url.hostname,server:data.server,tables:data.tables.map(({name,count})=>({name,count}))}));
  } else if(action==='dump') {
    assert(archive);
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot=(await client.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
    const data=await manifest();
    const dump=await command('pg_dump',['-Fc','--no-owner','--exclude-schema=neon_auth',`--snapshot=${snapshot}`]);
    await client.query('COMMIT');
    const key=crypto.randomBytes(32),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
    const encrypted=Buffer.concat([cipher.update(dump),cipher.final()]);
    await privateWrite(archive,Buffer.concat([iv,cipher.getAuthTag(),encrypted]));
    await privateWrite(archive+'.key',key);
    await privateWrite(archive+'.manifest.json',JSON.stringify(data,null,2));
    console.log(JSON.stringify({action,host:url.hostname,bytes:dump.length,tables:data.tables.length,encrypted:true,sha256:crypto.createHash('sha256').update(dump).digest('hex')}));
  } else if(action==='restore') {
    assert(isEu,'Restores are restricted to the verified EU destination');
    const existing=await tables();
    assert(existing.length===0 || args.includes('--replace-offline-target'),'Target must be empty; replacing an offline rehearsal requires an explicit flag');
    const encrypted=await privateRead(archive), key=await privateRead(archive+'.key');
    const decipher=crypto.createDecipheriv('aes-256-gcm',key,encrypted.subarray(0,12));decipher.setAuthTag(encrypted.subarray(12,28));
    const dump=Buffer.concat([decipher.update(encrypted.subarray(28)),decipher.final()]);
    // The calibration CHECK calls a stored validator that looks up schema rows
    // using the application's public search path. pg_restore's empty search
    // path makes that validator return false. Set it only in the restore
    // session; do not disable constraints or alter the original functions.
    // Neon controls cloud_admin defaults; they cannot be transferred by the
    // database owner. Preserve every application ACL and verify them below.
    const toc=(await command('pg_restore',['--list'],dump)).toString();
    const restoreList='/private/tmp/mwp-a8-private/restore-list.txt';
    await privateWrite(restoreList,toc.split('\n').filter(line=>!/^\d+;.* DEFAULT ACL public DEFAULT PRIVILEGES FOR (SEQUENCES|TABLES) cloud_admin$/.test(line)).join('\n'));
    const sql=(await command('pg_restore',['--no-owner','--exit-on-error','--file=-',`--use-list=${restoreList}`,...(existing.length?['--clean','--if-exists']:[])],dump)).toString();
    const header="SELECT pg_catalog.set_config('search_path', '', false);";
    assert.equal(sql.split(header).length,2,'Unexpected pg_restore search-path header');
    await command('psql',['-X','-q','--set=ON_ERROR_STOP=1','--single-transaction'],Buffer.from(sql.replace(header,"SELECT pg_catalog.set_config('search_path', 'public', false);")));
    await client.query('BEGIN');await unfence();await cleanup();await client.query('COMMIT');
    console.log(JSON.stringify({action,host:url.hostname,cleaned:true}));
  } else if(action==='cleanup') {
    assert(isEu);await client.query('BEGIN');await cleanup();await client.query('COMMIT');
    console.log(JSON.stringify({action,host:url.hostname}));
  } else if(action==='freeze') {
    assert(args.includes('--apply'),'Write freeze requires --apply');
    await client.query('BEGIN');
    const names=await tables();
    await client.query(`LOCK TABLE ${names.map(n=>'public.'+quote(n)).join(',')} IN SHARE ROW EXCLUSIVE MODE`);
    await client.query(`CREATE OR REPLACE FUNCTION public.${fenceName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Database migration: writes are temporarily unavailable' USING ERRCODE='55000'; END $$`);
    for(const t of names) {
      await client.query(`DROP TRIGGER IF EXISTS ${fenceName} ON public.${quote(t)}`);
      await client.query(`CREATE TRIGGER ${fenceName} BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.${quote(t)} FOR EACH STATEMENT EXECUTE FUNCTION public.${fenceName}()`);
    }
    await client.query('COMMIT');
    let blocked=false;try{await client.query('UPDATE users SET name=name WHERE false');}catch(e){blocked=e.code==='55000';}
    assert(blocked,'Write fence did not block the probe');
    console.log(JSON.stringify({action,host:url.hostname,tables:names.length,blocked}));
  } else if(action==='unfreeze') {
    assert(args.includes('--apply'),'Unfreeze requires --apply after checking authority');
    await client.query('BEGIN');await unfence();await client.query('COMMIT');
    console.log(JSON.stringify({action,host:url.hostname}));
  } else if(action==='compare') {
    const before=JSON.parse(await privateRead(flag('--source-manifest')));
    const after=await manifest();
    const select=data=>data.tables.filter(t=>!legacy.has(t.name)&&t.name!=='identity_schema_migrations');
    assert.deepEqual(select(after),select(before),'Data fingerprints differ');
    for(const [key,values] of Object.entries(before.objects)) {
      const filter=rows=>rows.filter(r=>!legacy.has(r.object));
      const expected=key==='extensions' && before.server.startsWith('17.') && after.server.startsWith('18.')
        ? values.map(r=>({...r,version:({pgcrypto:{'1.3':'1.4'},pg_jsonschema:{'0.3.3':'0.3.4'}})[r.name]?.[r.version]||r.version})) : values;
      assert.deepEqual(filter(after.objects[key]),filter(expected),`Schema ${key} differs`);
    }
    assert.equal((await client.query('SELECT bool_and(validate_surf_configuration(configuration,schema_version)) AS valid FROM surf_calibration_profiles')).rows[0].valid,true);
    assert.equal((await client.query('SELECT bool_and(validate_surf_configuration(calibration_config,calibration_schema_version)) AS valid FROM surf_spots WHERE calibration_config IS NOT NULL')).rows[0].valid,true);
    const checksumRows=(await client.query('SELECT id,checksum FROM identity_schema_migrations ORDER BY id')).rows;
    for(const row of checksumRows) {
      const source=await fs.readFile(new URL(`../db/migrations/${row.id}.sql`,import.meta.url));
      assert.equal(crypto.createHash('sha256').update(source).digest('hex'),row.checksum,`Migration checksum ${row.id}`);
    }
    assert(!after.tables.some(t=>legacy.has(t.name)));
    assert.equal((await client.query("SELECT to_regnamespace('neon_auth') IS NULL AS absent")).rows[0].absent,true);
    console.log(JSON.stringify({action,host:url.hostname,tables:select(after).length,schemaGroups:Object.keys(before.objects).length,checksums:checksumRows.length,identical:true}));
  } else throw new Error('Unknown action');
} catch(error) {
  if(client)await client.query('ROLLBACK').catch(()=>{});
  // Full errors may contain data. Store privately, print only the operator failure class.
  await privateWrite('/private/tmp/mwp-a8-private/operator-error.log',error.stack||String(error));
  console.error(JSON.stringify({action,failed:true,code:error.code||'A8_CHECK_FAILED',message:error instanceof assert.AssertionError ? error.message.split('\n')[0] : (error.code?'Database operation failed':error.message)}));
  process.exitCode=1;
} finally {if(client)await client.end();}
