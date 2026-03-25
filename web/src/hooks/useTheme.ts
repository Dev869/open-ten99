import { useState, useEffect } from 'react';

export function useTheme() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('oc-theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('oc-theme', dark ? 'dark' : 'light');

    // Update Android Chrome status bar / recent-apps color
    const themeColor = dark ? '#1C1710' : '#F4F1EC';
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', themeColor);
    });
  }, [dark]);

  return { dark, toggle: () => setDark(d => !d) };
}
