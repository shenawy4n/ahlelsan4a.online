export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

/**
 * Read explicitly saved theme preference from localStorage.
 * SSR-safe, returns null if no valid preference is saved.
 */
export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY);
    if (val === "dark" || val === "light") {
      return val;
    }
  } catch {
    // Storage access may fail in restricted environments
  }
  return null;
}

/**
 * Check browser/OS system dark mode preference.
 */
export function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  } catch {
    // matchMedia may be unsupported or restricted
  }
  return "light";
}

/**
 * Resolves the active theme: explicit user choice takes precedence over system preference.
 */
export function getResolvedTheme(): Theme {
  return getStoredTheme() || getSystemTheme();
}

/**
 * Apply theme classes and meta colors to the DOM.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }

  // Update mobile browser chrome theme color
  try {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", theme === "dark" ? "#161c19" : "#1B6447");
    }
  } catch {
    // Ignore meta manipulation errors
  }
}

/**
 * Save theme preference, apply it to the DOM, and dispatch an event for reactive listeners.
 */
export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage quota or access errors
  }

  applyTheme(theme);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }
}

/**
 * Toggle between light and dark themes.
 */
export function toggleTheme(): Theme {
  const current = getResolvedTheme();
  const next: Theme = current === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
