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

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("system");
  const current = useRef("system");
  const apply = useCallback((next) => {
    current.current = applyDocumentTheme(
      next,
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
    setMode(current.current);
  }, []);

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
    <div className={`theme-selector ${compact ? "compact" : ""}`}>
      <label htmlFor={id}>Appearance</label>
      <select
        id={id}
        value={mode}
        onChange={(event) => choose(event.target.value)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}
