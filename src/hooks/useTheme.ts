import { useState, useEffect, useCallback } from "react";
import {
  type Theme,
  getResolvedTheme,
  getStoredTheme,
  setTheme as persistTheme,
  toggleTheme as cycleTheme,
  applyTheme,
} from "@/lib/theme";

export function useTheme() {
  const [theme, setLocalTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const resolved = getResolvedTheme();
    setLocalTheme(resolved);
    applyTheme(resolved);

    // Listen to explicit programmatic changes
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: Theme }>;
      if (customEvent.detail?.theme) {
        setLocalTheme(customEvent.detail.theme);
      } else {
        setLocalTheme(getResolvedTheme());
      }
    };

    // Listen to localStorage modifications from other tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "theme") {
        setLocalTheme(getResolvedTheme());
      }
    };

    // Listen to OS/system preference changes when no explicit stored preference exists
    let mediaQuery: MediaQueryList | null = null;
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (!getStoredTheme()) {
        const nextTheme: Theme = e.matches ? "dark" : "light";
        setLocalTheme(nextTheme);
        applyTheme(nextTheme);
      }
    };

    if (window.matchMedia) {
      mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", handleMediaChange);
    }

    window.addEventListener("themechange", handleThemeChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("themechange", handleThemeChange);
      window.removeEventListener("storage", handleStorage);
      if (mediaQuery) {
        mediaQuery.removeEventListener("change", handleMediaChange);
      }
    };
  }, []);

  const toggle = useCallback(() => {
    const next = cycleTheme();
    setLocalTheme(next);
  }, []);

  const setExplicit = useCallback((nextTheme: Theme) => {
    persistTheme(nextTheme);
    setLocalTheme(nextTheme);
  }, []);

  return {
    theme,
    isDark: theme === "dark",
    isMounted: mounted,
    toggleTheme: toggle,
    setTheme: setExplicit,
  };
}
