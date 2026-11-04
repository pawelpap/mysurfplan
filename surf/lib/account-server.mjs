import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { accountNext, validAccountToken, validNewPassword } from './account-flow.mjs';
import { sessionTokenHash } from './auth-store.mjs';
import { emailConfig, recipientAllowed, validEmail } from './email/config.mjs';
import { encryptPayload, recipientHash } from './email/crypto.mjs';
import { clientNetwork, consumeLoginAttempt } from './login-limits.mjs';
import { defaultLocale, isLocale } from './locale/preferences.mjs';
import { isLegalStagingPreview } from './legal/contracts.mjs';
import { hashPassword, normalizeEmail } from './passwords.mjs';
import { requireMutation } from './request-security.mjs';

const hosts = { staging: 'staging.mywaveplan.com', production: 'mywaveplan.com' };
const purposes = { register: 'verify', recover: 'reset' };
const finishActions = ['verify', 'reset'];

export function accountConfig(req, env = process.env) {
  if (env.ACCOUNT_REGISTRATION_ENABLED !== 'true') return null;
  const termsVersion = env.ACCOUNT_REGISTRATION_TERMS_VERSION;
  if (typeof termsVersion !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(termsVersion)) return null;
  try {
    const config = emailConfig(env);
    return config.enabled && req.headers?.host === hosts[config.environment] ? { ...config, termsVersion } : null;
  } catch {
    return null;
  }
}

function previewAllowed(req, config, env) {
  return isLegalStagingPreview({ host: req.headers.host, environment: config.environment, projectId: env.VERCEL_PROJECT_ID });
}

export async function accountTerms(sql, locale, preview) {
  const [doc] = await sql`
    SELECT version, language, content_hash AS "contentHash"
    FROM legal_documents
    WHERE document_id='mywaveplan.adult-pilot-terms' AND language=${locale}
      AND effective_at<=now() AND (status='published' OR (${preview} AND status='staging_preview'
        AND environment='staging' AND (SELECT environment FROM job_environment WHERE singleton)='staging'))
    ORDER BY effective_at DESC,reviewed_at DESC,version DESC LIMIT 1
  `;
  return doc || null;
}

function validTerms(terms, locale) {
  return terms?.language === locale && typeof terms.version === 'string' && terms.version.length <= 80 &&
    /^[0-9a-f]{64}$/.test(terms.contentHash || '');
}

async function accountRateLimit(req, sql, action, identifier, env) {
  const secret = env.SESSION_SECRET;
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw new Error('account_rate_key_unavailable');
  const key = (kind, value) => createHmac('sha256', secret)
    .update(JSON.stringify(['account-rate-v1', action, kind, value])).digest('hex');
  const first = await consumeLoginAttempt(sql, [{ key: key('network', clientNetwork(req, env)), limit: 24 }]);
  if (!first.allowed) return first;
  return consumeLoginAttempt(sql, [{ key: key('identifier', identifier), limit: action === 'request' ? 3 : 10 }]);
}

async function deliveryReady(sql, config, automaticDelivery) {
  const heartbeatMinutes = automaticDelivery ? 15 : 5;
  const [status] = await sql`
    SELECT EXISTS (SELECT 1 FROM job_worker_status WHERE environment=${config.environment}
        AND completed_at > now()-${heartbeatMinutes}::integer * interval '1 minute' AND last_error IS NULL)
      AND NOT EXISTS (SELECT 1 FROM email_usage WHERE environment=${config.environment} AND (
        (period='day' AND starts_on=(now() AT TIME ZONE 'UTC')::date AND attempts>=${config.dailyLimit})
        OR (period='month' AND starts_on=date_trunc('month',now() AT TIME ZONE 'UTC')::date AND attempts>=${config.monthlyLimit})))
      AS ready
  `;
  return status?.ready === true;
}

export function accountHandler(getSql, env = process.env, scheduleDelivery) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const action = req.query?.action;
    if (![...Object.keys(purposes), ...finishActions, 'terms'].includes(action))
      return res.status(404).json({ ok: false, error: 'account.unavailable' });
    const method = action === 'terms' ? 'GET' : 'POST';
    if (req.method !== method) {
      res.setHeader('Allow', method);
      return res.status(405).json({ ok: false, error: 'account.unavailable' });
    }
    if (!requireMutation(req, res)) return;
    const config = accountConfig(req, env);
    if (!config) return res.status(503).json({ ok: false, error: 'account.unavailable' });
    const body = req.body || {};
    const locale = isLocale(body.locale ?? req.query.locale) ? (body.locale ?? req.query.locale) : defaultLocale;
    const preview = previewAllowed(req, config, env);
    try {
      const sql = await getSql();
      if (action === 'terms') {
        const document = await accountTerms(sql, locale, preview);
        return res.json({ ok: true, data: document?.version === config.termsVersion ? document : null });
      }
      const purpose = purposes[action];
      if (purpose) {
        const started = Date.now();
        const email = normalizeEmail(body.email);
        if (!validEmail(email)) return res.status(400).json({ ok: false, error: 'account.invalidEmail' });
        const limit = await accountRateLimit(req, sql, 'request', email, env);
        if (!limit.allowed) {
          res.setHeader('Retry-After', String(limit.retrySeconds));
          return res.status(429).json({ ok: false, error: 'login.rateLimit' });
        }
        const terms = purpose === 'verify' ? await accountTerms(sql, locale, preview) : null;
        if (!await deliveryReady(sql, config, Boolean(scheduleDelivery)) || (purpose === 'verify' && terms?.version !== config.termsVersion))
          return res.status(503).json({ ok: false, error: 'account.unavailable' });
        const type = `email.account_${purpose}`;
        const token = randomBytes(32).toString('base64url');
        const job = randomUUID();
        const payload = encryptPayload({ recipient: email, token, locale }, job, config, type);
        const allowed = recipientAllowed(config, email, type);
        if (allowed) {
          await sql`SELECT queue_account_email(${purpose}, ${email}, ${recipientHash(email, config)},
            ${sessionTokenHash(token)}, ${job}::uuid, ${config.environment}, ${JSON.stringify(payload)}::jsonb, ${accountNext(body.next)})`;
        }
        await delay(Math.max(0, 450 - (Date.now() - started)));
        if (allowed) scheduleDelivery?.(sql, config, job);
        return res.status(202).json({ ok: true });
      }
      if (!validAccountToken(body.token)) return res.status(400).json({ ok: false, error: 'account.invalidLink' });
      if (!validNewPassword(body.password)) return res.status(400).json({ ok: false, error: 'account.passwordHint' });
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (action === 'verify' && (!name || name.length > 120 || /[\x00-\x1f\x7f]/.test(name) ||
          body.adult !== true || body.accepted !== true || !validTerms(body.terms, locale)))
        return res.status(400).json({ ok: false, error: 'account.completeFields' });
      if (action === 'verify' && body.terms.version !== config.termsVersion)
        return res.status(409).json({ ok: false, error: 'account.termsChanged' });
      const tokenHash = sessionTokenHash(body.token);
      const limit = await accountRateLimit(req, sql, 'finish', tokenHash, env);
      if (!limit.allowed) {
        res.setHeader('Retry-After', String(limit.retrySeconds));
        return res.status(429).json({ ok: false, error: 'login.rateLimit' });
      }
      const passwordHash = await hashPassword(body.password);
      const [row] = action === 'verify'
        ? await sql`SELECT complete_account_registration(${tokenHash}, ${name}, ${passwordHash},
            ${locale}, ${body.terms.version}, ${body.terms.contentHash}, ${preview}) AS result`
        : await sql`SELECT complete_account_reset(${tokenHash}, ${passwordHash}) AS result`;
      if (row?.result === 'terms_changed') return res.status(409).json({ ok: false, error: 'account.termsChanged' });
      if (!row?.result) return res.status(400).json({ ok: false, error: 'account.invalidLink' });
      return res.json({ ok: true, data: { next: accountNext(row.result) } });
    } catch (error) {
      console.error('account_flow_unavailable', { action, code: error?.code });
      return res.status(503).json({ ok: false, error: 'account.unavailable' });
    }
  };
}
