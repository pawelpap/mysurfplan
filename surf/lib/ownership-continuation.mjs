import { validAccountToken } from './account-flow.mjs';
import { defaultLocale, isLocale } from './locale/preferences.mjs';

export const ownershipStorageKey = 'mywaveplan:ownership:v1';
export const ownershipLifetime = 7 * 24 * 60 * 60 * 1000;
export function clearOwnership(storage) {
  try { storage?.removeItem(ownershipStorageKey); } catch { /* Storage may be disabled. */ }
}
// The token is never included in a navigation URL. Restoring does not extend expiry.
export function ownershipContinuation(fragment, storage, now = Date.now()) {
  if (fragment) {
    let previous;
    try { previous = JSON.parse(storage?.getItem(ownershipStorageKey) || 'null'); } catch { /* Storage may be disabled. */ }
    clearOwnership(storage);
    const token = fragment.startsWith('#') ? fragment.slice(1) : fragment;
    if (!validAccountToken(token)) return { token: '', stored: false };
    const sameToken = previous?.token === token && Number.isFinite(previous.expires);
    if (sameToken && previous.expires <= now) return { token: '', stored: false };
    const expires = sameToken ? Math.min(previous.expires, now + ownershipLifetime) : now + ownershipLifetime;
    let stored = false;
    try {
      if (storage) {
        storage.setItem(ownershipStorageKey, JSON.stringify({ token, expires }));
        stored = true;
      }
    } catch { /* Keep the token only in the mounted page when storage is disabled. */ }
    return { token, stored, expires };
  }
  try {
    const value = JSON.parse(storage?.getItem(ownershipStorageKey) || 'null');
    if (validAccountToken(value?.token) && Number.isFinite(value.expires) &&
        value.expires > now && value.expires <= now + ownershipLifetime)
      return { token: value.token, stored: true, expires: value.expires };
  } catch { /* Treat malformed or unavailable storage as an absent continuation. */ }
  clearOwnership(storage);
  return { token: '', stored: false };
}
export function ownershipNext(locale) {
  return `/ownership?language=${encodeURIComponent(isLocale(locale) ? locale : defaultLocale)}`;
}
