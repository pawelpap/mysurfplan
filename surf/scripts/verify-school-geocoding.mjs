import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';

// All fixtures remain inside the caller's rolled-back savepoint.
export async function verifySchoolGeocoding(client) {
  const checks = [];
  const row = async (q, p = []) => (await client.query(q, p)).rows[0];
  const scalar = async (q, p = []) => Object.values(await row(q, p))[0];
  async function denied(q, p) {
    await client.query('SAVEPOINT denied_lookup');
    try { await client.query(q, p); assert.fail('Expected a permission denial'); }
    catch (error) { assert.equal(error.code, '42501', error.message); }
    finally { await client.query('ROLLBACK TO SAVEPOINT denied_lookup'); }
  }
  const prefix = `b5-geo-${randomUUID()}`;
  const actor = await scalar("INSERT INTO users(name,email,role,email_verified_at) VALUES($1,$2,'student',now()) RETURNING id", [prefix, prefix+'@example.invalid']);
  const other = await scalar("INSERT INTO users(name,email,role,email_verified_at) VALUES($1,$2,'student',now()) RETURNING id", [prefix+'other', prefix+'other@example.invalid']);
  const settings = { name: prefix, description: '', timezone: 'Europe/Lisbon', contactEmail: '', contactPhone: '', website: '', socialLinks: [], operatingSpotIds: [] };
  const school = (await scalar('SELECT create_draft_school($1,$2,$3::jsonb)', [actor, randomUUID(), settings])).data.id;
  const membership = await scalar('SELECT owner_membership_id FROM schools WHERE id=$1', [school]);
  const environment = await scalar('SELECT environment FROM job_environment WHERE singleton');
  assert(['staging','production'].includes(environment));
  const request = 'SELECT reserve_school_address_lookup($1,$2,$3)';
  const params = [actor, school, environment];
  await denied(request, [other, school, environment]);
  await denied(request, [actor, school, environment === 'staging' ? 'production' : 'staging']);
  assert.deepEqual(await scalar(request, params), { allowed: false, reason: 'not_ready' });
  assert.equal(await scalar('SELECT count(*)::int FROM school_geocoding_budget'), 0);
  checks.push('current school authority and exact environment required; disabled policy makes no reservations');

  const version = prefix;
  const content = 'STAGING/REHEARSAL SYNTHETIC TEST ONLY. Geoapify optional lookup provider authorisation.';
  const hash = createHash('sha256').update(content).digest('hex');
  async function document(id, language, status = 'published', effective = '-1 minute') {
    await client.query(`INSERT INTO legal_documents(document_id,version,language,kind,title,content,content_hash,status,environment,effective_at,reviewed_at)
      VALUES($1,$2,$3,$4,'Synthetic test only',$5,$6,$7,$8,now()+$9::interval,now())`,
    [id, version, language, id === 'mywaveplan.privacy' ? 'privacy_notice' : 'school_processing', content, hash, status, environment, effective]);
  }
  async function accept(language) {
    await client.query(`INSERT INTO legal_acceptances(user_id,document_id,version,language,content_hash,kind,school_id,membership_id)
      VALUES($1,'mywaveplan.school-processing',$2,$3,$4,'school_processing',$5,$6)`, [actor, version, language, hash, school, membership]);
  }
  await client.query('UPDATE school_geocoding_policy SET enabled=true,provider_reviewed_at=now(),required_agreement_version=$1,required_privacy_version=$1', [version]);
  assert.equal((await scalar(request, params)).reason, 'not_ready');
  for (const id of ['mywaveplan.school-processing','mywaveplan.privacy']) {
    for (const language of ['en-GB','pt-PT','es','fr']) await document(id, language);
  }
  assert.equal((await scalar(request, params)).reason, 'not_ready', 'Publication alone is not school acceptance');
  await accept('en-GB');
  // Each negative case has a valid actor acceptance and the other complete
  // document. Remove only the exact new, unaccepted synthetic French fixture.
  for (const id of ['mywaveplan.school-processing','mywaveplan.privacy']) {
    for (const mode of ['missing', ...(environment === 'staging' ? ['preview'] : []), 'future']) {
      await client.query('SAVEPOINT isolated_locale_guard');
      await client.query("DELETE FROM legal_documents WHERE document_id=$1 AND version=$2 AND language='fr'", [id, version]);
      if (mode !== 'missing') await document(id, 'fr', mode === 'preview' ? 'staging_preview' : 'published', mode === 'future' ? '1 day' : '-1 minute');
      assert.deepEqual(await scalar(request, params), { allowed: false, reason: 'not_ready' }, `${id}: ${mode} fourth locale must independently block`);
      await client.query('ROLLBACK TO SAVEPOINT isolated_locale_guard');
    }
  }
  assert.deepEqual(await scalar(request, params), { allowed: true });
  assert.equal(await scalar('SELECT count(*)::int FROM privacy_notice_deliveries WHERE user_id=$1', [actor]), 0);
  assert.equal(await scalar('SELECT count(*)::int FROM school_geocoding_budget'), 3);
  checks.push('all four effective published privacy/agreement translations required; previews, future/missing locales and absent school acceptance block; privacy is not consent');

  assert.deepEqual(await scalar(request, params), { allowed: false, reason: 'limited' });
  await client.query("UPDATE school_geocoding_dispatch SET last_dispatch_at=now()-interval '2 seconds'");
  await client.query("UPDATE school_geocoding_budget SET used=20 WHERE scope='actor'");
  assert.equal((await scalar(request, params)).reason, 'limited');
  await client.query("UPDATE school_geocoding_budget SET used=1 WHERE scope='actor'");
  await client.query("UPDATE school_geocoding_budget SET used=50 WHERE scope='school'");
  assert.equal((await scalar(request, params)).reason, 'limited');
  await client.query("UPDATE school_geocoding_budget SET used=1 WHERE scope='school'");
  await client.query("UPDATE school_geocoding_budget SET used=$1 WHERE scope='global'", [environment === 'staging' ? 200 : 1800]);
  assert.equal((await scalar(request, params)).reason, 'limited');
  await client.query("UPDATE school_geocoding_budget SET used=1 WHERE scope='global'");
  await client.query("INSERT INTO school_geocoding_budget(scope,subject,bucket,used) VALUES('actor',$1,now()-interval '5 days',1)", [other]);
  assert.equal((await scalar(request, params)).allowed, true);
  assert.equal(await scalar("SELECT count(*)::int FROM school_geocoding_budget WHERE subject=$1", [other]), 0);
  checks.push('durable dispatch, actor-hour, school-day and environment-day limits; expired counter cleanup without cached addresses');

  await client.query("UPDATE school_memberships SET status='suspended' WHERE id=$1", [membership]);
  await denied(request, params);
  await client.query("UPDATE school_memberships SET status='active' WHERE id=$1", [membership]);
  await client.query('UPDATE users SET email_verified_at=NULL WHERE id=$1', [actor]);
  await denied(request, params);
  checks.push('current membership and verified-account state rechecked after reservation locks');
  return checks;
}
