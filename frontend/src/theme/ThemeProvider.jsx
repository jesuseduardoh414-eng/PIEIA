import { createContext, useContext, useEffect, useState, useCallback } from 'react';

// ThemeProvider — base del theming editable en runtime (REGLAS §4).
// Por ahora gestiona el modo (claro/oscuro) y deja el punto de extension para,
// mas adelante, inyectar tokens desde la tabla `tema` de Supabase (tarea #7).

const ThemeContext = createContext({ mode: 'light', toggle: () => {}, setMode: () => {} });

const STORAGE_KEY = 'pieia-theme-mode';

export function ThemeProvider({ children, defaultMode = 'light' }) {
  const [mode, setMode] = useState(() => {
    if (typeof window === 'undefined') return defaultMode;
    return localStorage.getItem(STORAGE_KEY) || defaultMode;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggle = useCallback(() => setMode((m) => (m === 'dark' ? 'light' : 'dark')), []);

  // Punto de extension futuro: aplicar overrides de tokens desde BD.
  // applyTheme(tokens) => Object.entries(tokens).forEach(([k,v]) =>
  //   document.documentElement.style.setProperty(k, v));

  return <ThemeContext.Provider value={{ mode, toggle, setMode }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
