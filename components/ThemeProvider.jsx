'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext({
  theme: 'system',
  resolved: 'light',
  setTheme: () => {},
});

const STORAGE_KEY = 'pos_theme';

function applyResolved(resolved) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (resolved === 'dark') html.classList.add('dark');
  else html.classList.remove('dark');
}

function resolveTheme(theme) {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('system');
  const [resolved, setResolved] = useState('light');

  // On mount, read saved preference and sync to current resolved value.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || 'system';
    setThemeState(saved);
    const r = resolveTheme(saved);
    setResolved(r);
    applyResolved(r);
  }, []);

  // Re-resolve when system preference changes (only if user picked 'system').
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const r = mq.matches ? 'dark' : 'light';
      setResolved(r);
      applyResolved(r);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    const r = resolveTheme(next);
    setResolved(r);
    applyResolved(r);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Inline script to apply theme BEFORE React hydrates, preventing a
 * flash of wrong colors on initial paint.
 */
export const themeInitScript = `
(function(){try{
  var t = localStorage.getItem('${STORAGE_KEY}') || 'system';
  var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if(dark) document.documentElement.classList.add('dark');
}catch(e){}})();
`;
