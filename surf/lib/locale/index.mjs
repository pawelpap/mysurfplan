import { catalogues } from "./catalogues.mjs";
import { defaultLocale, isLocale } from "./preferences.mjs";

export function createLocale(preferredLocale) {
  const locale = isLocale(preferredLocale) ? preferredLocale : defaultLocale;
  const catalogue = catalogues[locale];
  const fallback = catalogues[defaultLocale];
  return {
    locale,
    t(key, values = {}) {
      const message = (Object.hasOwn(catalogue, key) && catalogue[key]) ||
        (Object.hasOwn(fallback, key) && fallback[key]) || key;
      return message.replace(/\{(\w+)\}/g, (token, name) =>
        Object.hasOwn(values, name) ? String(values[name]) : token,
      );
    },
    formatDate(value, options) {
      return new Date(value).toLocaleString(locale, options);
    },
    formatNumber(value, options) {
      return new Intl.NumberFormat(locale, options).format(value);
    },
  };
}
