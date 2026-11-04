import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT_ACTIVITY_RECIPIENT, ACCOUNT_ACTIVITY_SUBJECTS, recipientAllowed } from '../lib/email/config.mjs';
import { accountActivityNotice } from '../lib/email/account-activity.mjs';
import { decryptPayload, recipientHash } from '../lib/email/crypto.mjs';
import { createMailjetAdapter } from '../lib/email/mailjet.mjs';
import { runEmailWorker } from '../lib/email/worker.mjs';

const config = {
  enabled: true, environment: 'production', accountFlows: true, publicAccounts: false,
  payloadKey: 'a'.repeat(64), keyId: 'fixture', recipientKey: 'b'.repeat(64),
  from: ACCOUNT_ACTIVITY_RECIPIENT, callbackSecret: 'c'.repeat(64),
  apiKey: 'fixture', apiSecret: 'fixture', allowlist: ['approved@example.invalid'],
};

test('account activity goes only to Support and contains no customer data or links', async () => {
  for (const [type, subject] of Object.entries(ACCOUNT_ACTIVITY_SUBJECTS)) {
    assert.equal(accountActivityNotice({ ...config, environment: 'staging' }, type), null);
    assert.equal(recipientAllowed(config, 'approved@example.invalid', type), false);
    assert.equal(recipientAllowed({ ...config, publicAccounts: true }, 'any@example.invalid', type), false);
    const notice = accountActivityNotice(config, type);
    const job = { id: notice.id, type, payload: JSON.parse(notice.payload), schema_version: 1,
      recipient_hash: notice.hash, created_at: '2026-11-04T19:45:00Z' };
    assert.equal(notice.hash, recipientHash(ACCOUNT_ACTIVITY_RECIPIENT, config));
    assert.deepEqual(decryptPayload(job.payload, job.id, config, type), { recipient: ACCOUNT_ACTIVITY_RECIPIENT });
    let sent;
    const send = createMailjetAdapter(config, async (_url, opts) => {
      sent = JSON.parse(opts.body).Messages[0];
      return Response.json({Messages:[{Status:'success',To:[{MessageUUID:'fixture-message-id'}]}]});
    });
    const result = await runEmailWorker({ config, jobId: notice.id, send, store: {
      claim: async id => { assert.equal(id, notice.id); return job; },
      prepare: async (_job, recipient) => { assert.equal(recipient, ACCOUNT_ACTIVITY_RECIPIENT); return 'ready'; },
      finish: async (_job, outcome) => { assert.equal(outcome.status, 'accepted'); },
    } });
    assert.equal(result.processed, 1);
    assert.equal(sent.To[0].Email, ACCOUNT_ACTIVITY_RECIPIENT);
    assert.equal(sent.Subject, subject + ' · MyWavePlan');
    assert.match(sent.TextPart, /Lisbon time/);
    assert.doesNotMatch(sent.TextPart, /approved@example|\/account\//);
    assert.equal(sent.TrackClicks, 'disabled');
    assert.equal(sent.TrackOpens, 'disabled');
  }
});
