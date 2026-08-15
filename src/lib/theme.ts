export type Theme = "light" | "dark";

const THEME_KEY = "ladder-graph-theme";

export function getInitialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be unavailable in hardened browser contexts.
  }
  return "light";
}

export function applyTheme(theme: Theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  if (persist) {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // The active document still receives the theme when storage is unavailable.
    }
  }
  window.dispatchEvent(new CustomEvent<Theme>("ladder-theme-change", { detail: theme }));
}
