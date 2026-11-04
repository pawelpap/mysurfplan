import { createContext, useContext, useId, useState, useSyncExternalStore } from "react";
import { createLocale } from "../lib/locale/index.mjs";
import { defaultLocale, isLocale, localeNames, localeStorageKey, resolveLocale } from "../lib/locale/preferences.mjs";

const LocaleContext = createContext({ ...createLocale(defaultLocale), choice: null, conflict: false });
const changeEvent = "mywaveplan-language-changed";
let volatileChoice;

function savedDeviceLocale() {
  if (volatileChoice !== undefined) return volatileChoice;
  try {
    return window.localStorage.getItem(localeStorageKey);
  } catch {
    return null;
  }
}

function deviceChoice() {
  const saved = savedDeviceLocale();
  return isLocale(saved) ? saved : null;
}

function browserLocale() {
  return resolveLocale({
    languages: navigator.languages?.length ? navigator.languages : [navigator.language || ""],
  });
}

function subscribe(onChange) {
  function onStorage(event) {
    if (event.key === localeStorageKey || event.key === null) onChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener("languagechange", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("languagechange", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

function saveDeviceLocale(locale) {
  try {
    if (locale === null) window.localStorage.removeItem(localeStorageKey);
    else window.localStorage.setItem(localeStorageKey, locale);
    volatileChoice = undefined;
  } catch {
    // The current tab can still use an explicit choice if storage is unavailable.
    volatileChoice = locale;
  }
  window.dispatchEvent(new Event(changeEvent));
}

export function LocaleProvider({ children, accountLocale }) {
  const device = useSyncExternalStore(subscribe, deviceChoice, () => null);
  const browser = useSyncExternalStore(subscribe, browserLocale, () => defaultLocale);
  const choice = isLocale(accountLocale) ? accountLocale : device;
  const locale = resolveLocale({ account: accountLocale, device, languages: [browser] });
  const conflict = isLocale(accountLocale) && device !== null && accountLocale !== device;
  return (
    <LocaleContext.Provider value={{ ...createLocale(locale), choice, conflict }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function LanguageSelector({ saveAccountLocale }) {
  const { locale, t, choice, conflict } = useLocale();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const hintId = useId();

  async function change(event) {
    const next = event.target.value || null;
    if (pending || (next !== null && !isLocale(next))) return;
    setFailed(false);
    if (!saveAccountLocale) {
      saveDeviceLocale(next);
      return;
    }
    setPending(true);
    try {
      await saveAccountLocale(next);
      saveDeviceLocale(next);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="language-preference" lang={locale}>
      <label className="language-selector">
        <span>{t("language.label")}</span>
        <select value={choice ?? ""} onChange={change} aria-disabled={pending}
          aria-describedby={conflict ? hintId : undefined}>
          <option value="">{t("language.automatic")}</option>
          {Object.entries(localeNames).map(([value, name]) => (
            <option key={value} value={value} lang={value} translate="no">{name}</option>
          ))}
        </select>
      </label>
      {conflict && <small id={hintId}>{t("language.accountChoice")}</small>}
      {failed && <small role="alert">{t("language.saveError")}</small>}
    </div>
  );
}
