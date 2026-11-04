export const defaultLocale = "en-GB";
export const localeStorageKey = "mywaveplan:language";
export const localeNames = Object.freeze({
  "en-GB": "English",
  "pt-PT": "Português",
  es: "Español",
});

export function isLocale(value) {
  return typeof value === "string" && Object.hasOwn(localeNames, value);
}

export function resolveLocale({ account, device, languages = [] } = {}) {
  if (isLocale(account)) return account;
  if (isLocale(device)) return device;
  for (const language of languages) {
    const primary = language.toLowerCase().split("-")[0];
    if (primary === "en") return "en-GB";
    if (primary === "pt") return "pt-PT";
    if (primary === "es") return "es";
  }
  return defaultLocale;
}
