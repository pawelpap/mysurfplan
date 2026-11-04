import test from 'node:test';
import assert from 'node:assert/strict';
import { accountEmailLink, accountNext, validNewPassword } from '../lib/account-flow.mjs';
import { accountConfig, accountHandler } from '../lib/account-server.mjs';
import { accountMessage } from '../lib/email/mailjet.mjs';
import { emailConfig, PROJECTS, recipientAllowed } from '../lib/email/config.mjs';
import { decryptPayload, encryptPayload } from '../lib/email/crypto.mjs';
import { hashPassword, verifyPassword } from '../lib/passwords.mjs';

const env = {
  APP_ENVIRONMENT: 'staging', VERCEL_ENV: 'production', VERCEL_PROJECT_ID: PROJECTS.staging,
  EMAIL_ENABLED: 'true', ACCOUNT_REGISTRATION_ENABLED: 'true', ACCOUNT_REGISTRATION_TERMS_VERSION: 'pilot-v2',
  ACCOUNT_EMAIL_PUBLIC: 'true', MAILJET_API_KEY: 'a'.repeat(32), MAILJET_SECRET_KEY: 'b'.repeat(32),
  EMAIL_PAYLOAD_KEY: 'c'.repeat(64), EMAIL_PAYLOAD_KEY_ID: 'v1', EMAIL_RECIPIENT_KEY: 'd'.repeat(64),
  EMAIL_CALLBACK_SECRET: 'e'.repeat(64), EMAIL_OPERATIONS_SECRET: 'f'.repeat(64), CRON_SECRET: 'g'.repeat(64),
  SESSION_SECRET: 'h'.repeat(64), EMAIL_TEST_RECIPIENTS: 'test@example.invalid',
  EMAIL_FROM: 'accounts@staging-mail.mywaveplan.com', EMAIL_DAILY_LIMIT: '10', EMAIL_MONTHLY_LIMIT: '100',
};
const host = 'staging.mywaveplan.com';
const token = 'z'.repeat(43);
const messageTypes = ['email.account_verify', 'email.account_reset'];

test('staging auth email remains allowlisted and requires explicit readiness configuration', () => {
  assert.equal(accountConfig({ headers: { host } }, env).termsVersion, 'pilot-v2');
  assert.equal(accountConfig({ headers: { host: 'mywaveplan.com' } }, env), null);
  for (const patch of [{ ACCOUNT_REGISTRATION_ENABLED: '' }, { EMAIL_ENABLED: 'false' },
    { ACCOUNT_REGISTRATION_TERMS_VERSION: '' }, { VERCEL_PROJECT_ID: PROJECTS.production }])
    assert.equal(accountConfig({ headers: { host } }, { ...env, ...patch }), null);
  const config = emailConfig(env);
  for (const type of [...messageTypes, 'email.delivery_check']) {
    assert.equal(recipientAllowed(config, 'test@example.invalid', type), true);
    assert.equal(recipientAllowed(config, 'other@example.invalid', type), false);
  }
});

test('account emails have fixed origins, untracked links, support replies and four languages', () => {
  const config = emailConfig(env);
  for (const locale of ['en-GB', 'pt-PT', 'es', 'fr']) {
    for (const type of messageTypes) {
      const job = { id: 'd4cf22ba-e1ca-4d74-8e8b-25d66316ded7', type };
      const purpose = type.split('_').at(-1);
      const link = new URL(accountEmailLink('staging', purpose, token, locale));
      const message = accountMessage(job, 'test@example.invalid', config, { token, locale });
      assert.equal(link.origin, 'https://staging.mywaveplan.com');
      assert.equal(link.searchParams.has('token'), false);
      assert.equal(link.hash, '#' + token);
      assert.equal(message.TrackClicks, 'disabled');
      assert.equal(message.TrackOpens, 'disabled');
      assert.equal(message.ReplyTo.Email, 'support@mywaveplan.com');
      assert.match(message.HTMLPart, new RegExp(`lang="${locale}"`));
      assert(message.TextPart.includes(link.href));
      assert(!message.Subject.includes('account.mail.'));
      const encrypted = encryptPayload({ token }, job.id, config, type);
      assert.deepEqual(decryptPayload(encrypted, job.id, config, type), { token });
      assert.throws(() => decryptPayload(encrypted, job.id, config));
    }
  }
});

test('return destinations preserve booking context while rejecting untrusted or credential paths', () => {
  assert.equal(accountNext('/?view=conditions&spot=example'), '/?view=conditions&spot=example');
  assert.equal(accountNext('/school-name'), '/school-name');
  for (const value of ['//another.example', 'https://another.example', '/\\another.example', '/%2fetc',
    '/account/reset', '/api/auth/login', '/a/../login', '/\t/another.example'])
    assert.equal(accountNext(value), '/');
});

test('new scrypt hashes verify alongside existing login hashes', async () => {
  const legacy = 'msp-scrypt-v1$16384$8$1$BwcHBwcHBwcHBwcHBwcHBw$LJDREFzSy_Scn3GoIZAx4GV9IAuVZNT5EwalTTduW95H2NRFQ1dqh5DSbjFaz_gat9OxGOfpP6_I77oyEaUKCw';
  const password = 'test only – multiple words';
  assert.equal(validNewPassword('too short'), false);
  assert.equal(validNewPassword(password), true);
  const current = await hashPassword(password);
  assert.match(current, /^msp-scrypt-v2\$16384\$8\$5\$/);
  assert.equal(await verifyPassword(password, current), true);
  assert.equal(await verifyPassword(password + '!', current), false);
  assert.equal(await verifyPassword(password, legacy.replace('$16384$', '$99999999$')), false);
});

test('scanner requests and disabled registration cannot reach the account store', async () => {
  const handler = accountHandler(() => assert.fail('database accessed'), {});
  for (const [method, action, expected] of [['GET','verify',405], ['GET','reset',405], ['POST','register',503]]) {
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json() {} };
    await handler({ method, query: { action }, headers: { host, 'x-mywaveplan-request': '1' } }, res);
    assert.equal(res.code, expected);
  }
});

test('automatic account delivery schedules the committed allowlisted job and keeps the response generic', async () => {
  for (const [action, email, fast] of [
    ['register', 'test@example.invalid', true],
    ['recover', 'test@example.invalid', true],
    ['recover', 'other@example.invalid', true],
    ['recover', 'test@example.invalid', false],
  ]) {
    let enqueued;
    let scheduled;
    const sql = async (parts, ...values) => {
      const query = parts.join('?');
      if (query.includes('auth_login_limits')) return [{ allowed: true, retry_seconds: 0 }];
      if (query.includes('legal_documents')) return [{ version: 'pilot-v2' }];
      if (query.includes('job_worker_status')) {
        assert.equal(values[1], fast ? 15 : 5);
        return [{ ready: true }];
      }
      if (query.includes('queue_account_email')) {
        enqueued = values[4];
        return [{}];
      }
      throw Error('Unexpected account query');
    };
    function schedule(_sql, _config, jobId) { assert.equal(jobId, enqueued); scheduled = jobId; }
    const handler = accountHandler(async () => sql, env, fast ? schedule : undefined);
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await handler({ method: 'POST', query: { action }, headers: { host, 'x-mywaveplan-request': '1' }, body: { email } }, res);
    assert.equal(res.code, 202);
    assert.deepEqual(res.body, { ok: true });
    assert.equal(Boolean(enqueued), email === 'test@example.invalid');
    assert.equal(scheduled, fast ? enqueued : undefined);
  }
});
