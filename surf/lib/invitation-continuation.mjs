import { validAccountToken } from './account-flow.mjs';
import { defaultLocale, isLocale } from './locale/preferences.mjs';

export const invitationStorageKey = 'mywaveplan:invitation:v1';
export const invitationLifetime = 7 * 24 * 60 * 60 * 1000;
export function clearInvitation(storage) {
  try { storage?.removeItem(invitationStorageKey); } catch { /* Storage may be disabled. */ }
}
// The token is never included in a navigation URL. Restoring does not extend expiry.
export function invitationContinuation(fragment, storage, now = Date.now()) {
  if (fragment) {
    let previous;
    try { previous = JSON.parse(storage?.getItem(invitationStorageKey) || 'null'); } catch { /* Storage may be disabled. */ }
    clearInvitation(storage);
    const token = fragment.startsWith('#') ? fragment.slice(1) : fragment;
    if (!validAccountToken(token)) return { token: '', stored: false };
    const sameToken = previous?.token === token && Number.isFinite(previous.expires);
    if (sameToken && previous.expires <= now) return { token: '', stored: false };
    const expires = sameToken ? Math.min(previous.expires, now + invitationLifetime) : now + invitationLifetime;
    let stored = false;
    try {
      if (storage) {
        storage.setItem(invitationStorageKey, JSON.stringify({ token, expires }));
        stored = true;
      }
    } catch { /* Keep the token only in the mounted page when storage is disabled. */ }
    return { token, stored };
  }
  try {
    const value = JSON.parse(storage?.getItem(invitationStorageKey) || 'null');
    if (validAccountToken(value?.token) && Number.isFinite(value.expires) &&
        value.expires > now && value.expires <= now + invitationLifetime)
      return { token: value.token, stored: true };
  } catch { /* Treat malformed or unavailable storage as an absent continuation. */ }
  clearInvitation(storage);
  return { token: '', stored: false };
}
export function invitationNext(locale) {
  return `/invitation?language=${encodeURIComponent(isLocale(locale) ? locale : defaultLocale)}`;
}
