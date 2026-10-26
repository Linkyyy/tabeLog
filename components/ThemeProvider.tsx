"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  DEFAULT_THEME,
  isTheme,
  THEMES,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "@/lib/themes";

const ThemeContext = createContext({
  theme: DEFAULT_THEME as ThemeId,
  setTheme: (_theme: ThemeId) => {},
});

function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEMES.find((item) => item.id === theme)!.color);
}

function storedTheme(): ThemeId {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : DEFAULT_THEME;
  } catch {
    const value = document.documentElement.dataset.theme;
    return isTheme(value) ? value : DEFAULT_THEME;
  }
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, updateTheme] = useState<ThemeId>(DEFAULT_THEME);
  const setTheme = useCallback((next: ThemeId) => {
    applyTheme(next);
    updateTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable; switching still works for this page.
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      const next = storedTheme();
      applyTheme(next);
      updateTheme(next);
    };
    sync();
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
