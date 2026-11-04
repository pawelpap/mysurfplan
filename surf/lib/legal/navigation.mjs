import {
  defaultLocale, isLocale, languagesFromHeader, legalHref, resolveLocale,
} from "../locale/preferences.mjs";

export function legalLanguageSwitchHref(slug, language, document) {
  if (!document?.version) return legalHref(slug, language);

  const query = new URLSearchParams({
    language: language ?? "auto",
    version: document.version,
    source: document.language,
  });
  return `/legal/${slug}?${query}`;
}

export function legalDocumentRequest({ language, version, source }, accountLocale, acceptLanguage) {
  if (version !== undefined && (typeof version !== "string" || !version || version.length > 80)) return null;
  if (source !== undefined && (!version || !isLocale(source))) return null;
  if (language !== undefined && !isLocale(language) && !(language === "auto" && source)) return null;

  const languages = languagesFromHeader(acceptLanguage);
  if (language === "auto") return { locale: resolveLocale({ languages }), selection: null, version, source };
  if (language) return { locale: language, selection: language, version, source };
  if (version) return { locale: defaultLocale, selection: defaultLocale, version, source };
  return {
    locale: resolveLocale({ account: accountLocale, languages }),
    selection: accountLocale ?? null,
    version,
    source,
  };
}

export async function findLegalDocument(load, { locale, version, source }) {
  const document = await load({ language: locale, version });
  if (document) return document;

  // Exact evidence links must resolve to the language they identify. Only a
  // language switch may fall back to the source of the same version.
  const fallback = version ? source : defaultLocale;
  return fallback && fallback !== locale ? load({ language: fallback, version }) : null;
}
