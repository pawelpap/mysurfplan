import { randomUUID } from 'node:crypto';
import { ACCOUNT_ACTIVITY_RECIPIENT, ACCOUNT_ACTIVITY_SUBJECTS } from './config.mjs';
import { encryptPayload, recipientHash } from './crypto.mjs';

export function accountActivityNotice(config, type) {
  if (!config?.enabled || config.environment !== 'production' || !Object.hasOwn(ACCOUNT_ACTIVITY_SUBJECTS, type)) return null;
  const id = randomUUID();
  const recipient = ACCOUNT_ACTIVITY_RECIPIENT;
  return {
    id, type, hash: recipientHash(recipient, config),
    payload: JSON.stringify(encryptPayload({ recipient }, id, config, type)),
  };
}
