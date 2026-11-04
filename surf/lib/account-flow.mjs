import { isLocale } from './locale/preferences.mjs';

export const accountTokenPattern = /^[A-Za-z0-9_-]{43}$/;
export const validAccountToken = (token) => typeof token === 'string' && accountTokenPattern.test(token);

export function accountNext(value) {
  if (typeof value !== 'string' || value.length > 500 || !value.startsWith('/') ||
      /^\/\//.test(value) || /[\\\x00-\x20\x7f]/.test(value)) return '/';
  const url = new URL(value, 'https://mywaveplan.com');
  const path = url.pathname;
  if (path !== '/' && !/^\/[a-z0-9-]+$/i.test(path)) return '/';
  if (['/account','/login','/api','/legal'].includes(path.toLowerCase())) return '/';
  return path + url.search + url.hash;
}

export function accountEmailLink(environment, purpose, token, locale) {
  if (!validAccountToken(token) || !isLocale(locale) || !['verify','reset'].includes(purpose)) throw new Error('invalid_account_link');
  const origin = environment === 'staging' ? 'https://staging.mywaveplan.com' : 'https://mywaveplan.com';
  return `${origin}/account/${purpose}?language=${locale}#${token}`;
}

export function validNewPassword(password) {
  return typeof password === 'string' && [...password].length >= 15 && password.length <= 256;
}
