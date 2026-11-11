import { invitationLink } from '../invitations.mjs';
import { ACCOUNT_ACTIVITY_SUBJECTS } from './config.mjs';
import { eventToken } from './crypto.mjs';
import { supportEmail } from './template.mjs';
import { accountEmailLink } from '../account-flow.mjs';
import { createLocale } from '../locale/index.mjs';

function mailjetMessage(job, recipient, config, title, content) {
  const prefix = config.environment === 'staging' ? '[Staging] ' : '';
  return { From: { Email: config.from, Name: 'MyWavePlan' },
    ReplyTo: { Email: 'support@mywaveplan.com', Name: 'MyWavePlan Support' },
    To: [{ Email: recipient }], Subject: `${prefix}${title}`,
    TextPart: content.text, HTMLPart: content.html,
    TrackOpens: 'disabled', TrackClicks: 'disabled', CustomID: job.id, EventPayload: eventToken(job.id, config) };
}

export function deliveryCheckMessage(job, recipient, config) {
  const content = supportEmail({ title: 'Email delivery check', staging: config.environment === 'staging',
    paragraphs: ['This is an authorised delivery test for MyWavePlan. No action is needed.', 'You can reply to this email to reach our Support Team.'] });
  return mailjetMessage(job, recipient, config, 'MyWavePlan email delivery check', content);
}

export function accountMessage(job, recipient, config, { token, locale }) {
  const { t } = createLocale(locale);
  const purpose = job.type === 'email.account_verify' ? 'verify' : 'reset';
  const title = t(`account.mail.${purpose}Title`);
  const content = supportEmail({ title, staging: config.environment === 'staging', language: locale,
    paragraphs: [t(`account.mail.${purpose}Body`)], afterAction: t('account.mail.ignore'),
    action: { label: t(`account.${purpose}Title`), url: accountEmailLink(config.environment, purpose, token, locale) } });
  return mailjetMessage(job, recipient, config, `${title} · MyWavePlan`, content);
}

export function invitationMessage(job, recipient, config, { token, locale }) {
  const copy = {
    'en-GB': ['School staff invitation', 'You have been invited to join a school on MyWavePlan. Sign in with this verified email address to review the school and roles before accepting.', 'Review invitation', 'This invitation expires in seven days. If you did not expect it, you can ignore this email.'],
    'pt-PT': ['Convite para a equipa de uma escola', 'Recebeu um convite para uma escola no MyWavePlan. Entre com este endereço de email verificado para consultar a escola e as funções antes de aceitar.', 'Consultar convite', 'Este convite expira em sete dias. Se não o esperava, pode ignorar este email.'],
    'es': ['Invitación al equipo de una escuela', 'Has recibido una invitación a una escuela en MyWavePlan. Inicia sesión con este correo verificado para revisar la escuela y las funciones antes de aceptar.', 'Revisar invitación', 'Esta invitación caduca en siete días. Si no la esperabas, puedes ignorar este correo.'],
    'fr': ['Invitation à une équipe', 'Vous avez reçu une invitation à une école sur MyWavePlan. Connectez-vous avec cette adresse e-mail vérifiée pour consulter les rôles avant de les accepter.', 'Consulter l’invitation', 'Cette invitation expire dans sept jours. Si vous ne l’attendiez pas, vous pouvez ignorer cet e-mail.'],
  };
  const [title,body,label,afterAction]=copy[locale] || copy['en-GB'];
  return mailjetMessage(job,recipient,config,title,supportEmail({ title, paragraphs:[body], afterAction, language:locale,
    staging:config.environment==='staging', action:{label,url:invitationLink(config.environment,token,locale)} }));
}

export function accountActivityMessage(job, recipient, config) {
  const title = ACCOUNT_ACTIVITY_SUBJECTS[job.type];
  const when = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Lisbon',
  }).format(new Date(job.created_at));
  const content = supportEmail({ title, paragraphs: [
    `${title} on MyWavePlan at ${when} (Lisbon time).`,
    'This is an automatic notice for the MyWavePlan Support team.',
  ] });
  return mailjetMessage(job, recipient, config, `${title} · MyWavePlan`, content);
}

export function retryDelay(attempt, retryAfter, now = Date.now(), random = Math.random) {
  const seconds = Number(retryAfter);
  const headerMs = retryAfter && Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - now;
  const base = [60, 120, 300, 900, 3600][Math.min(Math.max(attempt - 1, 0), 4)] * 1000;
  return Math.max(base * (1 + random() * 0.2), Number.isFinite(headerMs) ? headerMs : 0);
}

export function createMailjetAdapter(config, fetchImpl = fetch) {
  return async (job, recipient, payload) => {
    try {
      const outbound = job.type === 'email.staff_invitation' ? invitationMessage(job,recipient,config,payload) : job.type === 'email.delivery_check'
        ? deliveryCheckMessage(job, recipient, config)
        : Object.hasOwn(ACCOUNT_ACTIVITY_SUBJECTS, job.type)
          ? accountActivityMessage(job, recipient, config)
          : accountMessage(job, recipient, config, payload);
      // No SDK/network retries: a timeout can happen after provider acceptance.
      const response = await fetchImpl('https://api.mailjet.com/v3.1/send', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}` },
        body: JSON.stringify({ Messages: [outbound] }),
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
