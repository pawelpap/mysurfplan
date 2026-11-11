import { timingSafeEqual } from 'node:crypto';
import { monitorPingUrl } from './monitor.mjs';

export const PROJECTS = Object.freeze({
  staging: 'prj_sWC9MbvG8rWtAO0YpuSNiOqZwYlO',
  production: 'prj_J100oKHrcYqghajndUkaEI8LDSvi',
});

export const ACCOUNT_ACTIVITY_RECIPIENT = 'support@mywaveplan.com';
export const ACCOUNT_ACTIVITY_SUBJECTS = Object.freeze({
  'email.account_created_notice': 'A personal account was created',
  'email.password_changed_notice': 'An account password was changed or reset',
  'email.account_closed_notice': 'A personal account was closed',
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
  const publicAccounts = environment === 'production' && env.ACCOUNT_REGISTRATION_ENABLED === 'true' &&
    env.ACCOUNT_EMAIL_PUBLIC === 'true';
  const monitorUrl = monitorPingUrl(env.EMAIL_MONITOR_PING_URL);
  if (publicAccounts && !monitorUrl) throw new Error('email_monitor_required');
  return { enabled, environment, allowlist, from, dailyLimit, monthlyLimit, monitorUrl, publicAccounts,
    accountFlows: env.ACCOUNT_REGISTRATION_ENABLED === 'true',
    apiKey: env.MAILJET_API_KEY, apiSecret: env.MAILJET_SECRET_KEY,
    payloadKey: env.EMAIL_PAYLOAD_KEY, keyId: env.EMAIL_PAYLOAD_KEY_ID,
    recipientKey: env.EMAIL_RECIPIENT_KEY, callbackSecret: env.EMAIL_CALLBACK_SECRET,
    operationsSecret: env.EMAIL_OPERATIONS_SECRET, cronSecret: env.CRON_SECRET };
}

export function recipientAllowed(config, recipient, type) {
  if (Object.hasOwn(ACCOUNT_ACTIVITY_SUBJECTS, type))
    return config.environment === 'production' && recipient === ACCOUNT_ACTIVITY_RECIPIENT;
  return validEmail(recipient) && (config.allowlist.includes(recipient) ||
    (config.environment === 'production' && config.publicAccounts === true && ['email.account_verify','email.account_reset','email.staff_invitation'].includes(type)));
}

export function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}
