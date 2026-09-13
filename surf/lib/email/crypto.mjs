import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { equalSecret } from './config.mjs';

export const recipientHash = (email, config) => createHmac('sha256', config.recipientKey)
  .update(`${config.environment}:${email.trim().toLowerCase()}`).digest('hex');
const context = (id, config) => `${config.environment}:email.delivery_check:1:${id}`;

export function encryptPayload(payload, id, config) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(config.payloadKey, 'hex'), iv);
  cipher.setAAD(Buffer.from(context(id, config)));
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return { kid: config.keyId, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

export function decryptPayload(payload, id, config) {
  if (!payload || payload.kid !== config.keyId) throw new Error('email_payload_key_unavailable');
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(config.payloadKey, 'hex'), Buffer.from(payload.iv, 'base64'));
  cipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  cipher.setAAD(Buffer.from(context(id, config)));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(payload.data, 'base64')), cipher.final()]).toString('utf8'));
}

export const eventToken = (id, config) => `${config.environment}.${createHmac('sha256', config.callbackSecret).update(context(id, config)).digest('hex')}`;
export const validEventToken = (id, value, config) => equalSecret(value, eventToken(id, config));
