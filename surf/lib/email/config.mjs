import { timingSafeEqual } from 'node:crypto';

export const PROJECTS = Object.freeze({
  staging: 'prj_sWC9MbvG8rWtAO0YpuSNiOqZwYlO',
  production: 'prj_J100oKHrcYqghajndUkaEI8LDSvi',
});

export function equalSecret(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string' || !expected) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Both live projects use Vercel's production target. An explicit app environment
// and matching project identity prevent a preview/staging send using prod config.
export function emailConfig(env = process.env) {
  const environment = env.APP_ENVIRONMENT;
  const enabled = env.EMAIL_ENABLED === 'true';
  if (!enabled) return { enabled: false, environment };
  if (!PROJECTS[environment] || env.VERCEL_ENV !== 'production' ||
      env.VERCEL_PROJECT_ID !== PROJECTS[environment]) throw new Error('email_environment_invalid');
  const required = ['MAILJET_API_KEY', 'MAILJET_SECRET_KEY', 'EMAIL_PAYLOAD_KEY',
    'EMAIL_RECIPIENT_KEY', 'EMAIL_CALLBACK_SECRET', 'EMAIL_OPERATIONS_SECRET', 'CRON_SECRET'];
  for (const name of required) {
    if (typeof env[name] !== 'string' || env[name].length < 32 || env[name] === '[SENSITIVE]')
      throw new Error('email_configuration_incomplete');
  }
  if (!/^[0-9a-f]{64}$/i.test(env.EMAIL_PAYLOAD_KEY) || !/^[a-z0-9_-]{1,24}$/i.test(env.EMAIL_PAYLOAD_KEY_ID || ''))
    throw new Error('email_key_invalid');
  const allowlist = (env.EMAIL_TEST_RECIPIENTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  // A6 is delivery readiness only. B3 must explicitly implement general sending.
  if (!allowlist.length || allowlist.length > 5 || allowlist.some(s => !validEmail(s)))
    throw new Error('email_allowlist_required');
  const from = env.EMAIL_FROM;
  if (!validEmail(from) || !from.endsWith(environment === 'production' ? '@mywaveplan.com' : '@staging-mail.mywaveplan.com'))
    throw new Error('email_sender_invalid');
  const dailyLimit = Number(env.EMAIL_DAILY_LIMIT), monthlyLimit = Number(env.EMAIL_MONTHLY_LIMIT);
  // Combined defaults stay below a shared Mailjet Free account's 200/6000 limits.
  const maxima = environment === 'production' ? [150, 4500] : [20, 500];
  if (![dailyLimit, monthlyLimit].every(Number.isInteger) || dailyLimit < 1 || monthlyLimit < dailyLimit ||
      dailyLimit > maxima[0] || monthlyLimit > maxima[1]) throw new Error('email_budget_invalid');
  return { enabled, environment, allowlist, from, dailyLimit, monthlyLimit,
    apiKey: env.MAILJET_API_KEY, apiSecret: env.MAILJET_SECRET_KEY,
    payloadKey: env.EMAIL_PAYLOAD_KEY, keyId: env.EMAIL_PAYLOAD_KEY_ID,
    recipientKey: env.EMAIL_RECIPIENT_KEY, callbackSecret: env.EMAIL_CALLBACK_SECRET,
    operationsSecret: env.EMAIL_OPERATIONS_SECRET, cronSecret: env.CRON_SECRET };
}

export function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}
