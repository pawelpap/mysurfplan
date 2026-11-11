import { validEmail } from './email/config.mjs';
import { validAccountToken } from './account-flow.mjs';
import { isLocale } from './locale/preferences.mjs';
import { isUuid } from './school-access.mjs';
export const invitationType = 'email.staff_invitation';
export function invitationInput(body) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const roles = body.roles;
  if (!validEmail(email) || !Array.isArray(roles) || !roles.length || roles.length > 2 ||
      roles.some(r => !['coach','school_admin'].includes(r)) || new Set(roles).size !== roles.length ||
      (body.legacyCoachId != null && (!isUuid(body.legacyCoachId) || !roles.includes('coach')))) return null;
  return { email, roles, legacyCoachId: body.legacyCoachId || null };
}
export function invitationLink(environment, token, locale) {
  if (!['staging','production'].includes(environment) || !validAccountToken(token) || !isLocale(locale)) throw new Error('invalid_invitation_link');
  return `https://${environment === 'staging' ? 'staging.' : ''}mywaveplan.com/invitation?language=${locale}#${token}`;
}
