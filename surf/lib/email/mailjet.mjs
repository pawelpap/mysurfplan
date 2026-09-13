import { eventToken } from './crypto.mjs';
import { supportEmail } from './template.mjs';

export function deliveryCheckMessage(job, recipient, config) {
  const prefix = config.environment === 'staging' ? '[Staging] ' : '';
  const content = supportEmail({ title: 'Email delivery check', staging: config.environment === 'staging',
    paragraphs: ['This is an authorised delivery test for MyWavePlan. No action is needed.', 'You can reply to this email to reach our Support Team.'] });
  return { From: { Email: config.from, Name: 'MyWavePlan' },
    ReplyTo: { Email: 'support@mywaveplan.com', Name: 'MyWavePlan Support' },
    To: [{ Email: recipient }], Subject: `${prefix}MyWavePlan email delivery check`,
    TextPart: content.text, HTMLPart: content.html,
    TrackOpens: 'disabled', TrackClicks: 'disabled', CustomID: job.id, EventPayload: eventToken(job.id, config) };
}

export function retryDelay(attempt, retryAfter, now = Date.now(), random = Math.random) {
  const seconds = Number(retryAfter);
  const headerMs = retryAfter && Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - now;
  const base = [60, 120, 300, 900, 3600][Math.min(Math.max(attempt - 1, 0), 4)] * 1000;
  return Math.max(base * (1 + random() * 0.2), Number.isFinite(headerMs) ? headerMs : 0);
}

export function createMailjetAdapter(config, fetchImpl = fetch) {
  return async (job, recipient) => {
    try {
      // No SDK/network retries: a timeout can happen after provider acceptance.
      const response = await fetchImpl('https://api.mailjet.com/v3.1/send', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}` },
        body: JSON.stringify({ Messages: [deliveryCheckMessage(job, recipient, config)] }),
      });
      if (response.status === 429) return { status: 'retry', code: 'provider_throttled', retryAfter: response.headers.get('retry-after') };
      if ([400, 401, 403, 404, 413, 422].includes(response.status)) return { status: 'failed', code: `provider_rejected_${response.status}` };
      if (!response.ok) return { status: 'delivery_unknown', code: 'provider_response_uncertain' };
      const body = await response.json();
      const message = body?.Messages?.length === 1 ? body.Messages[0] : null;
      const id = message?.To?.length === 1 ? message.To[0]?.MessageUUID : null;
      if (message?.Status === 'success' && typeof id === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(id))
        return { status: 'accepted', code: null, providerId: id };
      if (message?.Status === 'error' && message.Errors?.length &&
          message.Errors.every(e => [400, 401, 403, 422].includes(e.StatusCode)))
        return { status: 'failed', code: 'provider_message_rejected' };
      return { status: 'delivery_unknown', code: 'provider_response_uncertain' };
    } catch {
      return { status: 'delivery_unknown', code: 'provider_connection_uncertain' };
    }
  };
}
