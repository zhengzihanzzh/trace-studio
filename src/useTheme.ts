import { useEffect, useState } from 'react';
export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('trace-studio.theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('trace-studio.theme', theme); } catch { /* 当前会话仍可正常切换。 */ }
  }, [theme]);
  return { theme, toggle: () => setTheme(t => t === 'light' ? 'dark' : 'light') };
}
