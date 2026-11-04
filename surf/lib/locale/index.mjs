import { accountMessages } from "./account-messages.mjs";
import { appMessages } from "./app-messages.mjs";
import { catalogues } from "./catalogues.mjs";
import { defaultLocale, isLocale } from "./preferences.mjs";

export function createLocale(preferredLocale) {
  const locale = isLocale(preferredLocale) ? preferredLocale : defaultLocale;
  const catalogue = catalogues[locale];
  const fallback = catalogues[defaultLocale];
  const app = appMessages[locale] || {};
  const account = accountMessages[locale];
  const numberFormats = new Map();
  return {
    locale,
    t(key, values = {}) {
      if (typeof key !== "string") return "";
      const message = (Object.hasOwn(catalogue, key) && catalogue[key]) ||
        (Object.hasOwn(account, key) && account[key]) ||
        (Object.hasOwn(app, key) && app[key]) ||
        (Object.hasOwn(fallback, key) && fallback[key]) || key;
      return message.replace(/\{(\w+)\}/g, (token, name) =>
        Object.hasOwn(values, name) ? String(values[name]) : token,
      );
    },
    formatDate(value, options) {
      return new Date(value).toLocaleString(locale, options);
    },
    formatNumber(value, options) {
      const key = JSON.stringify(options);
      if (!numberFormats.has(key)) numberFormats.set(key, new Intl.NumberFormat(locale, options));
      return numberFormats.get(key).format(value);
    },
  };
}
