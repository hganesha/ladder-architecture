import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { applyTheme, getInitialTheme, type Theme } from "../lib/theme";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === "dark" ? "dark" : getInitialTheme()));
  const nextTheme = theme === "light" ? "dark" : "light";

  useEffect(() => {
    const onThemeChange = (event: Event) => setTheme((event as CustomEvent<Theme>).detail);
    window.addEventListener("ladder-theme-change", onThemeChange);
    return () => window.removeEventListener("ladder-theme-change", onThemeChange);
  }, []);

  return (
    <button
      className={`theme-toggle ${compact ? "compact" : ""}`}
      type="button"
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      onClick={() => applyTheme(nextTheme)}
    >
      {theme === "light" ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
      {!compact && <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>}
    </button>
  );
}
