import test from 'node:test';
import assert from 'node:assert/strict';
import { supportEmail } from '../lib/email/template.mjs';
import { accountMessage, invitationMessage, accountActivityMessage, deliveryCheckMessage } from '../lib/email/mailjet.mjs';

test('every service email includes a fixed-origin privacy link in text and HTML', () => {
  const config = { environment: 'staging', from: 'support@staging-mail.mywaveplan.com', callbackSecret: 'x'.repeat(40) };
  const job = { id: '11111111-1111-4111-8111-111111111111', created_at: new Date().toISOString() };
  for (const locale of ['en-GB', 'pt-PT', 'es', 'fr']) {
    for (const mail of [accountMessage({ ...job, type: 'email.account_verify' }, 'test@example.invalid', config, { token: 'a'.repeat(43), locale }),
      invitationMessage(job, 'test@example.invalid', config, { token: 'a'.repeat(43), locale })]) {
      const url = `https://mywaveplan.com/legal/privacy?language=${locale}`;
      assert(mail.TextPart.includes(url));
      assert(mail.HTMLPart.includes(`href="${url}"`));
      assert.equal(mail.TrackClicks, 'disabled');
    }
  }
  for (const mail of [deliveryCheckMessage(job, 'test@example.invalid', config),
    accountActivityMessage({ ...job, type: 'email.account_created_notice' }, 'support@mywaveplan.com', { ...config, environment: 'production' })]) {
    assert(mail.TextPart.includes('https://mywaveplan.com/legal/privacy?language=en-GB'));
    assert(mail.HTMLPart.includes('https://mywaveplan.com/legal/privacy?language=en-GB'));
  }
  assert(supportEmail({ title: 'Test', paragraphs: ['Test'], language: 'untrusted' }).text.includes('language=en-GB'));
});
