import { createHash } from 'node:crypto';
import { recipientHash, validEventToken } from './crypto.mjs';
import { validEmail } from './config.mjs';

const types = new Set(['sent', 'bounce', 'blocked', 'spam', 'unsub']);
export function parseDeliveryEvent(event, config, now = Date.now()) {
  if (!event || !types.has(event.event) || !/^[0-9a-f-]{36}$/i.test(event.CustomID || '') ||
      !Number.isSafeInteger(event.time) || event.time < 0 || event.time * 1000 > now + 300000 ||
      !validEmail(event.email) || !validEventToken(event.CustomID, event.Payload, config)) return null;
  // Numeric Mailjet MessageID can exceed JS's safe integer range. Use the GUID.
  const providerId = typeof event.Message_GUID === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(event.Message_GUID) ? event.Message_GUID : null;
  const suppress = event.event === 'spam' || event.event === 'unsub' ? event.event :
    event.event === 'bounce' && event.hard_bounce === true ? 'hard_bounce' : null;
  const hash = recipientHash(event.email, config);
  const id = createHash('sha256').update(JSON.stringify([config.environment,event.CustomID,event.event,event.time,providerId,hash,suppress])).digest('hex');
  return { jobId: event.CustomID, id, type: event.event, time: new Date(event.time * 1000).toISOString(), hash, providerId, suppress };
}

export async function recordDeliveryEvents(query, body, config) {
  const events = Array.isArray(body) ? body : [body];
  if (!events.length || events.length > 50) throw new Error('email_events_invalid');
  let recorded = 0;
  for (const raw of events) {
    const event = parseDeliveryEvent(raw, config);
    if (!event) continue;
    const [result] = await query('SELECT record_email_event($1,$2,$3,$4,$5,$6,$7,$8) AS recorded',
      [config.environment,event.jobId,event.id,event.type,event.time,event.hash,event.providerId,event.suppress]);
    if (result.recorded) recorded++;
  }
  return recorded;
}
