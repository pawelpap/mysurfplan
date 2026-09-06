export const themeStorageKey = "mywaveplan:appearance";

// This function is also embedded in the document head, so it must be self-contained.
export function applyDocumentTheme(preference, systemDark) {
  const mode = ["system", "light", "dark"].includes(preference)
    ? preference
    : "system";
  const theme = mode === "system" ? (systemDark ? "dark" : "light") : mode;
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  return mode;
}

// Apply saved preferences before the page paints. CSS also follows the device
// when JavaScript is disabled. Storage failure must never stop the app loading.
export const themeBootstrapScript = `(function(){
  var mode;
  try { mode = window.localStorage.getItem(${JSON.stringify(themeStorageKey)}); } catch (_) {}
  (${applyDocumentTheme.toString()})(mode, window.matchMedia('(prefers-color-scheme: dark)').matches);
})();`;
