import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { applyDocumentTheme, themeStorageKey } from "../lib/theme.mjs";
import Icon from "./icon";

const ThemeContext = createContext(null);

export function ThemeProvider({ children, systemOnly = false }) {
  const [mode, setMode] = useState("system");
  const current = useRef("system");
  const apply = useCallback(
    (next) => {
      current.current = applyDocumentTheme(
        systemOnly ? "system" : next,
        window.matchMedia("(prefers-color-scheme: dark)").matches,
      );
      setMode(current.current);
    },
    [systemOnly],
  );

  useEffect(() => {
    let saved = document.documentElement.dataset.themeMode;
    try {
      saved = window.localStorage.getItem(themeStorageKey);
    } catch (_) {}
    apply(saved);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const deviceChanged = () => {
      if (current.current === "system") apply("system");
    };
    const storageChanged = (event) => {
      if (event.key === themeStorageKey || event.key === null)
        apply(event.newValue);
    };
    media.addEventListener("change", deviceChanged);
    window.addEventListener("storage", storageChanged);
    return () => {
      media.removeEventListener("change", deviceChanged);
      window.removeEventListener("storage", storageChanged);
    };
  }, [apply]);

  const choose = useCallback(
    (next) => {
      apply(next);
      try {
        window.localStorage.setItem(themeStorageKey, current.current);
      } catch (_) {}
    },
    [apply],
  );

  return (
    <ThemeContext.Provider value={{ mode, choose }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeSelector({ compact = false }) {
  const { mode, choose } = useContext(ThemeContext);
  const id = useId();
  return (
    <fieldset
      className={`theme-selector theme-switch ${compact ? "compact" : ""}`}
    >
      <legend>Appearance</legend>
      <div className="theme-options">
        {[
          ["system", "monitor", "Follow device settings"],
          ["light", "sun", "Light theme"],
          ["dark", "moon", "Dark theme"],
        ].map(([value, icon, label]) => (
          <label key={value} title={label}>
            <input
              type="radio"
              name={id}
              value={value}
              checked={mode === value}
              onChange={() => choose(value)}
              aria-label={label}
            />
            <span>
              <Icon name={icon} />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
