export const defaultLocale = "en-GB";
export const localeStorageKey = "mywaveplan:language";
export const localeNames = Object.freeze({
  "en-GB": "English",
  "pt-PT": "Português",
  es: "Español",
  fr: "Français",
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
    if (primary === "fr") return "fr";
  }
  return defaultLocale;
}

export function languagesFromHeader(header) {
  if (typeof header !== "string") return [];
  return header.split(",").map((entry) => {
    const [language, ...parameters] = entry.trim().split(";");
    const quality = parameters.find((value) => value.trim().startsWith("q="));
    return { language, rank: quality ? Number(quality.trim().slice(2)) : 1 };
  }).filter(({ rank }) => rank > 0 && rank <= 1)
    .sort((a, b) => b.rank - a.rank).map(({ language }) => language);
}

export function legalHref(slug, locale, version) {
  const params = new URLSearchParams();
  if (isLocale(locale)) params.set("language", locale);
  if (version) params.set("version", version);
  return `/legal/${slug}${params.size ? "?" + params : ""}`;
}
